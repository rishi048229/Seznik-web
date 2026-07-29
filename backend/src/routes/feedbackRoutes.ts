import express from 'express';
import { createFeedback, getMyFeedback } from '../controllers/feedbackController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.post('/', createFeedback);
router.get('/', getMyFeedback);

export default router;
