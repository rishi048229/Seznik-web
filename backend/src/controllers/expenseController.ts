import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const expenses: any[] = await prisma.$queryRaw`
      SELECT * FROM "Expense" WHERE "userId" = ${userId} ORDER BY "expenseDate" DESC
    `;
    res.json(expenses);
  } catch (error) {
    console.error('getExpenses error:', error);
    try {
      const fallbackExpenses: any[] = await prisma.$queryRaw`
        SELECT * FROM "Expense" WHERE "userId" = ${userId} ORDER BY "createdAt" DESC
      `;
      res.json(fallbackExpenses);
    } catch (err2) {
      console.error('getExpenses fallback error:', err2);
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { amount, category, description, paymentMethod, receiptImageURL, expenseDate } = req.body;
    const id = crypto.randomUUID();
    const now = new Date();
    const dateVal = expenseDate ? new Date(expenseDate) : now;
    const pm = paymentMethod || 'cash';
    const desc = description || null;
    const receipt = receiptImageURL || null;
    const amt = parseFloat(amount) || 0;

    await prisma.$executeRaw`
      INSERT INTO "Expense" ("id", "amount", "category", "description", "paymentMethod", "receiptImageURL", "expenseDate", "userId", "createdAt")
      VALUES (${id}, ${amt}, ${category}, ${desc}, ${pm}, ${receipt}, ${dateVal}, ${userId}, ${now})
    `;

    res.status(201).json({
      id,
      amount: amt,
      category,
      description: desc,
      paymentMethod: pm,
      receiptImageURL: receipt,
      expenseDate: dateVal,
      userId,
      createdAt: now,
    });
  } catch (error) {
    console.error('createExpense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
};

export const updateExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { amount, category, description, paymentMethod, receiptImageURL, expenseDate } = req.body;

    const dateVal = expenseDate ? new Date(expenseDate) : null;
    const amt = amount !== undefined ? parseFloat(amount) : null;
    const cat = category !== undefined ? category : null;
    const desc = description !== undefined ? description : null;
    const pm = paymentMethod !== undefined ? paymentMethod : null;
    const receipt = receiptImageURL !== undefined ? receiptImageURL : null;

    await prisma.$executeRaw`
      UPDATE "Expense" 
      SET 
        "amount" = COALESCE(${amt}, "amount"),
        "category" = COALESCE(${cat}, "category"),
        "description" = COALESCE(${desc}, "description"),
        "paymentMethod" = COALESCE(${pm}, "paymentMethod"),
        "receiptImageURL" = COALESCE(${receipt}, "receiptImageURL"),
        "expenseDate" = COALESCE(${dateVal}, "expenseDate")
      WHERE "id" = ${id} AND "userId" = ${userId}
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('updateExpense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    await prisma.$executeRaw`
      DELETE FROM "Expense" WHERE "id" = ${id} AND "userId" = ${userId}
    `;
    res.json({ success: true });
  } catch (error) {
    console.error('deleteExpense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
};
