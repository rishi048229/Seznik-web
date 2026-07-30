import { Request, Response } from 'express';
import prisma from '../config/db';

export const getTokenTypes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tokenTypes = await prisma.tokenType.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(tokenTypes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch token types' });
  }
};

export const createTokenType = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, price, taxRate, sortOrder } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Token type name is required' });
    }

    const tokenType = await prisma.tokenType.create({
      data: {
        name: String(name).trim(),
        price: price === undefined || price === null || price === '' ? null : parseFloat(price),
        taxRate: taxRate ? parseFloat(taxRate) : 0,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
        userId,
      },
    });
    res.status(201).json(tokenType);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create token type' });
  }
};

export const updateTokenType = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { name, price, taxRate, sortOrder, isActive } = req.body;

    const existing = await prisma.tokenType.findFirst({ where: { id: String(id), userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Token type not found' });
    }

    const data: {
      name?: string; price?: number | null; taxRate?: number; sortOrder?: number; isActive?: boolean;
    } = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: 'Token type name is required' });
      }
      data.name = String(name).trim();
    }
    if (price !== undefined) data.price = price === null || price === '' ? null : parseFloat(price);
    if (taxRate !== undefined) data.taxRate = parseFloat(taxRate);
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder, 10);
    if (isActive !== undefined) data.isActive = isActive;

    const tokenType = await prisma.tokenType.updateMany({
      where: { id: String(id), userId },
      data,
    });
    res.json({ success: true, count: tokenType.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update token type' });
  }
};

export const deleteTokenType = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    await prisma.tokenType.deleteMany({
      where: { id: String(id), userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete token type' });
  }
};
