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
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

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

export default router;
