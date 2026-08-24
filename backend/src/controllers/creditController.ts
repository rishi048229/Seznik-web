import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';

export const getCreditTransactions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { customerId } = req.query;
    
    const transactions = await prisma.creditTransaction.findMany({
      where: {
        userId,
        ...(customerId ? { customerId: String(customerId) } : {})
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch credit transactions' });
  }
};

export const createCreditTransaction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const data = req.body;
    
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.creditTransaction.create({
        data: {
          ...data,
          userId,
        },
      });

      // Update customer credit balance
      // If it's a payment, it reduces credit balance. If it's credit, it increases.
      const change = data.type === 'payment' ? -data.amount : data.amount;
      await tx.customer.update({
        where: { id: data.customerId },
        data: { creditBalance: { increment: change } }
      });

      return transaction;
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create credit transaction' });
  }
};

export const deleteCreditTransaction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    // Deleting should reverse the balance, but for now we just delete
    const transaction = await prisma.creditTransaction.findFirst({ where: { id: String(id), userId } });
    if (transaction) {
      const change = transaction.type === 'payment' ? transaction.amount : -transaction.amount;
      await prisma.$transaction([
        prisma.creditTransaction.delete({ where: { id: String(id) } }),
        prisma.customer.update({
          where: { id: transaction.customerId },
          data: { creditBalance: { increment: change } }
        })
      ]);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete credit transaction' });
  }
};

export const getCustomerLedger = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const customerId = String(req.params.customerId);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const sales = await prisma.sale.findMany({
      where: { customerId, userId },
      orderBy: { createdAt: 'desc' },
    });

    const transactions = await prisma.creditTransaction.findMany({
      where: { customerId, userId },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate customer metrics
    const totalSpent = sales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
    const totalVisits = sales.length;
    const lastVisitAt = sales[0]?.createdAt ? sales[0].createdAt.toISOString() : null;

    // Bills: all sales with their items and outstanding payment
    const bills = sales.map((s) => {
      const items = Array.isArray(s.items) ? (s.items as any) : [];
      const outstanding = Math.max(0, (s.grandTotal || 0) - (s.amountPaid || 0));
      return {
        id: s.id,
        type: 'sale' as const,
        invoiceNumber: s.invoiceNumber,
        items,
        notes: null,
        originalAmount: s.grandTotal,
        outstandingAmount: outstanding,
        isPaid: (s.amountPaid || 0) >= (s.grandTotal || 0),
        date: s.createdAt.toISOString(),
      };
    });

    // Oldest unpaid bill
    const unpaidBills = bills.filter((b) => !b.isPaid);
    const oldestUnpaid = unpaidBills.length > 0 ? unpaidBills[unpaidBills.length - 1] : null;
    let daysOverdue = 0;
    let ageingBucket: '0-7' | '8-15' | '16-30' | '30+' | null = null;

    if (oldestUnpaid) {
      const diffMs = Date.now() - new Date(oldestUnpaid.date).getTime();
      daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      if (daysOverdue <= 7) ageingBucket = '0-7';
      else if (daysOverdue <= 15) ageingBucket = '8-15';
      else if (daysOverdue <= 30) ageingBucket = '16-30';
      else ageingBucket = '30+';
    }

    // Customer invoices array format
    const customerInvoices = sales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      items: Array.isArray(s.items) ? (s.items as any) : [],
      grandTotal: s.grandTotal,
      paymentMethod: s.paymentMethod,
      amountPaid: s.amountPaid,
      createdAt: s.createdAt.toISOString(),
    }));

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        creditBalance: customer.creditBalance,
        creditLimit: customer.creditLimit,
        oldestUnpaidSince: oldestUnpaid?.date || null,
        daysOverdue,
        ageingBucket,
        customerSince: customer.createdAt.toISOString(),
        totalSpent,
        totalVisits,
        lastVisitAt,
      },
      transactions,
      bills,
      sales: customerInvoices,
    });
  } catch (error) {
    console.error('getCustomerLedger error:', error);
    res.status(500).json({ error: 'Failed to fetch customer ledger' });
  }
};

