import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';
import { handleApiError } from '../utils/apiErrorHandler';

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const suppliers = await prisma.supplier.findMany({
      where: { userId },
      include: {
        _count: {
          select: { products: true, purchases: true, purchaseReturns: true },
        },
        purchases: {
          select: {
            id: true,
            grandTotal: true,
            amountPaid: true,
            paymentStatus: true,
            paymentDueDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted = suppliers.map((s) => {
      const totalPurchaseValue = s.purchases?.reduce((sum, p) => sum + (p.grandTotal || 0), 0) || 0;
      const totalPaidValue = s.purchases?.reduce((sum, p) => sum + (p.amountPaid || 0), 0) || 0;
      const unpaidPurchases = s.purchases?.filter((p) => p.paymentStatus !== 'paid') || [];
      const oldestUnpaidDueDate = unpaidPurchases
        .map((p) => p.paymentDueDate)
        .filter(Boolean)
        .sort((a, b) => new Date(a!).getTime() - new Date(b!).getTime())[0] || null;

      return {
        id: s.id,
        name: s.name,
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        gstin: s.gstin || '',
        payableBalance: s.payableBalance || 0,
        userId: s.userId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        productsSuppliedCount: s._count?.products || 0,
        purchaseCount: s._count?.purchases || 0,
        returnCount: s._count?.purchaseReturns || 0,
        unpaidPurchasesCount: unpaidPurchases.length,
        oldestUnpaidDueDate,
        totalPurchaseValue,
        totalPaidValue,
        lastPurchaseAt: s.purchases?.[0]?.createdAt || null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

export const getSupplierById = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const { id } = req.params;

    const supplier = await prisma.supplier.findFirst({
      where: { id: String(id), userId },
      include: {
        _count: {
          select: { products: true, purchases: true, purchaseReturns: true },
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supplier details' });
  }
};

export const getSupplierLedger = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const supplierId = String(req.params.id || req.params.supplierId);

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, userId },
      include: {
        _count: { select: { products: true, purchases: true, purchaseReturns: true } },
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const purchases = await prisma.purchase.findMany({
      where: { supplierId, userId },
      include: { returns: true },
      orderBy: { createdAt: 'desc' },
    });

    const transactions = await prisma.supplierTransaction.findMany({
      where: { supplierId, userId },
      orderBy: { createdAt: 'desc' },
    });

    const returns = await prisma.purchaseReturn.findMany({
      where: { supplierId, userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalPurchaseValue = purchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
    const totalPaidValue = purchases.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const totalReturnedValue = purchases.reduce((sum, p) => sum + (p.totalReturned || 0), 0);

    // Aging breakdown for unpaid bills
    const unpaidPurchases = purchases.filter((p) => p.paymentStatus !== 'paid');
    const now = Date.now();
    let overdueCount = 0;
    let overdueAmount = 0;

    unpaidPurchases.forEach((p) => {
      const unpaid = Math.max(0, (p.grandTotal || 0) - (p.amountPaid || 0));
      if (p.paymentDueDate && new Date(p.paymentDueDate).getTime() < now) {
        overdueCount += 1;
        overdueAmount += unpaid;
      }
    });

    res.json({
      supplier: {
        ...supplier,
        productsCount: supplier._count.products,
        purchasesCount: supplier._count.purchases,
        returnsCount: supplier._count.purchaseReturns,
      },
      stats: {
        payableBalance: supplier.payableBalance,
        totalPurchaseValue,
        totalPaidValue,
        totalReturnedValue,
        unpaidPurchasesCount: unpaidPurchases.length,
        overdueCount,
        overdueAmount,
      },
      purchases,
      transactions,
      returns,
    });
  } catch (error) {
    console.error('getSupplierLedger error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier ledger' });
  }
};

export const recordSupplierPayment = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const supplierId = String(req.params.id || req.params.supplierId);
    const { amount, paymentMethod, purchaseId, notes } = req.body;

    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, userId },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Record SupplierTransaction
      const transaction = await tx.supplierTransaction.create({
        data: {
          supplierId,
          amount: paymentAmount,
          type: 'payment',
          paymentMethod: paymentMethod || 'bank',
          referenceId: purchaseId || null,
          notes: notes || (purchaseId ? `Payment for Purchase #${purchaseId}` : 'Account settlement payment'),
          userId,
        },
      });

      // 2. Decrement supplier payable balance
      const updatedSupplier = await tx.supplier.update({
        where: { id: supplierId },
        data: {
          payableBalance: { decrement: paymentAmount },
        },
      });

      // 3. If a specific purchase was given, update its amountPaid & paymentStatus
      if (purchaseId) {
        const p = await tx.purchase.findFirst({ where: { id: String(purchaseId), userId } });
        if (p) {
          const newPaid = (p.amountPaid || 0) + paymentAmount;
          const isPaid = newPaid >= (p.grandTotal || 0) - 0.001;
          await tx.purchase.update({
            where: { id: p.id },
            data: {
              amountPaid: newPaid,
              paymentStatus: isPaid ? 'paid' : 'partial',
            },
          });
        }
      } else {
        // FIFO settle oldest unpaid purchases for this supplier
        const unpaidPurchases = await tx.purchase.findMany({
          where: { supplierId, userId, paymentStatus: { in: ['pending', 'partial'] } },
          orderBy: { createdAt: 'asc' },
        });

        let remainingToAllocate = paymentAmount;
        for (const p of unpaidPurchases) {
          if (remainingToAllocate <= 0) break;
          const outstanding = Math.max(0, (p.grandTotal || 0) - (p.amountPaid || 0));
          const alloc = Math.min(remainingToAllocate, outstanding);
          const newPaid = (p.amountPaid || 0) + alloc;
          const isPaid = newPaid >= (p.grandTotal || 0) - 0.001;

          await tx.purchase.update({
            where: { id: p.id },
            data: {
              amountPaid: newPaid,
              paymentStatus: isPaid ? 'paid' : 'partial',
            },
          });

          remainingToAllocate -= alloc;
        }
      }

      return { transaction, supplier: updatedSupplier };
    });

    res.status(201).json(result);
  } catch (error: any) {
    handleApiError(res, error, 'Failed to record supplier payment');
  }
};

export const getSupplierRemindersDue = async (req: Request, res: Response) => {
  try {
    const userId = await getOwnerUserId((req as any).user.id);
    const now = new Date();
    const upcomingThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // within 7 days

    const unpaidPurchases = await prisma.purchase.findMany({
      where: {
        userId,
        paymentStatus: { in: ['pending', 'partial'] },
        paymentDueDate: { not: null },
      },
      include: {
        supplier: true,
      },
      orderBy: { paymentDueDate: 'asc' },
    });

    const overdue: any[] = [];
    const upcoming: any[] = [];

    unpaidPurchases.forEach((p) => {
      if (!p.paymentDueDate) return;
      const unpaid = Math.max(0, (p.grandTotal || 0) - (p.amountPaid || 0));
      const isOverdue = new Date(p.paymentDueDate).getTime() < now.getTime();
      const item = {
        purchaseId: p.id,
        invoiceNumber: p.invoiceNumber,
        supplierBillNumber: p.supplierBillNumber,
        supplierId: p.supplierId,
        supplierName: p.supplier?.name || 'Unknown Supplier',
        supplierPhone: p.supplier?.phone || '',
        grandTotal: p.grandTotal,
        amountPaid: p.amountPaid,
        outstandingAmount: unpaid,
        paymentDueDate: p.paymentDueDate,
        isOverdue,
      };

      if (isOverdue) {
        overdue.push(item);
      } else if (new Date(p.paymentDueDate) <= upcomingThreshold) {
        upcoming.push(item);
      }
    });

    res.json({
      overdue,
      upcoming,
      totalActionItems: overdue.length + upcoming.length,
    });
  } catch (error) {
    handleApiError(res, error, 'Failed to fetch supplier reminders');
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
        payableBalance: 0,
        userId,
      },
    });

    res.status(201).json({
      ...supplier,
      payableBalance: 0,
      productsSuppliedCount: 0,
      purchaseCount: 0,
      totalPurchaseValue: 0,
      lastPurchaseAt: null,
    });
  } catch (error: any) {
    handleApiError(res, error, 'Failed to create supplier. A supplier with this name or details may already exist.');
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
    handleApiError(res, error, 'Failed to update supplier');
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
    handleApiError(res, error, 'Failed to delete supplier — please verify if linked to purchases or products');
  }
};
