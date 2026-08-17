import express from 'express';
import {
  register,
  login,
  socialLogin,
  getProfile,
  setRole,
  completeOnboarding,
  getManagedUsers,
  createManagedUser,
  syncManagedUsers,
  updateManagedUserPassword,
  sendEmailOtp,
  verifyEmailOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

// Pre-signup email verification (public)
router.post('/send-otp', sendEmailOtp);
router.post('/verify-otp', verifyEmailOtp);

// Forgot password flow (public)
router.post('/forgot-password/send-otp', sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp);
router.post('/forgot-password/reset-password', resetPasswordWithOtp);

router.post('/register', register);
router.post('/login', login);
router.post('/social', socialLogin);
router.get('/profile', protect, getProfile);
router.post('/setRole', protect, setRole);
router.post('/onboard', protect, completeOnboarding);

// Managed users (sub-account configuration). :adminUid in the path is kept for
// the frontend contract, but the authenticated user is the source of truth.
router.get('/managed-users/:adminUid', protect, getManagedUsers);
router.post('/managed-users/:adminUid', protect, createManagedUser);
router.post('/managed-users/:adminUid/bulk', protect, syncManagedUsers);
router.post('/managed-users/:adminUid/password', protect, updateManagedUserPassword);

export default router;
