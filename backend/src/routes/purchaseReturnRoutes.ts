import express from 'express';
import { protect } from '../middlewares/authMiddleware';
import {
  createPurchaseReturn,
  getPurchaseReturns,
  getReturnsForPurchase,
  getPurchaseReturnById,
} from '../controllers/purchaseReturnController';

const router = express.Router();

router.use(protect);

router.get('/', getPurchaseReturns);
router.post('/', createPurchaseReturn);
router.post('/:purchaseId', createPurchaseReturn);
router.get('/purchase/:purchaseId', getReturnsForPurchase);
router.get('/:id', getPurchaseReturnById);

export default router;
