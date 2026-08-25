import { Request, Response } from 'express';
import prisma from '../config/db';

const ACTIVE_STATUSES = ['open', 'sent_to_kitchen', 'preparing', 'ready', 'served'];

const enrichOrder = (o: { items: Array<{ unitPrice: number; quantity: number; taxRate: number }> }) => {
  const subtotal = o.items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const tax = o.items.reduce((acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100, 0);
  return {
    ...o,
    subtotal,
    totalTax: tax,
    grandTotal: subtotal + tax,
  };
};

const mapItemCreate = (it: any, userId: string, sentToKitchenAt: Date | null = null) => ({
  productId: it.productId || null,
  productName: it.productName || it.name || 'Item',
  quantity: Number(it.quantity) || 1,
  unitPrice: Number(it.unitPrice ?? it.price) || 0,
  taxRate: Number(it.taxRate) || 0,
  notes: it.notes?.trim() || null,
  modifiers: Array.isArray(it.modifiers) ? it.modifiers : [],
  sentToKitchenAt,
  userId,
});

export const getOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { status, orderType, tableId } = req.query;

    let statusFilter: any = undefined;
    if (status) {
      const raw = String(status);
      if (raw === 'running') {
        statusFilter = { in: ACTIVE_STATUSES };
      } else {
        const statusArr = raw.split(',').map((s) => s.trim()).filter(Boolean);
        statusFilter = { in: statusArr };
      }
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

    res.json(orders.map(enrichOrder));
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

    res.json(enrichOrder(order));
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
      note,
      waiterName,
      locationId,
      priority = 'normal',
      status = 'open',
      items = [],
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await prisma.kOTOrder.count({
      where: {
        userId,
        createdAt: { gte: todayStart },
      },
    });

    const nextOrderNumber = todayCount + 1;
    const kitchenAt = status === 'sent_to_kitchen' ? new Date() : null;

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
          notes: (notes || note)?.trim() || null,
          waiterName: waiterName?.trim() || null,
          locationId: locationId || null,
          priority,
          status,
          sentToKitchenAt: kitchenAt,
          userId,
          items: {
            create: items.map((it: any) => mapItemCreate(it, userId, kitchenAt)),
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

    res.status(201).json(enrichOrder(result));
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
      data: items.map((it: any) => ({ ...mapItemCreate(it, userId, null), orderId: id })),
    });

    const updated = await prisma.kOTOrder.findFirst({
      where: { id, userId },
      include: { table: true, customer: true, items: true },
    });

    res.json(updated ? enrichOrder(updated) : updated);
  } catch (error) {
    console.error('addItemsToOrder error:', error);
    res.status(500).json({ error: 'Failed to add items to order' });
  }
};

