import express from 'express';
import {
  createSaleReturn,
  getSaleReturns,
  getReturnsForSale,
  getSaleReturnById,
} from '../controllers/saleReturnController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getSaleReturns);
router.post('/:saleId', createSaleReturn);
router.post('/sale/:saleId', createSaleReturn);
router.get('/sale/:saleId', getReturnsForSale);
router.get('/:id', getSaleReturnById);

export default router;
