import { Request, Response } from 'express';
import prisma from '../config/db';
import { getTenantUserId } from '../utils/ownerUser';

export const getCreditTransactions = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req);
    const { customerId } = req.query;

    const transactions = await prisma.creditTransaction.findMany({
      where: {
        userId,
        ...(customerId ? { customerId: String(customerId) } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch credit transactions' });
  }
};

/**
 * Records a credit purchase or a payment against a customer's due.
 * Payments also allocate FIFO against open credit sales so partial dues stay visible
 * on both the customer balance and the individual invoices.
 */
export const createCreditTransaction = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req);
    const customerId = String(req.body?.customerId || '').trim();
    const type = String(req.body?.type || '').trim().toLowerCase();
    const amount = Number(req.body?.amount);
    const notes = req.body?.notes != null ? String(req.body.notes).trim() : null;
    const referenceId = req.body?.referenceId != null ? String(req.body.referenceId) : null;

    if (!customerId) {
      return res.status(400).json({ error: 'Please choose a customer for this credit entry.' });
    }
    if (type !== 'payment' && type !== 'credit') {
      return res.status(400).json({ error: 'Credit entry type must be payment or credit.' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount greater than zero.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, userId },
      });
      if (!customer) {
        throw Object.assign(new Error('Customer not found for this store.'), { status: 404 });
      }

      let appliedAmount = amount;
      if (type === 'payment') {
        const due = Math.max(0, customer.creditBalance || 0);
        if (due <= 0.009) {
          throw Object.assign(new Error(`${customer.name} has no outstanding credit to settle.`), {
            status: 400,
          });
        }
        // Cap at current due so a partial payment (e.g. ₹500 of ₹4000) always sticks,
        // and over-payment cannot push the balance negative.
        appliedAmount = Math.min(amount, due);
      }

      const transaction = await tx.creditTransaction.create({
        data: {
          customerId,
          amount: appliedAmount,
          type,
          notes:
            notes ||
            (type === 'payment'
              ? `Partial payment of ₹${appliedAmount.toFixed(2)} received`
              : 'Credit issued'),
          referenceId,
          userId,
        },
      });

      const balanceChange = type === 'payment' ? -appliedAmount : appliedAmount;
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          creditBalance: {
            // Keep balance floor at 0 for payments even if floating-point noise appears.
            set: Math.max(0, (customer.creditBalance || 0) + balanceChange),
          },
        },
      });

      if (type === 'payment') {
        // Apply the payment to the oldest unpaid sales first (FIFO),
        // so each invoice shows how much of the due has been collected.
        const customerSales = await tx.sale.findMany({
          where: { userId, customerId },
          orderBy: { createdAt: 'asc' },
        });

        let remaining = appliedAmount;
        for (const sale of customerSales) {
          if (remaining <= 0.009) break;
          const outstanding = Math.max(0, (sale.grandTotal || 0) - (sale.amountPaid || 0));
          if (outstanding <= 0.009) continue;

          const alloc = Math.min(remaining, outstanding);
          await tx.sale.update({
            where: { id: sale.id },
            data: { amountPaid: (sale.amountPaid || 0) + alloc },
          });
          remaining -= alloc;
        }
      }

      return { transaction, customer: updatedCustomer, appliedAmount };
    });

    res.status(201).json(result.transaction);
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ error: error.message || 'Could not save credit entry.' });
    }
    console.error('createCreditTransaction error:', error);
    res.status(500).json({ error: 'Failed to create credit transaction' });
  }
};

export const deleteCreditTransaction = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req);
    const { id } = req.params;

    const transaction = await prisma.creditTransaction.findFirst({
      where: { id: String(id), userId },
    });
    if (!transaction) {
      return res.status(404).json({ error: 'Credit entry not found.' });
    }

    await prisma.$transaction(async (tx) => {
      const change = transaction.type === 'payment' ? transaction.amount : -transaction.amount;
      const customer = await tx.customer.findFirst({
        where: { id: transaction.customerId, userId },
      });
      await tx.creditTransaction.delete({ where: { id: transaction.id } });
      if (customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            creditBalance: { set: Math.max(0, (customer.creditBalance || 0) + change) },
          },
        });
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete credit transaction' });
  }
};
