import express from 'express';
import {
  getOrders,
  getOrderById,
  createOrder,
  addItemsToOrder,
  editOrder,
  updateKotOrderItem,
  sendToKitchen,
  updateOrderStatus,
  generateBill,
  assignTable,
  cancelOrder,
} from '../controllers/kotOrderController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect);
router.use(requirePermission('canAccessSales', 'canAccessKOT'));

router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.post('/:id/items', addItemsToOrder);
router.put('/:id', editOrder);
router.put('/:id/edit', editOrder);
router.patch('/:id/items/:itemId', updateKotOrderItem);
router.post('/:id/send-to-kitchen', sendToKitchen);
router.patch('/:id/status', updateOrderStatus);
router.post('/:id/bill', generateBill);
router.post('/:id/assign-table', assignTable);
router.post('/:id/cancel', cancelOrder);

export default router;
