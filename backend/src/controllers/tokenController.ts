import { Request, Response } from 'express';
import prisma from '../config/db';

export const getTokens = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { date } = req.query;

    const where: any = { userId };
    if (date) {
      const start = new Date(String(date));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 86400000);
      where.createdAt = { gte: start, lt: end };
    }

    const tokens = await prisma.token.findMany({
      where,
      include: { sale: true, tokenType: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
};

// Issues a token by creating a normal Sale (so it flows into Sales History,
// Reports, and the Daybook for free) plus a Token wrapper row that gives the
// printed ticket a per-day sequential number instead of an invoice number.
export const createToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { tokenTypeId, name, amount, quantity, paymentMethod, note } = req.body;

    const qty = quantity ? parseFloat(quantity) : 1;
    const unitPrice = parseFloat(amount);
    if (!unitPrice || unitPrice <= 0) {
      return res.status(400).json({ error: 'A valid amount is required' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    let tokenType = null;
    if (tokenTypeId) {
      tokenType = await prisma.tokenType.findFirst({ where: { id: String(tokenTypeId), userId } });
      if (!tokenType) {
        return res.status(400).json({ error: 'Token type not found' });
      }
    }

    const itemName = (name && String(name).trim()) || tokenType?.name || 'Quick Bill';
    const taxRate = tokenType?.taxRate ?? 0;
    const itemSubtotal = unitPrice * qty;
    const taxAmount = itemSubtotal * (taxRate / 100);
    const itemTotal = itemSubtotal + taxAmount;

    const result = await prisma.$transaction(async (tx) => {
      // Same count-based invoice numbering as saleController.createSale.
      const saleCount = await tx.sale.count({ where: { userId } });
      const invoiceNumber = `INV-${String(saleCount + 1).padStart(5, '0')}`;

      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: null,
          items: [{
            productName: itemName,
            quantity: qty,
            sellingPrice: unitPrice,
            discount: 0,
            taxRate,
            taxAmount,
            total: itemTotal,
          }],
          subtotal: itemSubtotal,
          totalDiscount: 0,
          totalTax: taxAmount,
          grandTotal: itemTotal,
          paymentMethod,
          amountPaid: itemTotal,
          changeReturned: 0,
          isQuickBill: true,
          userId,
        },
      });

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const tokenCountToday = await tx.token.count({ where: { userId, createdAt: { gte: startOfDay } } });

      const token = await tx.token.create({
        data: {
          tokenNumber: tokenCountToday + 1,
          note: note ? String(note).trim() : null,
          tokenTypeId: tokenType?.id ?? null,
          saleId: sale.id,
          userId,
        },
        include: { sale: true, tokenType: true },
      });

      return token;
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to issue token' });
  }
};

// Cancelling a token deletes its underlying Sale (the Token row cascades with
// it) — mirrors the app's existing delete-only convention for sales, there is
// no void/status concept anywhere else in the codebase.
export const deleteToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const token = await prisma.token.findFirst({ where: { id: String(id), userId } });
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    await prisma.sale.deleteMany({ where: { id: token.saleId, userId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel token' });
  }
};
