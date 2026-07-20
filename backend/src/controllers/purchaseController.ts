import { Request, Response } from 'express';
import prisma from '../config/db';

export const getPurchases = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const purchases = await prisma.purchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
};

export const getPurchaseById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const purchase = await prisma.purchase.findFirst({
      where: { id: String(id), userId },
    });
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
};

export const createPurchase = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const data = req.body;
    
    const count = await prisma.purchase.count({ where: { userId } });
    const invoiceNumber = `PUR-${String(count + 1).padStart(5, '0')}`;
    
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          ...data,
          invoiceNumber,
          userId,
        },
      });

      // Update product stock (increase for purchase)
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: item.quantity }, costPrice: item.costPrice } // Update cost price to latest
            });
            await tx.stockHistory.create({
              data: {
                change: item.quantity,
                reason: 'purchase',
                productId: item.productId,
                userId
              }
            });
          }
        }
      }
      return purchase;
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create purchase' });
  }
};

export const deletePurchase = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    await prisma.purchase.deleteMany({
      where: { id: String(id), userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete purchase' });
  }
};
