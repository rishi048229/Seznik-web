import express from 'express';
import { 
  getSales, 
  getSaleById, 
  createSale, 
  getSalesByDateRange, 
  deleteSale, 
  bulkDeleteSales 
} from '../controllers/saleController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All sale routes are protected

router.get('/', getSales);
router.post('/', createSale);
router.get('/range', getSalesByDateRange);
router.post('/bulk-delete', bulkDeleteSales);
router.get('/:id', getSaleById);
router.delete('/:id', deleteSale);

export default router;
