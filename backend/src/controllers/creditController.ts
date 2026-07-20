import { Request, Response } from 'express';
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
