import { Router } from 'express';
import { getPublicReceiptData, renderPublicReceiptHtml } from '../controllers/publicReceiptController';

const router = Router();

// JSON API endpoint for public invoice/bill data
router.get('/api/public/receipt/:id', getPublicReceiptData);

// Direct public HTML A4 Invoice view (when QR code is scanned)
router.get('/receipt/:id', renderPublicReceiptHtml);
router.get('/bill/:id', renderPublicReceiptHtml);

export default router;
