import { Request, Response } from 'express';
import prisma from '../config/db';

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const expenses = await prisma.expense.findMany({
      where: { userId },
      orderBy: { expenseDate: 'desc' },
    });
    res.json(expenses);
  } catch (error) {
    console.error('getExpenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const {
      amount,
      category = 'General',
      description,
      notes,
      paymentMethod = 'cash',
      receiptImageURL,
      receiptImageUrl,
      expenseDate,
      date,
    } = req.body;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Valid expense amount is required' });
    }

    const rawDate = expenseDate || date || new Date();
    const parsedDate = new Date(rawDate);
    const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const expense = await prisma.expense.create({
      data: {
        amount: amt,
        category: category || 'General',
        description: description || notes || null,
        paymentMethod: (paymentMethod || 'cash').toLowerCase(),
        receiptImageURL: receiptImageURL || receiptImageUrl || null,
        expenseDate: validDate,
        userId,
      },
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('createExpense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
};

export const updateExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const {
      amount,
      category,
      description,
      notes,
      paymentMethod,
      receiptImageURL,
      receiptImageUrl,
      expenseDate,
      date,
    } = req.body;

    const dataToUpdate: any = {};
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!isNaN(amt)) dataToUpdate.amount = amt;
    }
    if (category !== undefined) dataToUpdate.category = category;
    if (description !== undefined || notes !== undefined) {
      dataToUpdate.description = description || notes || null;
    }
    if (paymentMethod !== undefined) {
      dataToUpdate.paymentMethod = String(paymentMethod).toLowerCase();
    }
    if (receiptImageURL !== undefined || receiptImageUrl !== undefined) {
      dataToUpdate.receiptImageURL = receiptImageURL || receiptImageUrl || null;
    }
    if (expenseDate !== undefined || date !== undefined) {
      const parsedDate = new Date(expenseDate || date);
      if (!isNaN(parsedDate.getTime())) dataToUpdate.expenseDate = parsedDate;
    }

    const updated = await prisma.expense.updateMany({
      where: { id: String(id), userId },
      data: dataToUpdate,
    });

    res.json({ success: true, count: updated.count });
  } catch (error) {
    console.error('updateExpense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    await prisma.expense.deleteMany({
      where: { id: String(id), userId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('deleteExpense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
};
