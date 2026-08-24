import { Request, Response } from 'express';
import prisma from '../config/db';

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
    res.status(500).json({ error: 'Failed to fetch customers' });
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
    res.status(500).json({ error: 'Failed to fetch customer' });
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
    res.status(500).json({ error: 'Failed to create customer' });
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
    res.status(500).json({ error: 'Failed to update customer' });
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
    res.status(500).json({ error: 'Failed to delete customer' });
  }
};
