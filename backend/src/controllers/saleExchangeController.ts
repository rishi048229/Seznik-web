import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';
import { userTracksStock } from '../utils/stockTracking';
import { calculateReturnSummary, ReturnItemRequest, round2 } from '../utils/saleReturnCalculator';
import { calculateGstBill } from '../utils/gstTaxEngine';

export const createSaleExchange = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const saleId = req.params.saleId || req.params.id || req.body.originalSaleId;
    const body = req.body || {};

    if (!saleId) {
      return res.status(400).json({ error: 'Original saleId is required' });
    }

    const originalSale = await prisma.sale.findFirst({
      where: { id: String(saleId), userId },
      include: { returns: true, customer: true },
    });

    if (!originalSale) {
      return res.status(404).json({ error: 'Original sale invoice not found' });
    }

    // 1. Validate returned items (Inward Leg)
    const returnRequests: ReturnItemRequest[] = Array.isArray(body.returnedItems || body.returnItems)
      ? (body.returnedItems || body.returnItems)
      : [];

    if (returnRequests.length === 0) {
      return res.status(400).json({ error: 'At least one item must be returned for an exchange' });
    }

    const originalItems = Array.isArray(originalSale.items) ? (originalSale.items as any[]) : [];

    // 2. Validate replacement items (Outward Leg)
    const rawNewItems: any[] = Array.isArray(body.newItems || body.replacementItems)
      ? (body.newItems || body.replacementItems)
      : [];

    if (rawNewItems.length === 0) {
      return res.status(400).json({ error: 'At least one replacement item must be selected' });
    }

    // Fetch LIVE product records from DB for all products involved in exchange (both legs)
    const replacementProductIds = rawNewItems
      .map((i: any) => i.productId || i.id)
      .filter((id: any): id is string => Boolean(id) && typeof id === 'string' && !id.startsWith('manual-') && !id.startsWith('new-'));
    
    const returnProductIds = returnRequests
      .map((r: any) => r.productId || r.id)
      .filter((id: any): id is string => Boolean(id) && typeof id === 'string');

    const allProductIds = Array.from(new Set([...replacementProductIds, ...returnProductIds]));

    const liveProducts = allProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: allProductIds }, userId },
        })
      : [];

    const liveProductMap = new Map(liveProducts.map((p) => [p.id, p]));

    // Tally previously returned quantities per line item
    const previouslyReturnedMap = new Map<string, number>();
    for (const pastRet of originalSale.returns) {
      const pastItems = Array.isArray(pastRet.items) ? (pastRet.items as any[]) : [];
      for (const item of pastItems) {
        const key = String(item.productId || item.productName || item.name || '');
        if (key) {
          previouslyReturnedMap.set(key, (previouslyReturnedMap.get(key) || 0) + (Number(item.quantity) || 0));
        }
      }
    }

    // Validate quantities for returned items
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
        return res.status(400).json({ error: `Item ${reqItem.productName || reqItem.productId} was not part of original invoice` });
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
          error: `Cannot return ${requestedQty} units of ${orig.productName || orig.name}. Only ${remainingQty} units remaining on original sale.`,
        });
      }
    }

    // Inward Leg computation using live product tax mode if not explicitly saved on original line
    const enrichedOriginalItems = originalItems.map((orig: any) => {
      const prodId = orig.productId || orig.id;
      const liveProd = prodId ? liveProductMap.get(prodId) : null;
      return {
        ...orig,
        priceIncludesGst: orig.priceIncludesGst !== undefined 
          ? orig.priceIncludesGst 
          : (liveProd ? liveProd.priceIncludesGst : false),
      };
    });

    const extraChargesRefunded = Number(body.extraChargesRefunded) || 0;
    const computedReturn = calculateReturnSummary(enrichedOriginalItems, returnRequests, extraChargesRefunded);

    if (computedReturn.refundAmount <= 0) {
      return res.status(400).json({ error: 'Computed return credit value must be greater than zero' });
    }

    // Return Leg Reconciliation Invariant Check
    const returnReconSum = round2(computedReturn.subtotal + computedReturn.totalTax + computedReturn.extraChargesRefunded);
    if (Math.abs(returnReconSum - computedReturn.refundAmount) > 0.01) {
      return res.status(500).json({ error: 'Return leg reconciliation mismatch' });
    }

    // Outward Leg computation using LIVE product tax configs and pricing from DB
    const preparedNewItems = rawNewItems.map((item: any) => {
      const prodId = item.productId || item.id;
      const liveProd = prodId ? liveProductMap.get(prodId) : null;
      const qty = Math.max(1, Number(item.quantity || item.qty) || 1);
      const unitPrice = liveProd ? Number(liveProd.sellingPrice) : Number(item.price ?? item.sellingPrice ?? 0);
      const taxRate = liveProd ? Number(liveProd.taxRate) || 0 : Number(item.taxRate ?? item.gstRate ?? 0);
      const priceIncludesGst = liveProd ? Boolean(liveProd.priceIncludesGst) : Boolean(item.priceIncludesGst);
      const discount = Number(item.discount || item.discountAmount || 0);

      return {
        id: prodId,
        productId: liveProd ? liveProd.id : (item.productId || undefined),
        productName: liveProd ? liveProd.name : (item.productName || item.name || 'Product'),
        name: liveProd ? liveProd.name : (item.productName || item.name || 'Product'),
        quantity: qty,
        qty,
        price: unitPrice,
        sellingPrice: unitPrice,
        unitPrice,
        taxRate,
        gstRate: taxRate,
        priceIncludesGst,
        priceType: priceIncludesGst ? ('inclusive' as const) : ('exclusive' as const),
        discount,
      };
    });

    const calculatedBill = calculateGstBill({
      lineItems: preparedNewItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.quantity,
        gstRate: item.taxRate,
        priceType: item.priceType,
        discount: item.discount,
      })),
      roundingMode: (body.roundingMode as any) || 'none',
    });

    const newSubtotal = calculatedBill.totalTaxableValue;
    const newTotalDiscount = calculatedBill.totalDiscounts;
    const newTotalTax = calculatedBill.totalTax;
    const newGrandTotal = calculatedBill.finalInvoiceTotal;
    const newBillCharges = body.newBillCharges ?? body.newSale?.billCharges ?? null;
    const newExtraChargesTotal = round2(Number(body.newExtraChargesTotal ?? body.newSale?.extraChargesTotal ?? 0));

    if (newGrandTotal <= 0) {
      return res.status(400).json({ error: 'New replacement sale grand total must be greater than zero' });
    }

    // Stored line items for new sale
    const storedNewSaleItems = calculatedBill.lines.map((line, idx) => {
      const origInput = preparedNewItems[idx];
      return {
        productId: origInput?.productId,
        productName: line.name,
        quantity: line.qty,
        sellingPrice: origInput?.price ?? line.rawPrice,
        taxRate: line.gstRate,
        priceIncludesGst: origInput?.priceIncludesGst ?? false,
        discount: line.itemDiscountAmount,
        taxableAmount: line.lineTaxableValue,
        taxAmount: line.lineGstAmount,
        total: origInput?.priceIncludesGst ? line.lineFinalAmount : line.lineTaxableValue,
      };
    });

    // 3. Compute Net Difference Amount & Settlement (incorporating optional goodwill discount)
    const exchangeDiscount = round2(Math.max(0, Number(body.exchangeDiscount) || 0));
    const differenceAmount = round2(newGrandTotal - computedReturn.refundAmount - exchangeDiscount);

    let settlementMethod = String(body.settlementMethod || body.paymentMethod || '').trim();
    if (Math.abs(differenceAmount) < 0.01) {
      settlementMethod = 'even_exchange';
    } else if (!settlementMethod) {
      settlementMethod = differenceAmount > 0 ? 'cash' : 'cash';
    }

    const exchangeDate = body.createdAt ? new Date(body.createdAt) : new Date();
    const platform = body.platform || (req.headers['x-client-platform'] as string) || 'web';
    const locationId = body.locationId || originalSale.locationId || null;

    // 4. Generate document numbers
    const [returnCount, saleCount, exchangeCount] = await Promise.all([
      prisma.saleReturn.count({ where: { userId } }),
      prisma.sale.count({ where: { userId } }),
      prisma.saleExchange.count({ where: { userId } }),
    ]);

    const returnNumber = `CN-${String(returnCount + 1).padStart(5, '0')}`;
    const newInvoiceNumber = `INV-${String(saleCount + 1).padStart(5, '0')}`;
    const exchangeNumber = `EXC-${String(exchangeCount + 1).padStart(5, '0')}`;

    // 5. Create Inward Leg (SaleReturn)
    const saleReturn = await prisma.saleReturn.create({
      data: {
        returnNumber,
        saleId: originalSale.id,
        customerId: originalSale.customerId,
        items: computedReturn.items as any,
        subtotal: computedReturn.subtotal,
        totalTax: computedReturn.totalTax,
        extraChargesRefunded: computedReturn.extraChargesRefunded,
        refundAmount: computedReturn.refundAmount,
        refundMethod: settlementMethod,
        reason: body.reason ? String(body.reason).trim() : 'exchange',
        notes: body.notes ? `[Exchange ${exchangeNumber}] ${String(body.notes).trim()}` : `[Exchange ${exchangeNumber}] Item returned for replacement`,
        locationId,
        platform,
        userId,
        createdAt: exchangeDate,
      },
    });

    // 6. Create Outward Leg (Sale)
    const newSale = await prisma.sale.create({
      data: {
        invoiceNumber: newInvoiceNumber,
        customerId: originalSale.customerId,
        items: storedNewSaleItems as any,
        subtotal: newSubtotal,
        totalDiscount: round2(newTotalDiscount + exchangeDiscount),
        totalTax: newTotalTax,
        grandTotal: newGrandTotal,
        billCharges: newBillCharges as any,
        extraChargesTotal: newExtraChargesTotal,
        paymentMethod: settlementMethod,
        amountPaid: differenceAmount > 0 ? differenceAmount : newGrandTotal,
        changeReturned: Number(body.changeReturned) || 0,
        isQuickBill: false,
        locationId,
        platform,
        userId,
        createdAt: exchangeDate,
      },
    });

    // 7. Create Thin Linking Record (SaleExchange)
    const saleExchange = await prisma.saleExchange.create({
      data: {
        exchangeNumber,
        originalSaleId: originalSale.id,
        saleReturnId: saleReturn.id,
        newSaleId: newSale.id,
        differenceAmount,
        exchangeDiscount,
        settlementMethod,
        reason: body.reason ? String(body.reason).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        platform,
        userId,
        createdAt: exchangeDate,
      },
      include: {
        originalSale: { select: { id: true, invoiceNumber: true, grandTotal: true, createdAt: true } },
        saleReturn: true,
        newSale: true,
      },
    });

    // 8. Update original Sale returnStatus and totalRefunded
    const newTotalRefunded = round2((originalSale.totalRefunded || 0) + computedReturn.refundAmount);
    let allReturned = true;
    for (const orig of originalItems) {
      const key = String(orig.productId || orig.productName || orig.name || '');
      const pastQty = previouslyReturnedMap.get(key) || 0;
      const justReturnedItem = computedReturn.items.find(
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
      where: { id: originalSale.id },
      data: {
        totalRefunded: newTotalRefunded,
        returnStatus: nextReturnStatus,
      },
    });

    // 9. Stock Updates (Restock returned items if restock !== false; Deduct stock for new items)
    if (await userTracksStock(userId)) {
      const stockUpdates: Promise<void>[] = [];

      // A. Increment stock for returned items
      for (const item of computedReturn.items) {
        if (!item.restock || !item.productId || item.productId.startsWith('manual-')) continue;
        const qty = item.quantity;
        const prodId = item.productId;

        stockUpdates.push(
          (async () => {
            try {
              if (locationId) {
                await prisma.productLocationStock.upsert({
                  where: { productId_locationId: { productId: prodId, locationId } },
                  update: { stock: { increment: qty } },
                  create: { productId: prodId, locationId, userId, stock: qty },
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
                  reason: 'sale_exchange_inward',
                  productId: prodId,
                  locationId: locationId || null,
                  userId,
                  createdAt: exchangeDate,
                },
              });
            } catch (stockErr) {
              console.warn(`createSaleExchange: return stock increment failed for product ${prodId}`, stockErr);
            }
          })()
        );
      }

      // B. Decrement stock for outward replacement items
      for (const item of storedNewSaleItems) {
        const prodId = item?.productId ? String(item.productId) : '';
        const qty = Number(item?.quantity) || 0;
        if (!prodId || qty <= 0 || prodId.startsWith('manual-')) continue;

        stockUpdates.push(
          (async () => {
            try {
              const product = await prisma.product.findFirst({
                where: { id: prodId, userId },
              });
              if (!product) return;

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
                  reason: 'sale_exchange_outward',
                  productId: product.id,
                  locationId: locationId || null,
                  userId,
                  createdAt: exchangeDate,
                },
              });
            } catch (stockErr) {
              console.warn(`createSaleExchange: new sale stock decrement failed for product ${prodId}`, stockErr);
            }
          })()
        );
      }

      if (stockUpdates.length > 0) {
        await Promise.all(stockUpdates);
      }
    }

    // 10. Customer Credit / Ledger Update if difference amount settled via credit
    if (originalSale.customerId && (settlementMethod === 'credit_ledger' || settlementMethod === 'store_credit')) {
      try {
        if (differenceAmount > 0) {
          // Customer owes additional amount on credit
          await prisma.customer.update({
            where: { id: originalSale.customerId },
            data: { creditBalance: { increment: differenceAmount } },
          });

          await prisma.creditTransaction.create({
            data: {
              customerId: originalSale.customerId,
              amount: differenceAmount,
              type: 'charge',
              referenceId: saleExchange.id,
              notes: `Exchange Upgrade for ${originalSale.invoiceNumber} (${exchangeNumber})`,
              userId,
              createdAt: exchangeDate,
            },
          });
        } else if (differenceAmount < 0) {
          // Store owes customer credit / balance reduction
          const refundValue = Math.abs(differenceAmount);
          await prisma.customer.update({
            where: { id: originalSale.customerId },
            data: { creditBalance: { decrement: refundValue } },
          });

          await prisma.creditTransaction.create({
            data: {
              customerId: originalSale.customerId,
              amount: refundValue,
              type: 'payment',
              referenceId: saleExchange.id,
              notes: `Exchange Downgrade Credit for ${originalSale.invoiceNumber} (${exchangeNumber})`,
              userId,
              createdAt: exchangeDate,
            },
          });
        }
      } catch (creditErr) {
        console.warn('createSaleExchange: credit ledger update failed', creditErr);
      }
    }

    return res.status(201).json({
      success: true,
      exchange: saleExchange,
      saleReturn,
      newSale,
      originalSaleStatus: nextReturnStatus,
      differenceAmount,
      settlementMethod,
    });
  } catch (error: any) {
    console.error('createSaleExchange error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process exchange' });
  }
};

