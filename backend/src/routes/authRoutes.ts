import express from 'express';
import {
  register,
  verifyAccessCode,
  redeemAccessCode,
  login,
  socialLogin,
  getProfile,
  setRole,
  completeOnboarding,
  updateBusinessType,
  getManagedUsers,
  createManagedUser,
  syncManagedUsers,
  updateManagedUserPassword,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  requestAgentOtp,
  verifyAgentOtp,
  generateQrLogin,
  getQrLoginStatus,
  consumeQrLogin,
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

// Pre-signup email & phone verification & access code check (public)
router.post('/send-otp', sendEmailOtp);
router.post('/verify-otp', verifyEmailOtp);
router.post('/send-phone-otp', sendPhoneOtp);
router.post('/verify-phone-otp', verifyPhoneOtp);
router.post('/verify-access-code', verifyAccessCode);

// Forgot password flow (public)
router.post('/forgot-password/send-otp', sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp);
router.post('/forgot-password/reset-password', resetPasswordWithOtp);
router.post('/agent/request-otp', requestAgentOtp);
router.post('/agent/verify-otp', verifyAgentOtp);

router.post('/register', register);
router.post('/login', login);
router.post('/social', socialLogin);

// QR login: dashboard generates a short-lived code; the mobile app consumes it.
router.post('/qr-login/session', protect, generateQrLogin);
router.get('/qr-login/session/:sessionId', protect, getQrLoginStatus);
router.post('/qr-login', consumeQrLogin);
router.get('/profile', protect, getProfile);
router.post('/redeem-access-code', protect, redeemAccessCode);
router.post('/setRole', protect, setRole);
router.post('/onboard', protect, completeOnboarding);
router.patch('/business-type', protect, updateBusinessType);

// Managed users (sub-account configuration). :adminUid in the path is kept for
// the frontend contract, but the authenticated user is the source of truth.
router.get('/managed-users/:adminUid', protect, getManagedUsers);
router.post('/managed-users/:adminUid', protect, requirePermission('canManageUsers'), createManagedUser);
router.post('/managed-users/:adminUid/bulk', protect, requirePermission('canManageUsers'), syncManagedUsers);
router.post('/managed-users/:adminUid/password', protect, requirePermission('canManageUsers'), updateManagedUserPassword);

export default router;
