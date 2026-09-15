import { Request, Response } from 'express';
import prisma from '../config/db';
import { handleApiError } from '../utils/apiErrorHandler';

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    // Optional limit/page, but ALWAYS capped even when the caller sends nothing — previously this
    // returned the tenant's entire customer table unconditionally, unbounded by row count.
    const limit = Math.min(Number(req.query.limit) || 500, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const customers = await prisma.customer.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      take: limit,
      skip: (page - 1) * limit,
    });
    res.json(customers);
  } catch (error) {
    handleApiError(res, error, 'Failed to fetch customers');
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const customer = await prisma.customer.findFirst({
      where: { id: String(id), userId },
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    handleApiError(res, error, 'Failed to fetch customer details');
  }
};

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const data = req.body;
    
    const customer = await prisma.customer.create({
      data: { ...data, userId },
    });
    res.status(201).json(customer);
  } catch (error) {
    handleApiError(res, error, 'Failed to create customer');
  }
};

// Bulk import, used by the mobile "Import Phone Contacts" flow. The client sends
// the whole selected address book in one request rather than one POST per contact.
// Phone numbers already on file for this user are skipped instead of erroring, so
// re-running an import (or importing an overlapping selection) tops up the new
// contacts rather than creating duplicates — there is no unique constraint on
// phone, so this is enforced here.
export const bulkCreateCustomers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { customers } = req.body;

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: 'A non-empty "customers" array is required' });
    }

    const MAX_BULK = 2000;
    if (customers.length > MAX_BULK) {
      return res.status(400).json({ error: `Cannot import more than ${MAX_BULK} contacts at once` });
    }

    const normalizePhone = (value: unknown) => String(value ?? '').replace(/[^0-9+]/g, '');

    // Keep only well-formed rows, and de-duplicate within the payload itself.
    const seen = new Set<string>();
    const candidates: { name: string; phone: string; email?: string; address?: string; creditLimit: number }[] = [];
    for (const entry of customers) {
      const name = String(entry?.name ?? '').trim();
      const phone = normalizePhone(entry?.phone);
      if (!name || !phone) continue;
      if (seen.has(phone)) continue;
      seen.add(phone);
      candidates.push({
        name,
        phone,
        email: entry?.email ? String(entry.email).trim() : undefined,
        address: entry?.address ? String(entry.address).trim() : undefined,
        creditLimit: Number(entry?.creditLimit) || 0,
      });
    }

    if (candidates.length === 0) {
      return res.status(400).json({ error: 'No contacts with both a name and a phone number were provided' });
    }

    const existing = await prisma.customer.findMany({
      where: { userId, phone: { in: candidates.map((c) => c.phone) } },
      select: { phone: true },
    });
    const existingPhones = new Set(existing.map((c) => c.phone));

    const toCreate = candidates.filter((c) => !existingPhones.has(c.phone));

    if (toCreate.length === 0) {
      return res.json({ success: true, count: 0, skipped: candidates.length });
    }

    const result = await prisma.customer.createMany({
      data: toCreate.map((c) => ({ ...c, userId })),
      skipDuplicates: true,
    });

    res.status(201).json({
      success: true,
      count: result.count,
      skipped: candidates.length - result.count,
    });
  } catch (error) {
    handleApiError(res, error, 'Failed to import customers');
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const data = req.body;
    
    const customer = await prisma.customer.updateMany({
      where: { id: String(id), userId },
      data,
    });
    res.json({ success: true, count: customer.count });
  } catch (error) {
    handleApiError(res, error, 'Failed to update customer');
  }
};

export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    
    await prisma.customer.deleteMany({
      where: { id: String(id), userId },
    });
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error, 'Failed to delete customer — please check for linked sales or credit ledgers');
  }
};