export const getSaleExchanges = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const exchanges = await prisma.saleExchange.findMany({
      where: { userId },
      include: {
        originalSale: {
          select: {
            id: true,
            invoiceNumber: true,
            grandTotal: true,
            createdAt: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
        saleReturn: true,
        newSale: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const total = await prisma.saleExchange.count({ where: { userId } });

    return res.json({
      data: exchanges,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('getSaleExchanges error:', error);
    return res.status(500).json({ error: 'Failed to fetch exchanges' });
  }
};

export const getExchangesForSale = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const saleId = req.params.saleId || req.params.id;

    if (!saleId) {
      return res.status(400).json({ error: 'saleId is required' });
    }

    const exchanges = await prisma.saleExchange.findMany({
      where: { userId, originalSaleId: String(saleId) },
      include: {
        saleReturn: true,
        newSale: true,
        originalSale: { select: { id: true, invoiceNumber: true, grandTotal: true, customer: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(exchanges);
  } catch (error: any) {
    console.error('getExchangesForSale error:', error);
    return res.status(500).json({ error: 'Failed to fetch exchanges for sale' });
  }
};

export const getSaleExchangeById = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;

    const exchange = await prisma.saleExchange.findFirst({
      where: { id: String(id), userId },
      include: {
        originalSale: {
          include: { customer: true },
        },
        saleReturn: true,
        newSale: true,
      },
    });

    if (!exchange) {
      return res.status(404).json({ error: 'Exchange transaction not found' });
    }

    return res.json(exchange);
  } catch (error: any) {
    console.error('getSaleExchangeById error:', error);
    return res.status(500).json({ error: 'Failed to fetch exchange' });
  }
};
