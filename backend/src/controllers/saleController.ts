import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';
import { userTracksStock } from '../utils/stockTracking';

export const getSales = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    // Optional limit/page, but ALWAYS capped even when the caller sends nothing — previously this
    // returned the tenant's entire sales history unconditionally, unbounded by row count.
    const limit = Math.min(Number(req.query.limit) || 500, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const sales = await prisma.sale.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
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
    const extraChargesTotal = Number(body.extraChargesTotal) || 0;
    const billCharges = Array.isArray(body.billCharges) ? body.billCharges : null;
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
    // Multi-location inventory: which store this whole sale was billed from. Absent
    // entirely when the feature is off or no store was picked, so stock decrements
    // hit the flat Product.currentStock exactly as before (legacy path unchanged).
    const locationId =
      body.locationId && String(body.locationId).trim()
        ? String(body.locationId).trim()
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
        billCharges: billCharges as any,
        extraChargesTotal,
        paymentMethod,
        amountPaid,
        changeReturned,
        isQuickBill,
        locationId,
        platform,
        userId,
        createdAt: saleDate,
      },
    });

    const stockUpdates: Promise<void>[] = [];
    if (await userTracksStock(userId)) {
      for (const item of items) {
        const productId = item?.productId
          ? String(item.productId)
          : item?.id
            ? String(item.id)
            : '';
        const qty = Number(item?.quantity) || 0;
        if (!productId || qty <= 0 || productId.startsWith('manual-')) continue;

        stockUpdates.push(
          (async () => {
            try {
              const product = await prisma.product.findFirst({
                where: { id: productId, userId },
              });
              if (!product) {
                console.warn(`createSale: skipping stock for unknown product ${productId}`);
                return;
              }

              // Multi-location inventory: a whole sale is billed from one location
              // (locationId), so its stock decrement hits that location's own pool
              // instead of the flat Product.currentStock. Off entirely (unchanged
              // legacy path) when the feature is off (no locationId).
              if (locationId) {
                await prisma.productLocationStock.upsert({
                  where: { productId_locationId: { productId: product.id, locationId } },
                  update: { stock: { decrement: qty } },
                  create: { productId: product.id, locationId, userId, stock: -qty },
                });
              } else {
                await prisma.product.update({
                  where: { id: product.id },
                  data: { currentStock: { decrement: qty } },
                });
              }
              await prisma.stockHistory.create({
                data: {
                  change: -qty,
                  reason: 'sale',
                  productId: product.id,
                  locationId: locationId || null,
                  userId,
                  createdAt: saleDate,
                },
              });
            } catch (stockErr) {
              console.warn(`createSale: stock update failed for ${productId}`, stockErr);
            }
          })()
        );
      }
    }

    if (stockUpdates.length > 0) {
      await Promise.all(stockUpdates);
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

    const sale = await prisma.sale.findFirst({
      where: { id: String(id), userId },
      select: { id: true, invoiceNumber: true, totalTax: true },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Invoiced sales (with invoice number or tax) must be retained for legal/tax accounting audit trails
    if (sale.invoiceNumber || sale.totalTax > 0) {
      return res.status(409).json({
        error: 'Invoiced sales cannot be deleted to preserve accounting and tax audit trail integrity.',
      });
    }

    await prisma.sale.delete({
      where: { id: sale.id },
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

    if (!Array.isArray(saleIds) || saleIds.length === 0) {
      return res.status(400).json({ error: 'saleIds must be a non-empty array' });
    }

    const invoicedSales = await prisma.sale.findMany({
      where: { id: { in: saleIds }, userId, OR: [{ invoiceNumber: { not: '' } }, { totalTax: { gt: 0 } }] },
      select: { id: true },
    });

    if (invoicedSales.length > 0) {
      return res.status(409).json({
        error: 'Cannot bulk delete invoiced sales to preserve accounting and tax audit trail integrity.',
        invoicedCount: invoicedSales.length,
      });
    }

    await prisma.sale.deleteMany({
      where: { id: { in: saleIds }, userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk delete sales' });
  }
};
