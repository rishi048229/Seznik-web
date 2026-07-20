import express from 'express';
import { getSettings, createSettings, updateSettings, updateInvoiceConfig, updateNotificationConfig } from '../controllers/settingsController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All settings routes are protected

router.get('/', getSettings);
router.post('/', createSettings);
router.put('/:id', updateSettings);
router.patch('/:id/invoice', updateInvoiceConfig);
router.patch('/:id/notification', updateNotificationConfig);

export default router;
