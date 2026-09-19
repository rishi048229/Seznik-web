import express from 'express';
import {
  createPrintJob,
  listPrintJobsForAdmin,
  listPendingJobsForAgent,
  getPrintJob,
  updatePrintJobStatus,
  cancelPrintJob,
  reassignPrintJob,
} from '../controllers/printJobController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

// Agent-side polling routes first — more specific than /:id, must come before it.
router.get('/agent/pending', listPendingJobsForAgent);

router.post('/', createPrintJob);
router.get('/', listPrintJobsForAdmin);
router.get('/:id', getPrintJob);
router.patch('/:id/status', updatePrintJobStatus);
router.patch('/:id/cancel', cancelPrintJob);
router.post('/:id/reassign', reassignPrintJob);

export default router;
