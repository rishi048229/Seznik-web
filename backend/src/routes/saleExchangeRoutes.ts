import express from 'express';
import {
  createSaleExchange,
  getSaleExchanges,
  getExchangesForSale,
  getSaleExchangeById,
} from '../controllers/saleExchangeController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getSaleExchanges);
router.post('/', createSaleExchange);
router.post('/:saleId', createSaleExchange);
router.post('/sale/:saleId', createSaleExchange);
router.get('/sale/:saleId', getExchangesForSale);
router.get('/:id', getSaleExchangeById);

export default router;
