import express from 'express';
import { getCreditTransactions, createCreditTransaction, deleteCreditTransaction } from '../controllers/creditController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect);
router.use(requirePermission('canAccessCustomers', 'canAccessSales'));

router.get('/', getCreditTransactions);
router.post('/', createCreditTransaction);
router.delete('/:id', deleteCreditTransaction);

export default router;
