import express from 'express';
import { registerDeviceToken, listBusinessDeviceTokens } from '../controllers/deviceTokenController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.post('/register', registerDeviceToken);
router.get('/', listBusinessDeviceTokens);

export default router;
