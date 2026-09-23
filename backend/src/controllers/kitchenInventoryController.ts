import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';

export const getSummary = async (req: Request, res: Response) => {
  const userId = await getOwnerUserId((req as any).user.id);
  const rows = await prisma.kitchenIngredient.findMany({
    where: { userId },
    select: { currentStock: true, lowStockThreshold: true },
  });
  const lowStock = rows.filter((r) => r.currentStock > 0 && r.currentStock <= r.lowStockThreshold).length;
  const outOfStock = rows.filter((r) => r.currentStock <= 0).length;
  res.json({ tracked: rows.length, lowStock, outOfStock });
};

export const listIngredients = async (req: Request, res: Response) => {
  const userId = await getOwnerUserId((req as any).user.id);
  const rows = await prisma.kitchenIngredient.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
  res.json(rows);
};

export const createIngredient = async (req: Request, res: Response) => {
  const userId = await getOwnerUserId((req as any).user.id);
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Ingredient name is required' });
  const row = await prisma.kitchenIngredient.create({
    data: {
      userId,
      name,
      unit: String(req.body.unit || 'g'),
      currentStock: Number(req.body.currentStock) || 0,
      lowStockThreshold: Number(req.body.lowStockThreshold) || 0,
    },
  });
  res.status(201).json(row);
};

export const addStock = async (req: Request, res: Response) => {
  const userId = await getOwnerUserId((req as any).user.id);
  const id = String(req.params.id);
  const quantity = Number(req.body.quantity) || 0;
  if (quantity <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero' });
  const existing = await prisma.kitchenIngredient.findFirst({ where: { id, userId } });
  if (!existing) return res.status(404).json({ error: 'Ingredient not found' });
  const row = await prisma.kitchenIngredient.update({
    where: { id },
    data: { currentStock: { increment: quantity } },
  });
  if (req.body.supplierName || req.body.asPurchase) {
    await prisma.kitchenPurchase.create({
      data: {
        userId,
        ingredientId: id,
        quantity,
        supplierName: req.body.supplierName ? String(req.body.supplierName) : null,
      },
    });
  }
  res.json(row);
};

export const logWastage = async (req: Request, res: Response) => {
  const userId = await getOwnerUserId((req as any).user.id);
  const ingredientId = String(req.body.ingredientId || '');
  const quantity = Number(req.body.quantity) || 0;
  if (!ingredientId || quantity <= 0) {
    return res.status(400).json({ error: 'Ingredient and quantity are required' });
  }
  const existing = await prisma.kitchenIngredient.findFirst({ where: { id: ingredientId, userId } });
  if (!existing) return res.status(404).json({ error: 'Ingredient not found' });
  await prisma.kitchenIngredient.update({
    where: { id: ingredientId },
    data: { currentStock: { decrement: quantity } },
  });
  const log = await prisma.wastageLog.create({
    data: { userId, ingredientId, quantity, reason: req.body.reason ? String(req.body.reason) : null },
  });
  res.status(201).json(log);
};

export const listRecipes = async (req: Request, res: Response) => {
  const userId = await getOwnerUserId((req as any).user.id);
  const productId = req.query.productId ? String(req.query.productId) : undefined;
  const rows = await prisma.recipeLine.findMany({
    where: { userId, ...(productId ? { productId } : {}) },
  });
  res.json(rows);
};

export const saveRecipeLine = async (req: Request, res: Response) => {
  const userId = await getOwnerUserId((req as any).user.id);
  const productId = String(req.body.productId || '');
  const ingredientId = String(req.body.ingredientId || '');
  const quantity = Number(req.body.quantity) || 0;
  if (!productId || !ingredientId || quantity <= 0) {
    return res.status(400).json({ error: 'Menu item, ingredient, and quantity are required' });
  }
  const row = await prisma.recipeLine.create({
    data: { userId, productId, ingredientId, quantity },
  });
  res.status(201).json(row);
};
