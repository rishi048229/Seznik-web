import { Request, Response } from 'express';
import prisma from '../config/db';

export const getSales = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const sales = await prisma.sale.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
};

export const getSaleById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const sale = await prisma.sale.findFirst({
      where: { id: String(id), userId },
    });
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
};

export const createSale = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    // Strip any fields the frontend sends that don't exist in the Sale Prisma model
    const { notes, id: _id, invoiceNumber: _inv, ...data } = req.body;
    
    // Generate invoice number. In a real app, use a sequence or locked counter.
    // Here we just count existing sales to generate a number.
    const count = await prisma.sale.count({ where: { userId } });
    const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;
    
    // Parse custom bill date if provided, otherwise default to now
    const saleDate = data.createdAt ? new Date(data.createdAt) : new Date();

    // Use a transaction for creating sale, updating stock, and updating customer credit
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          ...data,
          invoiceNumber,
          userId,
          createdAt: saleDate,
        },
      });

      // Update product stock
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          let targetProductId = item.productId || '';
          if (!targetProductId && item.productName) {
            const foundProd = await tx.product.findFirst({
              where: {
                userId,
                name: { equals: String(item.productName).trim(), mode: 'insensitive' },
                isActive: { not: false },
              },
            });
            if (foundProd) {
              targetProductId = foundProd.id;
            }
          }

          if (targetProductId) {
            const prod = await tx.product.findFirst({
              where: { id: targetProductId, userId },
            });
            if (prod) {
              await tx.product.update({
                where: { id: targetProductId },
                data: { currentStock: { decrement: item.quantity } },
              });
              await tx.stockHistory.create({
                data: {
                  change: -item.quantity,
                  reason: 'sale',
                  productId: targetProductId,
                  userId,
                  createdAt: saleDate,
                },
              });
            }
          }
        }
      }

      // Update customer credit whenever there is an unpaid balance for a registered customer
      const unpaid = data.grandTotal - (data.amountPaid || 0);
      if (unpaid > 0.01 && data.customerId) {
        await tx.customer.update({
          where: { id: data.customerId },
          data: { creditBalance: { increment: unpaid } }
        });
        
        await tx.creditTransaction.create({
          data: {
            customerId: data.customerId,
            amount: unpaid,
            type: 'credit',
            referenceId: sale.id,
            notes: `Credit for Sale ${invoiceNumber}`,
            userId,
            createdAt: saleDate,
          }
        });
      }

      return sale;
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create sale' });
  }
};

export const getSalesByDateRange = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { start, end } = req.query; // Expect ISO strings
    const sales = await prisma.sale.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(start as string),
          lte: new Date(end as string),
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales by date range' });
  }
};

export const deleteSale = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    await prisma.sale.deleteMany({
      where: { id: String(id), userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete sale' });
  }
};

export const bulkDeleteSales = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { saleIds } = req.body;
    await prisma.sale.deleteMany({
      where: { id: { in: saleIds }, userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk delete sales' });
  }
};
