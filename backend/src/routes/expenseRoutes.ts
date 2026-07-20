import express from 'express';
import { getExpenses, createExpense, deleteExpense } from '../controllers/expenseController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getExpenses);
router.post('/', createExpense);
router.delete('/:id', deleteExpense);

export default router;
