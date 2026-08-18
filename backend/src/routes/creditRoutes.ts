import express from 'express';
import {
  getCreditTransactions,
  createCreditTransaction,
  deleteCreditTransaction,
  getCustomerLedger,
  getRemindersDue,
  logReminderSent,
} from '../controllers/creditController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getCreditTransactions);
router.post('/', createCreditTransaction);
router.get('/customer/:customerId', getCustomerLedger);
router.get('/reminders/due', getRemindersDue);
router.post('/reminders', logReminderSent);
router.delete('/:id', deleteCreditTransaction);

export default router;
