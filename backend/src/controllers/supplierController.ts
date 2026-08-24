import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const suppliers = await prisma.supplier.findMany({
      where: { userId },
      include: {
        _count: {
          select: { products: true, purchases: true },
        },
        purchases: {
          select: { grandTotal: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted = suppliers.map((s) => {
      const totalPurchaseValue = s.purchases?.reduce((sum, p) => sum + (p.grandTotal || 0), 0) || 0;
      return {
        id: s.id,
        name: s.name,
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        gstin: s.gstin || '',
        userId: s.userId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        productsSuppliedCount: s._count?.products || 0,
        purchaseCount: s._count?.purchases || 0,
        totalPurchaseValue,
        lastPurchaseAt: s.purchases?.[0]?.createdAt || null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { name, phone, email, address, gstin } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier / Business name is required' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        phone: (phone || '').trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        gstin: gstin?.trim() || null,
        userId,
      },
    });

    res.status(201).json({
      ...supplier,
      productsSuppliedCount: 0,
      purchaseCount: 0,
      totalPurchaseValue: 0,
      lastPurchaseAt: null,
    });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: error?.message || 'Failed to create supplier' });
  }
};

export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;
    const { name, phone, email, address, gstin } = req.body;

    const existing = await prisma.supplier.findFirst({
      where: { id: String(id), userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const updated = await prisma.supplier.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(gstin !== undefined && { gstin: gstin?.trim() || null }),
      },
      include: {
        _count: { select: { products: true, purchases: true } },
        purchases: { select: { grandTotal: true, createdAt: true }, take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    res.json({
      ...updated,
      productsSuppliedCount: updated._count?.products || 0,
      purchaseCount: updated._count?.purchases || 0,
      totalPurchaseValue: updated.purchases?.reduce((sum, p) => sum + (p.grandTotal || 0), 0) || 0,
      lastPurchaseAt: updated.purchases?.[0]?.createdAt || null,
    });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: error?.message || 'Failed to update supplier' });
  }
};

export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;

    await prisma.supplier.deleteMany({
      where: { id: String(id), userId },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
};
