import express from 'express';
import { logPrinterConnection } from '../controllers/printerLogController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.post('/', logPrinterConnection);

export default router;
