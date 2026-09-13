import express from 'express';
import { 
  getPurchases, 
  getPurchaseById, 
  createPurchase, 
  recordPurchasePayment,
  deletePurchase 
} from '../controllers/purchaseController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getPurchases);
router.post('/', createPurchase);
router.get('/:id', getPurchaseById);
router.post('/:id/payments', recordPurchasePayment);
router.delete('/:id', deletePurchase);

export default router;
