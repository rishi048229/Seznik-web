import { Request, Response } from 'express';
import prisma from '../config/db';

export const getOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { status, orderType, tableId } = req.query;

    let statusFilter: any = undefined;
    if (status) {
      const statusArr = String(status).split(',').map((s) => s.trim());
      statusFilter = { in: statusArr };
    }

    const orders = await prisma.kOTOrder.findMany({
      where: {
        userId,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(orderType ? { orderType: String(orderType) } : {}),
        ...(tableId ? { tableId: String(tableId) } : {}),
      },
      include: {
        table: true,
        customer: true,
        items: true,
        sale: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = orders.map((o) => {
      const subtotal = o.items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
      const tax = o.items.reduce((acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100, 0);
      return {
        ...o,
        subtotal,
        totalTax: tax,
        grandTotal: subtotal + tax,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('getOrders error:', error);
    res.status(500).json({ error: 'Failed to fetch KOT orders' });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id);

    const order = await prisma.kOTOrder.findFirst({
      where: { id, userId },
      include: {
        table: true,
        customer: true,
        items: true,
        sale: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'KOT Order not found' });
    }

    const subtotal = order.items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
    const tax = order.items.reduce((acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100, 0);

    res.json({
      ...order,
      subtotal,
      totalTax: tax,
      grandTotal: subtotal + tax,
    });
  } catch (error) {
    console.error('getOrderById error:', error);
    res.status(500).json({ error: 'Failed to fetch KOT order' });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const {
      orderType = 'dine_in',
      tableId,
      partyLabel,
      guestCount,
      customerId,
      contactNumber,
      notes,
      priority = 'normal',
      status = 'open',
      items = [],
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    // Compute today's sequential order number (resets daily)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await prisma.kOTOrder.count({
      where: {
        userId,
        createdAt: { gte: todayStart },
      },
    });

    const nextOrderNumber = todayCount + 1;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.kOTOrder.create({
        data: {
          orderNumber: nextOrderNumber,
          orderType,
          tableId: tableId || null,
          partyLabel: partyLabel?.trim() || null,
          guestCount: guestCount ? Number(guestCount) : null,
          customerId: customerId || null,
          contactNumber: contactNumber?.trim() || null,
          notes: notes?.trim() || null,
          priority,
          status,
          sentToKitchenAt: status === 'sent_to_kitchen' ? new Date() : null,
          userId,
          items: {
            create: items.map((it: any) => ({
              productId: it.productId || null,
              productName: it.productName || 'Item',
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              taxRate: Number(it.taxRate) || 0,
              notes: it.notes?.trim() || null,
              modifiers: Array.isArray(it.modifiers) ? it.modifiers : [],
              userId,
            })),
          },
        },
        include: {
          table: true,
          customer: true,
          items: true,
        },
      });

      return order;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json({ error: 'Failed to create KOT order' });
  }
};

export const addItemsToOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id);
    const { items = [] } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items provided to add' });
    }

    const order = await prisma.kOTOrder.findFirst({
      where: { id, userId },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'billed' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot add items to a billed or cancelled order' });
    }

    await prisma.kOTOrderItem.createMany({
      data: items.map((it: any) => ({
        orderId: id,
        productId: it.productId || null,
        productName: it.productName || 'Item',
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        taxRate: Number(it.taxRate) || 0,
        notes: it.notes?.trim() || null,
        modifiers: Array.isArray(it.modifiers) ? it.modifiers : [],
        userId,
      })),
    });

    const updated = await prisma.kOTOrder.findFirst({
      where: { id, userId },
      include: { table: true, customer: true, items: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('addItemsToOrder error:', error);
    res.status(500).json({ error: 'Failed to add items to order' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id);
    const { status, priority, notes } = req.body;

    const dataToUpdate: any = {};
    if (status !== undefined) {
      dataToUpdate.status = status;
      if (status === 'sent_to_kitchen') {
        dataToUpdate.sentToKitchenAt = new Date();
      }
    }
    if (priority !== undefined) dataToUpdate.priority = priority;
    if (notes !== undefined) dataToUpdate.notes = notes;

    const order = await prisma.kOTOrder.updateMany({
      where: { id, userId },
      data: dataToUpdate,
    });

    res.json({ success: true, count: order.count });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

export const generateBill = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id);
    const { paymentMethod = 'cash', discount = 0, amountPaid } = req.body;

    const order = await prisma.kOTOrder.findFirst({
      where: { id, userId },
      include: { items: true, table: true, customer: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'billed') {
      return res.status(400).json({ error: 'Order is already billed' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate sequential Invoice Number
      const count = await tx.sale.count({ where: { userId } });
      const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;

      // 2. Compute totals
      const subtotal = order.items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
      const totalTax = order.items.reduce((acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100, 0);
      const totalDiscount = Number(discount) || 0;
      const grandTotal = Math.max(0, subtotal + totalTax - totalDiscount);
      const paid = amountPaid !== undefined ? Number(amountPaid) : grandTotal;
      const change = Math.max(0, paid - grandTotal);

      // 3. Format Sale item line array
      const saleItems = order.items.map((it) => ({
        productId: it.productId || undefined,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        total: it.unitPrice * it.quantity,
      }));

      // 4. Create real Sale
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: order.customerId || null,
          items: saleItems as any,
          subtotal,
          totalDiscount,
          totalTax,
          grandTotal,
          paymentMethod,
          amountPaid: paid,
          changeReturned: change,
          userId,
        },
      });

      // 5. Decrement Stock for tracked products
      for (const it of order.items) {
        if (it.productId) {
          try {
            await tx.product.update({
              where: { id: it.productId },
              data: { currentStock: { decrement: it.quantity } },
            });
            await tx.stockHistory.create({
              data: {
                productId: it.productId,
                change: -it.quantity,
                reason: `KOT Order #${order.orderNumber} (Invoice ${invoiceNumber})`,
                userId,
              },
            });
          } catch (stockErr) {
            console.warn(`Could not decrement stock for product ${it.productId}:`, stockErr);
          }
        }
      }

      // 6. Update KOT Order to billed
      const updatedOrder = await tx.kOTOrder.update({
        where: { id },
        data: {
          status: 'billed',
          saleId: sale.id,
        },
        include: {
          table: true,
          customer: true,
          items: true,
          sale: true,
        },
      });

      return { order: updatedOrder, sale };
    });

    res.json(result);
  } catch (error) {
    console.error('generateBill error:', error);
    res.status(500).json({ error: 'Failed to generate bill from KOT order' });
  }
};
