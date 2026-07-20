import express from 'express';
import { register, login, socialLogin, getProfile, setRole, completeOnboarding } from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/social', socialLogin);
router.get('/profile', protect, getProfile);
router.post('/setRole', protect, setRole);
router.post('/onboard', protect, completeOnboarding);

export default router;
