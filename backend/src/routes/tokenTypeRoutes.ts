import express from 'express';
import { getTokenTypes, createTokenType, updateTokenType, deleteTokenType } from '../controllers/tokenTypeController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect); // All token type routes are protected

router.get('/', requirePermission('canAccessSales', 'canAccessSettings'), getTokenTypes);
router.post('/', requirePermission('canAccessSettings'), createTokenType);
router.put('/:id', requirePermission('canAccessSettings'), updateTokenType);
router.delete('/:id', requirePermission('canAccessSettings'), deleteTokenType);

export default router;
