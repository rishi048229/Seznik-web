import { Request, Response } from 'express';
import prisma from '../config/db';

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const suppliers = await prisma.supplier.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const data = req.body;
    
    const supplier = await prisma.supplier.create({
      data: { ...data, userId },
    });
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create supplier' });
  }
};

export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const data = req.body;
    
    const supplier = await prisma.supplier.updateMany({
      where: { id: String(id), userId },
      data,
    });
    res.json({ success: true, count: supplier.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update supplier' });
  }
};

export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    await prisma.supplier.deleteMany({
      where: { id: String(id), userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
};
