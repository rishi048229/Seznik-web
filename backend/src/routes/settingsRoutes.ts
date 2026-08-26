import express from 'express';
import { getSettings, createSettings, updateSettings, updateInvoiceConfig, updateNotificationConfig, updatePrinterConfig, updateReceiptConfig } from '../controllers/settingsController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All settings routes are protected

router.get('/', getSettings);
router.post('/', createSettings);
router.put('/:id', updateSettings);
router.patch('/receipt', updateReceiptConfig);
router.patch('/:id/receipt', updateReceiptConfig);
router.patch('/printer', updatePrinterConfig);
router.patch('/:id/printer', updatePrinterConfig);
router.patch('/:id/invoice', updateInvoiceConfig);
router.patch('/:id/notification', updateNotificationConfig);

export default router;
