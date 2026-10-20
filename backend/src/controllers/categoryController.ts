import { Request, Response } from 'express';
import prisma from '../config/db';
import { getTenantUserId } from '../utils/ownerUser';

export const getCategories = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req);
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
    const userId = getTenantUserId(req);
    const { name, parentId } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    let parentIdToUse: string | null = null;
    if (parentId) {
      const parent = await prisma.category.findFirst({ where: { id: String(parentId), userId } });
      if (!parent) {
        return res.status(400).json({ error: 'Parent category not found' });
      }
      if (parent.parentId) {
        return res.status(400).json({ error: 'Subcategories cannot be nested more than one level deep' });
      }
      parentIdToUse = parent.id;
    }

    const category = await prisma.category.create({
      data: { name: String(name).trim(), userId, isActive: true, parentId: parentIdToUse },
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req);
    const { id } = req.params;
    const { name, parentId } = req.body;

    const existing = await prisma.category.findFirst({ where: { id: String(id), userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const data: { name?: string; parentId?: string | null } = {};
    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      data.name = String(name).trim();
    }

    if (parentId !== undefined) {
      if (parentId === null || parentId === '') {
        data.parentId = null;
      } else if (String(parentId) === String(id)) {
        return res.status(400).json({ error: 'A category cannot be its own parent' });
      } else {
        const parent = await prisma.category.findFirst({ where: { id: String(parentId), userId } });
        if (!parent) {
          return res.status(400).json({ error: 'Parent category not found' });
        }
        if (parent.parentId) {
          return res.status(400).json({ error: 'Subcategories cannot be nested more than one level deep' });
        }
        const childCount = await prisma.category.count({ where: { parentId: String(id) } });
        if (childCount > 0) {
          return res.status(400).json({ error: 'This category has its own subcategories and cannot become a subcategory itself' });
        }
        data.parentId = parent.id;
      }
    }

    const category = await prisma.category.updateMany({
      where: { id: String(id), userId },
      data,
    });
    res.json({ success: true, count: category.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const toggleCategoryActive = async (req: Request, res: Response) => {
  try {
    const userId = getTenantUserId(req);
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
    const userId = getTenantUserId(req);
    const { id } = req.params;

    const category = await prisma.category.findFirst({
      where: { id: String(id), userId },
      select: { id: true, name: true },
    });
    if (!category) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const childCategories = await prisma.category.findMany({
      where: { parentId: category.id, userId },
      select: { id: true, name: true },
    });
    const categoryIds = [category.id, ...childCategories.map((c) => c.id)];

    const productCount = await prisma.product.count({
      where: { userId, categoryId: { in: categoryIds } },
    });

    if (productCount > 0) {
      const productWord = productCount === 1 ? 'product' : 'products';
      const scope =
        childCategories.length > 0
          ? `"${category.name}" (including its subcategories)`
          : `"${category.name}"`;
      return res.status(400).json({
        error: `${scope} still has ${productCount} ${productWord}. Move or remove ${productCount === 1 ? 'that product' : 'those products'} from this category, then delete it.`,
        code: 'CATEGORY_HAS_PRODUCTS',
        categoryName: category.name,
        productCount,
      });
    }

    await prisma.category.deleteMany({
      where: { id: category.id, userId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('deleteCategory error:', error);
    res.status(500).json({
      error: 'Could not delete this category. Please try again.',
    });
  }
};
