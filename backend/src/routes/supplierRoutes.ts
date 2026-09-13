import express from 'express';
import {
  getSuppliers,
  getSupplierById,
  getSupplierLedger,
  recordSupplierPayment,
  getSupplierRemindersDue,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All supplier routes are protected

router.get('/reminders/due', getSupplierRemindersDue);
router.get('/', getSuppliers);
router.post('/', createSupplier);
router.get('/:id', getSupplierById);
router.get('/:id/ledger', getSupplierLedger);
router.post('/:id/payments', recordSupplierPayment);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

export default router;

