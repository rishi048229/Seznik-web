import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';
import { userTracksStock } from '../utils/stockTracking';
import { handleApiError } from '../utils/apiErrorHandler';

export const getPurchases = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const purchases = await prisma.purchase.findMany({
      where: { userId },
      include: {
        returns: true,
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
};

export const getPurchaseById = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;
    const purchase = await prisma.purchase.findFirst({
      where: { id: String(id), userId },
      include: {
        returns: true,
        supplier: true,
      },
    });
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
};

export const createPurchase = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const data = req.body;
    const tracksStock = await userTracksStock(userId);

    const count = await prisma.purchase.count({ where: { userId } });
    const invoiceNumber = `PUR-${String(count + 1).padStart(5, '0')}`;

    const grandTotal = Number(data.grandTotal) || 0;
    const amountPaid = Number(data.amountPaid) || 0;
    let paymentStatus = 'paid';
    if (amountPaid >= grandTotal - 0.001) {
      paymentStatus = 'paid';
    } else if (amountPaid > 0) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'pending';
    }

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          invoiceNumber,
          supplierBillNumber: data.supplierBillNumber || null,
          supplierId: data.supplierId || null,
          items: data.items,
          subtotal: Number(data.subtotal) || 0,
          totalTax: Number(data.totalTax) || 0,
          grandTotal,
          paymentMethod: data.paymentMethod || 'cash',
          paymentStatus,
          amountPaid,
          paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate) : null,
          notes: data.notes || null,
          userId,
          createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
        },
        include: {
          supplier: true,
          returns: true,
        },
      });

      // Update supplier balance and record ledger transactions
      if (purchase.supplierId) {
        // 1. Inward purchase ledger entry (increases payable)
        await tx.supplierTransaction.create({
          data: {
            supplierId: purchase.supplierId,
            amount: grandTotal,
            type: 'purchase',
            paymentMethod: purchase.paymentMethod,
            referenceId: purchase.id,
            notes: data.supplierBillNumber ? `Bill #${data.supplierBillNumber} (${invoiceNumber})` : `Purchase ${invoiceNumber}`,
            userId,
          },
        });

        // 2. Upfront/Immediate payment ledger entry if amountPaid > 0
        if (amountPaid > 0) {
          await tx.supplierTransaction.create({
            data: {
              supplierId: purchase.supplierId,
              amount: amountPaid,
              type: 'payment',
              paymentMethod: purchase.paymentMethod,
              referenceId: purchase.id,
              notes: `Payment for ${invoiceNumber}`,
              userId,
            },
          });
        }

        // 3. Update net supplier payable balance
        const unpaid = Math.max(0, grandTotal - amountPaid);
        if (unpaid > 0) {
          await tx.supplier.update({
            where: { id: purchase.supplierId },
            data: { payableBalance: { increment: unpaid } },
          });
        }
      }

      // Update product stock (increase for purchase) — skipped when business does not track stock
      if (tracksStock && data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: item.quantity }, costPrice: item.costPrice },
            });
            await tx.stockHistory.create({
              data: {
                change: item.quantity,
                reason: 'purchase',
                productId: item.productId,
                userId,
              },
            });
          }
        }
      } else if (!tracksStock && data.items && Array.isArray(data.items)) {
        // Still update cost price from purchase without touching quantity
        for (const item of data.items) {
          if (item.productId && item.costPrice != null) {
            await tx.product.update({
              where: { id: item.productId },
              data: { costPrice: item.costPrice },
            });
          }
        }
      }
      return purchase;
    });

    res.status(201).json(result);
  } catch (error: any) {
    handleApiError(res, error, 'Failed to record purchase. Please verify supplier and items.');
  }
};

export const recordPurchasePayment = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;
    const { amount, paymentMethod, notes } = req.body;

    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    const existing = await prisma.purchase.findFirst({
      where: { id: String(id), userId },
      include: { supplier: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const newAmountPaid = (existing.amountPaid || 0) + paymentAmount;
    const isFullyPaid = newAmountPaid >= (existing.grandTotal || 0) - 0.001;
    const newPaymentStatus = isFullyPaid ? 'paid' : 'partial';

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchase.update({
        where: { id: existing.id },
        data: {
          amountPaid: newAmountPaid,
          paymentStatus: newPaymentStatus,
        },
        include: {
          supplier: true,
          returns: true,
        },
      });

      if (existing.supplierId) {
        await tx.supplierTransaction.create({
          data: {
            supplierId: existing.supplierId,
            amount: paymentAmount,
            type: 'payment',
            paymentMethod: paymentMethod || 'cash',
            referenceId: existing.id,
            notes: notes || `Payment for Purchase #${existing.invoiceNumber}`,
            userId,
          },
        });

        await tx.supplier.update({
          where: { id: existing.supplierId },
          data: { payableBalance: { decrement: paymentAmount } },
        });
      }

      return updated;
    });

    res.json(result);
  } catch (error: any) {
    handleApiError(res, error, 'Failed to record purchase payment');
  }
};

export const deletePurchase = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;

    const existing = await prisma.purchase.findFirst({
      where: { id: String(id), userId },
    });

    if (existing && existing.supplierId) {
      const unpaid = Math.max(0, (existing.grandTotal || 0) - (existing.amountPaid || 0));
      if (unpaid > 0) {
        await prisma.supplier.update({
          where: { id: existing.supplierId },
          data: { payableBalance: { decrement: unpaid } },
        });
      }
    }

    await prisma.purchase.deleteMany({ where: { id: String(id), userId } });
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error, 'Failed to delete purchase');
  }
};
