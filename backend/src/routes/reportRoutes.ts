import express from 'express';
import { 
  getDashboardStats, 
  getSalesReport, 
  getPLReport, 
  getTaxReport, 
  getRevenueTrend, 
  getTopCustomers 
} from '../controllers/reportController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/dashboard', getDashboardStats);
router.get('/sales', getSalesReport);
router.get('/pl', getPLReport);
router.get('/tax', getTaxReport);
router.get('/trend', getRevenueTrend);
router.get('/top-customers', getTopCustomers);

export default router;
