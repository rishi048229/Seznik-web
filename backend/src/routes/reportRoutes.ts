import express from 'express';
import {
  getDashboardStats,
  getSalesReport,
  getPLReport,
  getTaxReport,
  getRevenueTrend,
  getTopCustomers,
  getPaymentModeBreakdown,
  getProfitBreakdown,
  getTopProducts,
  getTopCategories,
  getExpenseSummary,
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
router.get('/payment-modes', getPaymentModeBreakdown);
router.get('/profit-breakdown', getProfitBreakdown);
router.get('/top-products', getTopProducts);
router.get('/top-categories', getTopCategories);
router.get('/expense-summary', getExpenseSummary);

export default router;
