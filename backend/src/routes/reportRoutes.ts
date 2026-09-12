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
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect);

const canViewOps = requirePermission('canAccessReports', 'canAccessSales');
const canViewReports = requirePermission('canAccessReports');

router.get('/dashboard', canViewOps, getDashboardStats);
router.get('/sales', canViewReports, getSalesReport);
router.get('/pl', canViewReports, getPLReport);
router.get('/tax', canViewReports, getTaxReport);
router.get('/trend', canViewOps, getRevenueTrend);
router.get('/top-customers', canViewReports, getTopCustomers);
router.get('/payment-modes', canViewOps, getPaymentModeBreakdown);
router.get('/profit-breakdown', canViewOps, getProfitBreakdown);
router.get('/top-products', canViewOps, getTopProducts);
router.get('/top-categories', canViewReports, getTopCategories);
router.get('/expense-summary', requirePermission('canAccessReports', 'canAccessExpenses'), getExpenseSummary);

export default router;
