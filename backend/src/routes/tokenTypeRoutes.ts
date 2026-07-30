import express from 'express';
import { getTokenTypes, createTokenType, updateTokenType, deleteTokenType } from '../controllers/tokenTypeController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All token type routes are protected

router.get('/', getTokenTypes);
router.post('/', createTokenType);
router.put('/:id', updateTokenType);
router.delete('/:id', deleteTokenType);

export default router;
