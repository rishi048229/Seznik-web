import express from 'express';
import {
  extractUtilityBill,
  createUtilityBill,
  getUtilityBills,
  getUtilityBillStats,
  deleteUtilityBill,
} from '../controllers/utilityBillController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

// Extraction endpoint (10MB body limit handled in app.ts)
router.post('/extract', extractUtilityBill);

// CRUD & Stats endpoints
router.get('/stats', getUtilityBillStats);
router.get('/', getUtilityBills);
router.post('/', createUtilityBill);
router.delete('/:id', deleteUtilityBill);

export default router;
