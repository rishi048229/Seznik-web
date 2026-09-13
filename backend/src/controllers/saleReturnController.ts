import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';
import { userTracksStock } from '../utils/stockTracking';
import { calculateReturnSummary, ReturnItemRequest, round2 } from '../utils/saleReturnCalculator';

export const createSaleReturn = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const saleId = req.params.saleId || req.params.id;
    const body = req.body || {};

    if (!saleId) {
      return res.status(400).json({ error: 'saleId is required' });
    }

    const sale = await prisma.sale.findFirst({
      where: { id: String(saleId), userId },
      include: { returns: true, customer: true },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Original sale invoice not found' });
    }

    const returnRequests: ReturnItemRequest[] = Array.isArray(body.items) ? body.items : [];
    if (returnRequests.length === 0) {
      return res.status(400).json({ error: 'At least one item must be selected for return' });
    }

    const originalItems = Array.isArray(sale.items) ? (sale.items as any[]) : [];

    // Tally previously returned quantities per line item to prevent over-returning
    const previouslyReturnedMap = new Map<string, number>();
    for (const pastRet of sale.returns) {
      const pastItems = Array.isArray(pastRet.items) ? (pastRet.items as any[]) : [];
      for (const item of pastItems) {
        const key = String(item.productId || item.productName || item.name || '');
        if (key) {
          previouslyReturnedMap.set(key, (previouslyReturnedMap.get(key) || 0) + (Number(item.quantity) || 0));
        }
      }
    }

    // Validate quantities
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
        return res.status(400).json({ error: `Item ${reqItem.productName || reqItem.productId} was not part of this invoice` });
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
          error: `Cannot return ${requestedQty} units of ${orig.productName || orig.name}. Only ${remainingQty} units remaining from original sale.`,
        });
      }
    }

    const extraChargesRefunded = Number(body.extraChargesRefunded) || 0;
    const computed = calculateReturnSummary(originalItems, returnRequests, extraChargesRefunded, {
      subtotal: sale.subtotal,
      totalDiscount: sale.totalDiscount,
      totalTax: sale.totalTax,
      grandTotal: sale.grandTotal,
      extraChargesTotal: sale.extraChargesTotal,
      pastReturns: sale.returns,
    });

    if (computed.refundAmount <= 0) {
      return res.status(400).json({ error: 'Computed refund amount must be greater than zero' });
    }

    // Invariant check
    const calculatedSum = round2(computed.subtotal + computed.totalTax + computed.extraChargesRefunded);
    if (Math.abs(calculatedSum - computed.refundAmount) > 0.01) {
      return res.status(500).json({ error: 'Reconciliation error: subtotal + totalTax does not match refundAmount' });
    }

    // Generate sequential Credit Note / Return Number for this tenant
    const count = await prisma.saleReturn.count({ where: { userId } });
    const returnNumber = `CN-${String(count + 1).padStart(5, '0')}`;

    const refundMethod = String(body.refundMethod || 'cash');
    const returnDate = body.createdAt ? new Date(body.createdAt) : new Date();

    const saleReturn = await prisma.saleReturn.create({
      data: {
        returnNumber,
        saleId: sale.id,
        customerId: sale.customerId,
        items: computed.items as any,
        subtotal: computed.subtotal,
        totalTax: computed.totalTax,
        extraChargesRefunded: computed.extraChargesRefunded,
        refundAmount: computed.refundAmount,
        refundMethod,
        reason: body.reason ? String(body.reason).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        locationId: sale.locationId,
        platform: body.platform || (req.headers['x-client-platform'] as string) || 'web',
        userId,
        createdAt: returnDate,
      },
    });

    // Update original Sale record
    const newTotalRefunded = round2((sale.totalRefunded || 0) + computed.refundAmount);

    // Compute whether all items on the sale are now returned
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

    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        totalRefunded: newTotalRefunded,
        returnStatus: nextReturnStatus,
      },
    });

    // Inventory Restoration
    if (await userTracksStock(userId)) {
      const stockUpdates: Promise<void>[] = [];

      for (const item of computed.items) {
        if (!item.restock || !item.productId || item.productId.startsWith('manual-')) continue;
        const qty = item.quantity;
        const prodId = item.productId;

        stockUpdates.push(
          (async () => {
            try {
              if (sale.locationId) {
                await prisma.productLocationStock.upsert({
                  where: { productId_locationId: { productId: prodId, locationId: sale.locationId } },
                  update: { stock: { increment: qty } },
                  create: { productId: prodId, locationId: sale.locationId, userId, stock: qty },
                });
              } else {
                await prisma.product.update({
                  where: { id: prodId },
                  data: { currentStock: { increment: qty } },
                });
              }

              await prisma.stockHistory.create({
                data: {
                  change: qty,
                  reason: 'sale_return',
                  productId: prodId,
                  locationId: sale.locationId || null,
                  userId,
                  createdAt: returnDate,
                },
              });
            } catch (stockErr) {
              console.warn(`createSaleReturn: stock restoration failed for product ${prodId}`, stockErr);
            }
          })()
        );
      }

      if (stockUpdates.length > 0) {
        await Promise.all(stockUpdates);
      }
    }

    // Customer Credit / Ledger Reversal (if applicable)
    if (sale.customerId && (refundMethod === 'credit_reversal' || refundMethod === 'store_credit')) {
      try {
        await prisma.customer.update({
          where: { id: sale.customerId },
          data: { creditBalance: { decrement: computed.refundAmount } },
        });

        await prisma.creditTransaction.create({
          data: {
            customerId: sale.customerId,
            amount: computed.refundAmount,
            type: 'payment',
            referenceId: saleReturn.id,
            notes: `Refund / Return for ${sale.invoiceNumber} (${returnNumber})`,
            userId,
            createdAt: returnDate,
          },
        });
      } catch (creditErr) {
        console.warn('createSaleReturn: credit ledger update failed', creditErr);
      }
    }

    return res.status(201).json({
      success: true,
      saleReturn,
      saleStatus: nextReturnStatus,
      totalRefunded: newTotalRefunded,
    });
  } catch (error: any) {
    console.error('createSaleReturn error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process return' });
  }
};

export const getSaleReturns = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const returns = await prisma.saleReturn.findMany({
      where: { userId },
      include: {
        sale: { select: { id: true, invoiceNumber: true, grandTotal: true, createdAt: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const total = await prisma.saleReturn.count({ where: { userId } });

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
    res.status(500).json({ error: 'Failed to fetch sales returns' });
  }
};

export const getReturnsForSale = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const saleId = req.params.saleId || req.params.id;

    const returns = await prisma.saleReturn.findMany({
      where: { saleId: String(saleId), userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(returns);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch returns for sale' });
  }
};

export const getSaleReturnById = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;

    const saleReturn = await prisma.saleReturn.findFirst({
      where: { id: String(id), userId },
      include: {
        sale: true,
        customer: true,
      },
    });

    if (!saleReturn) {
      return res.status(404).json({ error: 'Sales return not found' });
    }

    res.json(saleReturn);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch return details' });
  }
};
