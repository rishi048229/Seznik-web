import express from 'express';
import { 
  getSales, 
  getSaleById, 
  createSale, 
  getSalesByDateRange, 
  deleteSale, 
  bulkDeleteSales,
  updateSaleDeliveryStatus,
  getDeliveryReminders
} from '../controllers/saleController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All sale routes are protected

router.get('/', getSales);
router.post('/', createSale);
router.get('/delivery-reminders', getDeliveryReminders);
router.get('/range', getSalesByDateRange);
router.post('/bulk-delete', bulkDeleteSales);
router.get('/:id', getSaleById);
router.patch('/:id/delivery-status', updateSaleDeliveryStatus);
router.delete('/:id', deleteSale);

export default router;
