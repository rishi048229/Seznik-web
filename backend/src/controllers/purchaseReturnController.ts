import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';
import { userTracksStock } from '../utils/stockTracking';
import { calculatePurchaseReturnSummary, PurchaseReturnItemRequest, round2 } from '../utils/purchaseReturnCalculator';
import { handleApiError } from '../utils/apiErrorHandler';

export const createPurchaseReturn = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const purchaseId = req.params.purchaseId || req.params.id || req.body.purchaseId;
    const body = req.body || {};

    if (!purchaseId) {
      return res.status(400).json({ error: 'purchaseId is required' });
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id: String(purchaseId), userId },
      include: { returns: true, supplier: true },
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Original purchase record not found' });
    }

    const returnRequests: PurchaseReturnItemRequest[] = Array.isArray(body.items) ? body.items : [];
    if (returnRequests.length === 0) {
      return res.status(400).json({ error: 'At least one item must be selected for return' });
    }

    const originalItems = Array.isArray(purchase.items) ? (purchase.items as any[]) : [];

    // Tally previously returned quantities per line item to prevent over-returning
    const previouslyReturnedMap = new Map<string, number>();
    for (const pastRet of purchase.returns) {
      const pastItems = Array.isArray(pastRet.items) ? (pastRet.items as any[]) : [];
      for (const item of pastItems) {
        const key = String(item.productId || item.productName || item.name || '');
        if (key) {
          previouslyReturnedMap.set(key, (previouslyReturnedMap.get(key) || 0) + (Number(item.quantity) || 0));
        }
      }
    }

    // Validate return requests against remaining quantities
    for (const reqItem of returnRequests) {
      const key = String(reqItem.productId || reqItem.productName || reqItem.name || '');
      const orig = originalItems.find(
        (o) =>
          (o.productId && reqItem.productId && o.productId === reqItem.productId) ||
          (o.id && reqItem.id && o.id === reqItem.id) ||
          (o.productName && reqItem.productName && o.productName === reqItem.productName) ||
          (o.name && reqItem.name && o.name === reqItem.name)
      );

      if (!orig) {
        return res.status(400).json({ error: `Item ${reqItem.productName || reqItem.productId} was not part of this purchase` });
      }

      const origQty = Number(orig.quantity) || 1;
      const prevQty = previouslyReturnedMap.get(key) || 0;
      const remainingQty = origQty - prevQty;
      const requestedQty = Number(reqItem.quantity) || 0;

      if (requestedQty <= 0) {
        return res.status(400).json({ error: `Invalid return quantity for ${orig.productName || orig.name}` });
      }

      if (requestedQty > remainingQty) {
        return res.status(400).json({
          error: `Cannot return ${requestedQty} units of ${orig.productName || orig.name}. Only ${remainingQty} units remaining from original purchase.`,
        });
      }
    }

    const computed = calculatePurchaseReturnSummary(originalItems, returnRequests, {
      subtotal: purchase.subtotal,
      totalTax: purchase.totalTax,
      grandTotal: purchase.grandTotal,
      pastReturns: purchase.returns as any,
    });

    if (computed.refundAmount <= 0) {
      return res.status(400).json({ error: 'Computed debit note refund amount must be greater than zero' });
    }

    // Enforce reconciliation invariant
    const calculatedSum = round2(computed.subtotal + computed.totalTax);
    if (Math.abs(calculatedSum - computed.refundAmount) > 0.01) {
      return res.status(500).json({ error: 'Reconciliation error: subtotal + totalTax does not match refundAmount' });
    }

    // Generate sequential Debit Note Number (DN-00001) for this tenant
    const count = await prisma.purchaseReturn.count({ where: { userId } });
    const returnNumber = `DN-${String(count + 1).padStart(5, '0')}`;

    const settlementMethod = String(body.settlementMethod || 'adjust_against_payable');
    const returnDate = body.createdAt ? new Date(body.createdAt) : new Date();

    const tracksStock = await userTracksStock(userId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create PurchaseReturn record
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          returnNumber,
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          items: computed.items as any,
          subtotal: computed.subtotal,
          totalTax: computed.totalTax,
          refundAmount: computed.refundAmount,
          settlementMethod,
          reason: body.reason ? String(body.reason).trim() : null,
          notes: body.notes ? String(body.notes).trim() : null,
          platform: body.platform || (req.headers['x-client-platform'] as string) || 'web',
          userId,
          createdAt: returnDate,
        },
      });

      // 2. Update original Purchase record status and totalReturned
      const newTotalReturned = round2((purchase.totalReturned || 0) + computed.refundAmount);

      let allReturned = true;
      for (const orig of originalItems) {
        const key = String(orig.productId || orig.productName || orig.name || '');
        const pastQty = previouslyReturnedMap.get(key) || 0;
        const justReturnedItem = computed.items.find(
          (i) => (i.productId && orig.productId && i.productId === orig.productId) || i.productName === (orig.productName || orig.name)
        );
        const justReturnedQty = justReturnedItem ? justReturnedItem.quantity : 0;
        if (pastQty + justReturnedQty < (Number(orig.quantity) || 1)) {
          allReturned = false;
          break;
        }
      }

      const nextReturnStatus = allReturned ? 'full' : 'partial';

      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          totalReturned: newTotalReturned,
          returnStatus: nextReturnStatus,
        },
      });

      // 3. Stock Movement: Decrement stock (StockHistory: change: -quantity, reason: 'purchase_return')
      if (tracksStock) {
        for (const item of computed.items) {
          if (!item.productId) continue;
          const qty = item.quantity;
          const prodId = item.productId;

          await tx.product.update({
            where: { id: prodId },
            data: { currentStock: { decrement: qty } },
          });

          await tx.stockHistory.create({
            data: {
              change: -qty,
              reason: 'purchase_return',
              productId: prodId,
              userId,
              createdAt: returnDate,
            },
          });
        }
      }

      // 4. Update Supplier Payable Balance & Ledger if adjust_against_payable or supplier credit
      if (purchase.supplierId && (settlementMethod === 'adjust_against_payable' || settlementMethod === 'supplier_credit')) {
        await tx.supplierTransaction.create({
          data: {
            supplierId: purchase.supplierId,
            amount: computed.refundAmount,
            type: 'debit_note_reversal',
            paymentMethod: settlementMethod,
            referenceId: purchaseReturn.id,
            notes: `Debit Note #${returnNumber} (Return on #${purchase.invoiceNumber})`,
            userId,
            createdAt: returnDate,
          },
        });

        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: { payableBalance: { decrement: computed.refundAmount } },
        });
      }

      return { purchaseReturn, nextReturnStatus, newTotalReturned };
    });

    return res.status(201).json({
      success: true,
      purchaseReturn: result.purchaseReturn,
      purchaseStatus: result.nextReturnStatus,
      totalReturned: result.newTotalReturned,
    });
  } catch (error: any) {
    return handleApiError(res, error, 'Failed to process purchase return. Please verify items and returned quantities.');
  }
};

export const getPurchaseReturns = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const returns = await prisma.purchaseReturn.findMany({
      where: { userId },
      include: {
        purchase: { select: { id: true, invoiceNumber: true, grandTotal: true, createdAt: true } },
        supplier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const total = await prisma.purchaseReturn.count({ where: { userId } });

    res.json({
      returns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase returns' });
  }
};

export const getReturnsForPurchase = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const purchaseId = req.params.purchaseId || req.params.id;

    const returns = await prisma.purchaseReturn.findMany({
      where: { purchaseId: String(purchaseId), userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(returns);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch returns for purchase' });
  }
};

export const getPurchaseReturnById = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;

    const purchaseReturn = await prisma.purchaseReturn.findFirst({
      where: { id: String(id), userId },
      include: {
        purchase: true,
        supplier: true,
      },
    });

    if (!purchaseReturn) {
      return res.status(404).json({ error: 'Purchase return not found' });
    }

    res.json(purchaseReturn);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase return details' });
  }
};
