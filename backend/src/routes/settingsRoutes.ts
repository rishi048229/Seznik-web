import express from 'express';
import { getSettings, createSettings, updateSettings, updateInvoiceConfig, updateNotificationConfig, updatePrinterConfig } from '../controllers/settingsController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect); // All settings routes are protected

const canEditSettings = requirePermission('canAccessSettings');
const canEditPrinter = requirePermission('canAccessSettings', 'canAccessSales');

router.get('/', getSettings);
router.post('/', canEditSettings, createSettings);
router.put('/:id', canEditSettings, updateSettings);
router.patch('/printer', canEditPrinter, updatePrinterConfig);
router.patch('/:id/printer', canEditPrinter, updatePrinterConfig);
router.patch('/:id/invoice', canEditSettings, updateInvoiceConfig);
router.patch('/:id/notification', canEditSettings, updateNotificationConfig);

export default router;
