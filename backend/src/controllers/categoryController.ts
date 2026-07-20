import { Request, Response } from 'express';
import prisma from '../config/db';

export const getCategories = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name } = req.body;
    
    const category = await prisma.category.create({
      data: { name, userId, isActive: true },
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { name } = req.body;
    
    const category = await prisma.category.updateMany({
      where: { id: String(id), userId },
      data: { name },
    });
    res.json({ success: true, count: category.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const toggleCategoryActive = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { isActive } = req.body;
    
    const category = await prisma.category.updateMany({
      where: { id: String(id), userId },
      data: { isActive },
    });
    res.json({ success: true, count: category.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    await prisma.category.deleteMany({
      where: { id: String(id), userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