interface OldestSaleRow {
  id: string;
  customerId: string | null;
  invoiceNumber: string;
  items: unknown;
  grandTotal: number;
  amountPaid: number;
  createdAt: Date;
}

export const getRemindersDue = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const thresholdDays = Number(req.query.thresholdDays) || 0;

    // Previously this did customer.findMany({ include: { sales: {...} } }) — eagerly loading
    // EVERY sale ever made for every customer with a balance, just to find each one's oldest
    // unpaid sale. Split into (1) a plain, unindexed-relation-free customer lookup, then (2) one
    // set-based query that returns exactly one relevant sale per customer.
    const customersWithCredit = await prisma.customer.findMany({
      where: { userId, creditBalance: { gt: 0 } },
      select: { id: true, name: true, phone: true, creditBalance: true, updatedAt: true },
    });

    const customerIds = customersWithCredit.map((c) => c.id);

    // DISTINCT ON (customerId), ordered by (unpaid-first, then oldest) gives exactly the same
    // pick as the old `unpaidSales[0] || c.sales[0]`: the oldest unpaid sale if one exists,
    // otherwise the oldest sale overall.
    const oldestSales = customerIds.length
      ? await prisma.$queryRaw<OldestSaleRow[]>(Prisma.sql`
          SELECT DISTINCT ON (s."customerId")
            s.id, s."customerId", s."invoiceNumber", s.items, s."grandTotal", s."amountPaid", s."createdAt"
          FROM "Sale" s
          WHERE s."userId" = ${userId} AND s."customerId" IN (${Prisma.join(customerIds)})
          ORDER BY s."customerId",
            CASE WHEN s."amountPaid" < s."grandTotal" THEN 0 ELSE 1 END ASC,
            s."createdAt" ASC
        `)
      : [];
    const oldestSaleByCustomerId = new Map(oldestSales.map((s) => [s.customerId, s]));

    const remindersDue = customersWithCredit.map((c) => {
      const oldestSale = oldestSaleByCustomerId.get(c.id);
      const oldestDate = oldestSale?.createdAt || c.updatedAt;
      const diffMs = Date.now() - new Date(oldestDate).getTime();
      const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      let ageingBucket: '0-7' | '8-15' | '16-30' | '30+' = '0-7';
      if (daysOverdue <= 7) ageingBucket = '0-7';
      else if (daysOverdue <= 15) ageingBucket = '8-15';
      else if (daysOverdue <= 30) ageingBucket = '16-30';
      else ageingBucket = '30+';

      const oldestUnpaidBill = oldestSale ? {
        id: oldestSale.id,
        type: 'sale' as const,
        invoiceNumber: oldestSale.invoiceNumber,
        items: Array.isArray(oldestSale.items) ? (oldestSale.items as any) : [],
        notes: null,
        originalAmount: oldestSale.grandTotal,
        outstandingAmount: Math.max(0, oldestSale.grandTotal - oldestSale.amountPaid),
        isPaid: false,
        date: oldestSale.createdAt.toISOString(),
      } : null;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        creditBalance: c.creditBalance,
        oldestUnpaidSince: oldestDate.toISOString(),
        daysOverdue,
        ageingBucket,
        lastReminderSentAt: null,
        oldestUnpaidBill,
      };
    }).filter((r) => r.daysOverdue >= thresholdDays);

    res.json(remindersDue);
  } catch (error) {
    console.error('getRemindersDue error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders due' });
  }
};

export const logReminderSent = async (req: Request, res: Response) => {
  try {
    const { customerId, amount } = req.body;
    res.json({
      id: `REM-${Date.now()}`,
      customerId,
      amount: Number(amount) || 0,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log reminder' });
  }
};
