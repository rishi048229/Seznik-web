import { Request, Response } from 'express';
import prisma from '../config/db';

// Multi-location inventory (opt-in feature — see Settings.locationConfig).
// Mirrors categoryController.ts's CRUD pattern field-for-field.

export const getLocations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const locations = await prisma.location.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(locations);
  } catch (error) {
    console.error('Failed to fetch locations:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to fetch locations: ${detail}` });
  }
};

export const createLocation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, sortOrder } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const location = await prisma.location.create({
      data: { name: String(name).trim(), userId, isActive: true, sortOrder: Number(sortOrder) || 0 },
    });
    res.status(201).json(location);
  } catch (error) {
    console.error('Failed to create location:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to create location: ${detail}` });
  }
};

export const updateLocation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { name, sortOrder } = req.body;

    const existing = await prisma.location.findFirst({ where: { id: String(id), userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const data: { name?: string; sortOrder?: number } = {};
    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: 'Location name is required' });
      }
      data.name = String(name).trim();
    }
    if (sortOrder !== undefined) {
      data.sortOrder = Number(sortOrder) || 0;
    }

    const location = await prisma.location.updateMany({ where: { id: String(id), userId }, data });
    res.json({ success: true, count: location.count });
  } catch (error) {
    console.error('Failed to update location:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to update location: ${detail}` });
  }
};

export const toggleLocationActive = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { isActive } = req.body;

    const location = await prisma.location.updateMany({ where: { id: String(id), userId }, data: { isActive } });
    res.json({ success: true, count: location.count });
  } catch (error) {
    console.error('Failed to toggle location:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to toggle location: ${detail}` });
  }
};

export const deleteLocation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await prisma.location.deleteMany({ where: { id: String(id), userId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete location:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to delete location: ${detail}` });
  }
};

// Every product's stock + price at one location — drives the Location page's
// stock table and the product edit modal's "Stock by Location" section.
export const getLocationStock = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const location = await prisma.location.findFirst({ where: { id: String(id), userId } });
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const stocks = await prisma.productLocationStock.findMany({
      where: { locationId: String(id), userId },
      include: { product: { select: { id: true, name: true, sku: true, barcode: true, sellingPrice: true, currentStock: true } } },
    });
    res.json(stocks);
  } catch (error) {
    console.error('Failed to fetch location stock:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to fetch location stock: ${detail}` });
  }
};

// The inverse of getLocationStock: one product's stock/price across every
// location, keyed by locationId — powers the Products page's "Stock by
// Location" section in the product edit form.
export const getProductLocationStock = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { productId } = req.params;

    const product = await prisma.product.findFirst({ where: { id: String(productId), userId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const stocks = await prisma.productLocationStock.findMany({
      where: { productId: String(productId), userId },
      include: { location: { select: { id: true, name: true, isActive: true } } },
    });
    res.json(stocks);
  } catch (error) {
    console.error('Failed to fetch product location stock:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to fetch product location stock: ${detail}` });
  }
};

// Upserts one product's stock/price/threshold at one location.
export const upsertProductLocationStock = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { productId, locationId } = req.params;
    const { stock, priceOverride, lowStockThreshold } = req.body;

    const [product, location] = await Promise.all([
      prisma.product.findFirst({ where: { id: String(productId), userId } }),
      prisma.location.findFirst({ where: { id: String(locationId), userId } }),
    ]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const data = {
      stock: stock !== undefined ? Number(stock) || 0 : undefined,
      priceOverride: priceOverride === '' || priceOverride === null ? null : priceOverride !== undefined ? Number(priceOverride) : undefined,
      lowStockThreshold: lowStockThreshold === '' || lowStockThreshold === null ? null : lowStockThreshold !== undefined ? Number(lowStockThreshold) : undefined,
    };

    const row = await prisma.productLocationStock.upsert({
      where: { productId_locationId: { productId: String(productId), locationId: String(locationId) } },
      update: data,
      create: {
        productId: String(productId),
        locationId: String(locationId),
        userId,
        stock: data.stock ?? 0,
        priceOverride: data.priceOverride ?? null,
        lowStockThreshold: data.lowStockThreshold ?? null,
      },
    });
    res.json(row);
  } catch (error) {
    console.error('Failed to update location stock:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to update location stock: ${detail}` });
  }
};

// Moves quantity from one location to another for one product, in one
// transaction, logging both a StockTransfer row and a paired StockHistory
// entry at each end (mirrors how sale/adjustStock already log StockHistory).
export const createStockTransfer = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { productId, fromLocationId, toLocationId, quantity, note } = req.body;

    const qty = Number(quantity);
    if (!productId || !fromLocationId || !toLocationId || !qty || qty <= 0) {
      return res.status(400).json({ error: 'productId, fromLocationId, toLocationId and a positive quantity are required' });
    }
    if (String(fromLocationId) === String(toLocationId)) {
      return res.status(400).json({ error: 'Source and destination locations must be different' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const fromStock = await tx.productLocationStock.findUnique({
        where: { productId_locationId: { productId: String(productId), locationId: String(fromLocationId) } },
      });
      if (!fromStock || fromStock.stock < qty) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      await tx.productLocationStock.update({
        where: { id: fromStock.id },
        data: { stock: { decrement: qty } },
      });

      await tx.productLocationStock.upsert({
        where: { productId_locationId: { productId: String(productId), locationId: String(toLocationId) } },
        update: { stock: { increment: qty } },
        create: { productId: String(productId), locationId: String(toLocationId), userId, stock: qty },
      });

      const transfer = await tx.stockTransfer.create({
        data: {
          productId: String(productId),
          fromLocationId: String(fromLocationId),
          toLocationId: String(toLocationId),
          quantity: qty,
          note: note ? String(note) : null,
          userId,
        },
      });

      await tx.stockHistory.create({
        data: { change: -qty, reason: 'transfer_out', productId: String(productId), locationId: String(fromLocationId), userId },
      });
      await tx.stockHistory.create({
        data: { change: qty, reason: 'transfer_in', productId: String(productId), locationId: String(toLocationId), userId },
      });

      return transfer;
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
      return res.status(400).json({ error: 'Not enough stock at the source location for this transfer' });
    }
    console.error('Failed to create stock transfer:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to create stock transfer: ${detail}` });
  }
};

export const getStockTransfers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const transfers = await prisma.stockTransfer.findMany({
      where: { userId },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(transfers);
  } catch (error) {
    console.error('Failed to fetch stock transfers:', error);
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to fetch stock transfers: ${detail}` });
  }
};
