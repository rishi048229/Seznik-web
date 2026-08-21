import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';

export const getSales = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const sales = await prisma.sale.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
};

export const getSaleById = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;
    const sale = await prisma.sale.findFirst({
      where: { id: String(id), userId },
    });
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
};

export const createSale = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const body = req.body || {};

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'At least one sale item is required' });
    }

    const subtotal = Number(body.subtotal) || 0;
    const totalDiscount = Number(body.totalDiscount) || 0;
    const totalTax = Number(body.totalTax) || 0;
    const grandTotal = Number(body.grandTotal) || 0;
    const paymentMethod = String(body.paymentMethod || 'cash');
    const amountPaid = Number(body.amountPaid ?? grandTotal);
    const changeReturned = Number(body.changeReturned) || 0;
    const isQuickBill = Boolean(body.isQuickBill);
    const platform =
      body.platform || (req.headers['x-client-platform'] as string) || 'mobile';
    const customerId =
      body.customerId && String(body.customerId).trim()
        ? String(body.customerId).trim()
        : null;
    const saleDate = body.createdAt ? new Date(body.createdAt) : new Date();
    if (Number.isNaN(saleDate.getTime())) {
      return res.status(400).json({ error: 'Invalid sale date' });
    }

    const count = await prisma.sale.count({ where: { userId } });
    const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;

    // Create the sale record first — avoid Prisma interactive $transaction on RDS
    // (P2028 "Transaction not found" when stock updates run inside a long-lived tx).
    const sale = await prisma.sale.create({
      data: {
        invoiceNumber,
        customerId,
        items: items as any,
        subtotal,
        totalDiscount,
        totalTax,
        grandTotal,
        paymentMethod,
        amountPaid,
        changeReturned,
        isQuickBill,
        platform,
        userId,
        createdAt: saleDate,
      },
    });

    for (const item of items) {
      const productId = item?.productId
        ? String(item.productId)
        : item?.id
          ? String(item.id)
          : '';
      const qty = Number(item?.quantity) || 0;
      if (!productId || qty <= 0 || productId.startsWith('manual-')) continue;

      try {
        const product = await prisma.product.findFirst({
          where: { id: productId, userId },
        });
        if (!product) {
          console.warn(`createSale: skipping stock for unknown product ${productId}`);
          continue;
        }

        await prisma.product.update({
          where: { id: product.id },
          data: { currentStock: { decrement: qty } },
        });
        await prisma.stockHistory.create({
          data: {
            change: -qty,
            reason: 'sale',
            productId: product.id,
            userId,
            createdAt: saleDate,
          },
        });
      } catch (stockErr) {
        console.warn(`createSale: stock update failed for ${productId}`, stockErr);
      }
    }

    const unpaid = grandTotal - amountPaid;
    if (unpaid > 0.01 && customerId) {
      try {
        const customer = await prisma.customer.findFirst({
          where: { id: customerId, userId },
        });
        if (customer) {
          await prisma.customer.update({
            where: { id: customerId },
            data: { creditBalance: { increment: unpaid } },
          });
          await prisma.creditTransaction.create({
            data: {
              customerId,
              amount: unpaid,
              type: 'credit',
              referenceId: sale.id,
              notes: `Credit for Sale ${invoiceNumber}`,
              userId,
              createdAt: saleDate,
            },
          });
        }
      } catch (creditErr) {
        console.warn('createSale: credit update failed (sale was saved)', creditErr);
      }
    }

    res.status(201).json(sale);
  } catch (error: any) {
    console.error('createSale error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to create sale',
    });
  }
};

export const getSalesByDateRange = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { start, end } = req.query; // Expect ISO strings
    const sales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(start as string),
          lte: new Date(end as string),
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales by date range' });
  }
};

export const deleteSale = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;
    await prisma.sale.deleteMany({
      where: { id: String(id), userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete sale' });
  }
};

export const bulkDeleteSales = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { saleIds } = req.body;
    await prisma.sale.deleteMany({
      where: { id: { in: saleIds }, userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk delete sales' });
  }
};
