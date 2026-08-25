import { Request, Response } from 'express';
import prisma from '../config/db';

export const getTables = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tables = await prisma.restaurantTable.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        orders: {
          where: {
            status: { in: ['open', 'sent_to_kitchen', 'preparing', 'ready', 'served'] },
          },
          include: {
            items: true,
          },
        },
      },
    });

    const enriched = tables.map((t) => {
      const activeOrder = t.orders[0] || null;
      return {
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        isActive: t.isActive,
        sortOrder: t.sortOrder,
        isOccupied: !!activeOrder,
        activeOrder: activeOrder
          ? {
              id: activeOrder.id,
              orderNumber: activeOrder.orderNumber,
              status: activeOrder.status,
              itemsCount: activeOrder.items.length,
              totalAmount: activeOrder.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0),
              createdAt: activeOrder.createdAt,
            }
          : null,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('getTables error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant tables' });
  }
};

export const createTable = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, sortOrder, capacity } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    const table = await prisma.restaurantTable.create({
      data: {
        name: name.trim(),
        sortOrder: Number(sortOrder) || 0,
        capacity: capacity !== undefined && capacity !== null && capacity !== '' ? Number(capacity) : null,
        userId,
      },
    });

    res.status(201).json(table);
  } catch (error) {
    console.error('createTable error:', error);
    res.status(500).json({ error: 'Failed to create table' });
  }
};

export const updateTable = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { name, sortOrder, isActive, capacity } = req.body;

    const table = await prisma.restaurantTable.updateMany({
      where: { id: String(id), userId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(capacity !== undefined
          ? { capacity: capacity === null || capacity === '' ? null : Number(capacity) }
          : {}),
      },
    });

    res.json({ success: true, count: table.count });
  } catch (error) {
    console.error('updateTable error:', error);
    res.status(500).json({ error: 'Failed to update table' });
  }
};

export const deleteTable = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await prisma.restaurantTable.deleteMany({
      where: { id: String(id), userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('deleteTable error:', error);
    res.status(500).json({ error: 'Failed to delete table' });
  }
};
