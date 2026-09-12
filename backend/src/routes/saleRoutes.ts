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
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect); // All sale routes are protected

const canViewSales = requirePermission('canAccessSales', 'canAccessReports');
const canWriteSales = requirePermission('canAccessSales');

router.get('/', canViewSales, getSales);
router.post('/', canWriteSales, createSale);
router.get('/range', canViewSales, getSalesByDateRange);
router.post('/bulk-delete', canWriteSales, bulkDeleteSales);
router.get('/:id', canViewSales, getSaleById);
router.delete('/:id', canWriteSales, deleteSale);

export default router;
