import express from 'express';
import {
  getOrders,
  getOrderById,
  createOrder,
  addItemsToOrder,
  sendToKitchen,
  updateOrderStatus,
  generateBill,
} from '../controllers/kotOrderController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.post('/:id/items', addItemsToOrder);
router.post('/:id/send-to-kitchen', sendToKitchen);
router.patch('/:id/status', updateOrderStatus);
router.post('/:id/bill', generateBill);

export default router;
