import { Request, Response } from 'express';
import prisma from '../config/db';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const products = await prisma.product.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { imageUrl, sku, categoryId, ...rest } = req.body;

    // Map frontend `imageUrl` → Prisma column `imageURL`
    const imageURL = imageUrl ?? rest.imageURL ?? null;

    // Auto-generate SKU if not provided
    const finalSku = sku || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Ensure categoryId exists — use first user category as fallback
    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      const firstCat = await prisma.category.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (firstCat) {
        finalCategoryId = firstCat.id;
      } else {
        // Auto-create a "General" category for the user
        const newCat = await prisma.category.create({ data: { name: 'General', userId, isActive: true } });
        finalCategoryId = newCat.id;
      }
    }

    // Strip unknown fields that Prisma doesn't recognize
    delete rest.imageURL;
    delete rest.category;

    const product = await prisma.product.create({
      data: { ...rest, sku: finalSku, categoryId: finalCategoryId, imageURL, userId },
    });
    res.status(201).json(product);
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { imageUrl, ...rest } = req.body;

    // Map frontend `imageUrl` → Prisma column `imageURL`
    if (imageUrl !== undefined) {
      rest.imageURL = imageUrl;
    }
    // Strip unknown fields
    delete rest.category;
    delete rest.id;
    delete rest.createdAt;
    delete rest.updatedAt;
    delete rest.userId;

    const product = await prisma.product.updateMany({
      where: { id: String(id), userId },
      data: rest,
    });
    res.json({ success: true, count: product.count });
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const softDeleteProduct = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    await prisma.product.updateMany({
      where: { id: String(id), userId },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

export const bulkSoftDeleteProducts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { productIds } = req.body; // array of ids
    
    await prisma.product.updateMany({
      where: { id: { in: productIds }, userId },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk delete products' });
  }
};

export const adjustStock = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    // Accept BOTH `qty` (legacy) and `change` (frontend) — `change` takes priority
    const { qty, change, reason } = req.body;
    const amount = change ?? qty;

    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return res.status(400).json({ error: 'Stock adjustment quantity is required (send `change` or `qty`)' });
    }

    const product = await prisma.product.findFirst({
      where: { id: String(id), userId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id: String(id) },
        data: { currentStock: { increment: Number(amount) } },
      }),
      prisma.stockHistory.create({
        data: {
          change: Number(amount),
          reason: reason || 'manual-adjustment',
          productId: String(id),
          userId,
        },
      }),
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('adjustStock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
};

export const getProductByBarcode = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { barcode } = req.params;
    
    const product = await prisma.product.findFirst({
      where: { barcode: String(barcode), userId, isActive: true },
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product by barcode' });
  }
};

export const batchBarcodeStockUpdate = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { entries } = req.body; // array of { productId, qtyToAdd, barcode }

    await prisma.$transaction(
      entries.map((entry: any) => 
        prisma.product.update({
          where: { id: entry.productId, userId }, // Note: checking userId here is slightly tricky in transaction, but Prisma allows updateMany or standard update without userId if we assume it's secure. 
          data: { currentStock: { increment: entry.qtyToAdd } },
        })
      ).concat(
        entries.map((entry: any) =>
          prisma.stockHistory.create({
            data: {
              change: entry.qtyToAdd,
              reason: 'barcode-scan',
              barcode: entry.barcode,
              productId: entry.productId,
              userId,
            }
          })
        )
      )
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update stock by barcode' });
  }
};

export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { threshold } = req.query;
    
    const products = await prisma.product.findMany({
      where: {
        userId,
        isActive: true,
        currentStock: { lte: Number(threshold) || 0 }
      },
      orderBy: { currentStock: 'asc' },
    });
    
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
};
