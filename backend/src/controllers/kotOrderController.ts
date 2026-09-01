import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOwnerUserId } from '../utils/getOwnerUserId';

const ACTIVE_STATUSES = ['open', 'sent_to_kitchen', 'preparing', 'ready', 'served'];

const enrichOrder = (o: { items: Array<{ unitPrice: number; quantity: number; taxRate: number; status?: string }> }) => {
  const billable = o.items.filter((it) => it.status !== 'voided');
  const subtotal = billable.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const tax = billable.reduce((acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100, 0);
  return {
    ...o,
    subtotal,
    totalTax: tax,
    grandTotal: subtotal + tax,
  };
};

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
      waiterName,
      locationId,
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
          waiterName: waiterName?.trim() || null,
          locationId: locationId || null,
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

export const editOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id);
    const {
      status,
      priority,
      notes,
      itemsToAdd = [],
      itemsToUpdate = [],
      itemsToVoid = [],
    } = req.body;

    const order = await prisma.kOTOrder.findFirst({
      where: { id, userId },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'billed' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot edit a billed or cancelled order' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Void items
      for (const v of itemsToVoid) {
        if (v.id) {
          const itemToVoid = order.items.find((it) => it.id === v.id);
          const reasonText = v.reason ? `[VOID: ${v.reason}] ` : '[VOID] ';
          const currentNotes = itemToVoid?.notes || '';
          await tx.kOTOrderItem.updateMany({
            where: { id: v.id, orderId: id, userId },
            data: {
              status: 'voided',
              notes: currentNotes.includes('[VOID') ? currentNotes : `${reasonText}${currentNotes}`.trim(),
            },
          });
        }
      }

      // 2. Update existing items
      for (const u of itemsToUpdate) {
        if (u.id) {
          await tx.kOTOrderItem.updateMany({
            where: { id: u.id, orderId: id, userId },
            data: {
              ...(u.quantity !== undefined ? { quantity: Number(u.quantity) } : {}),
              ...(u.notes !== undefined ? { notes: u.notes?.trim() || null } : {}),
              ...(Array.isArray(u.modifiers) ? { modifiers: u.modifiers } : {}),
              ...(u.status !== undefined ? { status: u.status } : {}),
            },
          });
        }
      }

      // 3. Add new items
      if (itemsToAdd.length > 0) {
        await tx.kOTOrderItem.createMany({
          data: itemsToAdd.map((it: any) => ({
            orderId: id,
            productId: it.productId || null,
            productName: it.productName || 'Item',
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            taxRate: Number(it.taxRate) || 0,
            notes: it.notes?.trim() || null,
            modifiers: Array.isArray(it.modifiers) ? it.modifiers : [],
            status: 'new',
            userId,
          })),
        });
      }

      // 4. Update order level fields
      const dataToUpdate: any = {};
      if (status !== undefined) dataToUpdate.status = status;
      if (priority !== undefined) dataToUpdate.priority = priority;
      if (notes !== undefined) dataToUpdate.notes = notes;

      if (Object.keys(dataToUpdate).length > 0) {
        await tx.kOTOrder.updateMany({
          where: { id, userId },
          data: dataToUpdate,
        });
      }
    });

    const updated = await prisma.kOTOrder.findFirst({
      where: { id, userId },
      include: { table: true, customer: true, items: true, sale: true },
    });

    const activeItems = (updated?.items || []).filter((it) => it.status !== 'voided');
    const subtotal = activeItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
    const tax = activeItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100, 0);

    res.json({
      ...updated,
      subtotal,
      totalTax: tax,
      grandTotal: subtotal + tax,
    });
  } catch (error) {
    console.error('editOrder error:', error);
    res.status(500).json({ error: 'Failed to edit KOT order' });
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

      return tx.kOTOrder.findFirst({
        where: { id, userId },
        include: { table: true, customer: true, items: true, sale: true },
      });
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

    const dataToUpdate: any = {};
    if (status !== undefined) {
      dataToUpdate.status = status;
      if (status === 'sent_to_kitchen' || status === 'modified') {
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
    const userId = await getOwnerUserId((req as any).user.id);
    const id = String(req.params.id);
    const {
      paymentMethod = 'cash',
      discount = 0,
      amountPaid,
      customerId,
      taxRate,
      serviceCharge = 0,
      roomCharge = 0,
      roomChargeLabel,
    } = req.body;

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

    const billableItems = order.items.filter((it) => it.status !== 'voided');
    if (billableItems.length === 0) {
      return res.status(400).json({ error: 'No billable items on this order' });
    }

    const subtotal = billableItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
    const itemTax = billableItems.reduce(
      (acc, it) => acc + (it.unitPrice * it.quantity * (it.taxRate || 0)) / 100,
      0
    );
    const overrideTaxRate = taxRate !== undefined && taxRate !== null && taxRate !== '' ? Number(taxRate) : null;
    const totalTax =
      overrideTaxRate !== null && !Number.isNaN(overrideTaxRate)
        ? (subtotal * overrideTaxRate) / 100
        : itemTax;
    const service = Math.max(0, Number(serviceCharge) || 0);
    const room = Math.max(0, Number(roomCharge) || 0);
    const totalDiscount = Number(discount) || 0;
    const grandTotal = Math.max(0, subtotal + totalTax + service + room - totalDiscount);
    const paid = amountPaid !== undefined ? Number(amountPaid) : grandTotal;
    const change = Math.max(0, paid - grandTotal);
    const resolvedCustomerId =
      customerId && String(customerId).trim()
        ? String(customerId).trim()
        : order.customerId || null;
    const locationId = order.locationId || null;

    const saleItems = billableItems.map((it) => {
      const lineTotal = it.unitPrice * it.quantity;
      const lineTaxRate = overrideTaxRate !== null ? overrideTaxRate : it.taxRate;
      return {
        productId: it.productId || undefined,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sellingPrice: it.unitPrice,
        discount: 0,
        taxRate: lineTaxRate,
        taxAmount: (lineTotal * (lineTaxRate || 0)) / 100,
        total: lineTotal,
      };
    });
    if (service > 0) {
      saleItems.push({
        productId: undefined,
        productName: 'Service Charge',
        quantity: 1,
        unitPrice: service,
        sellingPrice: service,
        discount: 0,
        taxRate: 0,
        taxAmount: 0,
        total: service,
      });
    }
    if (room > 0) {
      saleItems.push({
        productId: undefined,
        productName: String(roomChargeLabel || 'Room Charge'),
        quantity: 1,
        unitPrice: room,
        sellingPrice: room,
        discount: 0,
        taxRate: 0,
        taxAmount: 0,
        total: room,
      });
    }

    const count = await prisma.sale.count({ where: { userId } });
    const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;

    // Avoid Prisma interactive $transaction on RDS — stock updates inside a long-lived tx
    // hit P2028 (5s timeout) when the database has cross-region latency.
    const sale = await prisma.sale.create({
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
        locationId,
        userId,
      },
    });

    const stockUpdates: Promise<void>[] = [];
    for (const it of billableItems) {
      if (!it.productId) continue;
      const productId = it.productId;
      const qty = it.quantity;
      stockUpdates.push(
        (async () => {
          try {
            const product = await prisma.product.findFirst({
              where: { id: productId, userId },
            });
            if (!product) {
              console.warn(`generateBill: skipping stock for unknown product ${productId}`);
              return;
            }

            if (locationId) {
              await prisma.productLocationStock.upsert({
                where: { productId_locationId: { productId: product.id, locationId } },
                update: { stock: { decrement: qty } },
                create: { productId: product.id, locationId, userId, stock: -qty },
              });
            } else {
              await prisma.product.update({
                where: { id: product.id },
                data: { currentStock: { decrement: qty } },
              });
            }
            await prisma.stockHistory.create({
              data: {
                productId: product.id,
                change: -qty,
                reason: `KOT Order #${order.orderNumber} (Invoice ${invoiceNumber})`,
                locationId,
                userId,
              },
            });
          } catch (stockErr) {
            console.warn(`generateBill: stock update failed for ${productId}`, stockErr);
          }
        })()
      );
    }

    if (stockUpdates.length > 0) {
      await Promise.all(stockUpdates);
    }

    const unpaid = grandTotal - paid;
    if (unpaid > 0.01 && resolvedCustomerId) {
      try {
        const customer = await prisma.customer.findFirst({
          where: { id: resolvedCustomerId, userId },
        });
        if (customer) {
          await prisma.customer.update({
            where: { id: resolvedCustomerId },
            data: { creditBalance: { increment: unpaid } },
          });
          await prisma.creditTransaction.create({
            data: {
              customerId: resolvedCustomerId,
              amount: unpaid,
              type: 'credit',
              referenceId: sale.id,
              notes: `Credit for KOT #${order.orderNumber} (${invoiceNumber})`,
              userId,
            },
          });
        }
      } catch (creditErr) {
        console.warn('generateBill: credit update failed (sale was saved)', creditErr);
      }
    }

    const updatedOrder = await prisma.kOTOrder.update({
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

    res.json({ order: updatedOrder, sale });
  } catch (error: any) {
    console.error('generateBill error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate bill from KOT order',
    });
  }
};