export const sendToKitchen = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id);

    const order = await prisma.kOTOrder.findFirst({
      where: { id, userId },
      include: { items: true, table: true, customer: true, sale: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'billed' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot send a billed or cancelled order to kitchen' });
    }

    const { waiterName, locationId } = req.body;
    const unprinted = order.items.filter((it) => !it.sentToKitchenAt);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      if (unprinted.length > 0) {
        await tx.kOTOrderItem.updateMany({
          where: { id: { in: unprinted.map((it) => it.id) }, orderId: id },
          data: { sentToKitchenAt: now, status: 'sent_to_kitchen' },
        });
      }

      await tx.kOTOrder.update({
        where: { id },
        data: {
          status: order.status === 'open' ? 'sent_to_kitchen' : order.status,
          sentToKitchenAt: order.sentToKitchenAt || now,
          ...(waiterName !== undefined ? { waiterName: String(waiterName).trim() || null } : {}),
          ...(locationId !== undefined ? { locationId: locationId || null } : {}),
        },
      });

      const updated = await tx.kOTOrder.findFirst({
        where: { id, userId },
        include: { table: true, customer: true, items: true, sale: true },
      });

      return updated;
    });

    if (!result) {
      return res.status(404).json({ error: 'Order not found after update' });
    }

    const newlySentIds = new Set(unprinted.map((it) => it.id));
    const newlySentItems = result.items.filter((it) => newlySentIds.has(it.id));

    res.json({
      ...enrichOrder(result),
      newlySentItems,
    });
  } catch (error) {
    console.error('sendToKitchen error:', error);
    res.status(500).json({ error: 'Failed to send order to kitchen' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id);
    const { status, priority, notes } = req.body;

    const existing = await prisma.kOTOrder.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const dataToUpdate: any = {};
    if (status !== undefined) {
      dataToUpdate.status = status;
      if (status === 'sent_to_kitchen' && !existing.sentToKitchenAt) {
        dataToUpdate.sentToKitchenAt = new Date();
      }
    }
    if (priority !== undefined) dataToUpdate.priority = priority;
    if (notes !== undefined) dataToUpdate.notes = notes;

    await prisma.kOTOrder.updateMany({
      where: { id, userId },
      data: dataToUpdate,
    });

    const updated = await prisma.kOTOrder.findFirst({
      where: { id, userId },
      include: { table: true, customer: true, items: true, sale: true },
    });

    res.json(updated ? enrichOrder(updated) : { success: true });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

export const generateBill = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id);
    const { paymentMethod = 'cash', discount = 0, amountPaid, customerId } = req.body;

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

    const resolvedCustomerId = customerId || order.customerId || null;

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.sale.count({ where: { userId } });
      const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;

      const subtotal = order.items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
      const totalTax = order.items.reduce((acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100, 0);
      const totalDiscount = Number(discount) || 0;
      const grandTotal = Math.max(0, subtotal + totalTax - totalDiscount);
      const paid = amountPaid !== undefined ? Number(amountPaid) : grandTotal;
      const change = Math.max(0, paid - grandTotal);
      const saleDate = new Date();

      const saleItems = order.items.map((it) => ({
        productId: it.productId || undefined,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sellingPrice: it.unitPrice,
        taxRate: it.taxRate,
        discount: 0,
        taxAmount: (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100,
        total: it.unitPrice * it.quantity,
      }));

      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: resolvedCustomerId,
          items: saleItems as any,
          subtotal,
          totalDiscount,
          totalTax,
          grandTotal,
          paymentMethod,
          amountPaid: paid,
          changeReturned: change,
          locationId: order.locationId || null,
          userId,
        },
      });

      for (const it of order.items) {
        if (!it.productId) continue;
        try {
          const prod = await tx.product.findFirst({
            where: { id: it.productId, userId },
          });
          if (!prod) continue;

          if (order.locationId) {
            await tx.productLocationStock.upsert({
              where: { productId_locationId: { productId: it.productId, locationId: order.locationId } },
              update: { stock: { decrement: it.quantity } },
              create: { productId: it.productId, locationId: order.locationId, userId, stock: -it.quantity },
            });
          } else {
            await tx.product.update({
              where: { id: it.productId },
              data: { currentStock: { decrement: it.quantity } },
            });
          }

          await tx.stockHistory.create({
            data: {
              productId: it.productId,
              change: -it.quantity,
              reason: `KOT Order #${order.orderNumber} (Invoice ${invoiceNumber})`,
              locationId: order.locationId || null,
              userId,
              createdAt: saleDate,
            },
          });
        } catch (stockErr) {
          console.warn(`Could not decrement stock for product ${it.productId}:`, stockErr);
        }
      }

      const unpaid = grandTotal - paid;
      if (unpaid > 0.01 && resolvedCustomerId) {
        await tx.customer.update({
          where: { id: resolvedCustomerId },
          data: { creditBalance: { increment: unpaid } },
        });

        await tx.creditTransaction.create({
          data: {
            customerId: resolvedCustomerId,
            amount: unpaid,
            type: 'credit',
            referenceId: sale.id,
            notes: `Credit for KOT #${order.orderNumber} (${invoiceNumber})`,
            userId,
            createdAt: saleDate,
          },
        });
      }

      if (resolvedCustomerId && resolvedCustomerId !== order.customerId) {
        await tx.kOTOrder.update({
          where: { id },
          data: { customerId: resolvedCustomerId },
        });
      }

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

      return { order: enrichOrder(updatedOrder), sale };
    });

    res.json(result);
  } catch (error) {
    console.error('generateBill error:', error);
    res.status(500).json({ error: 'Failed to generate bill from KOT order' });
  }
};
