import express from 'express';
import { getTokens, createToken, deleteToken } from '../controllers/tokenController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect); // All token routes are protected
router.use(requirePermission('canAccessSales'));

router.get('/', getTokens);
router.post('/', createToken);
router.delete('/:id', deleteToken);

export default router;
