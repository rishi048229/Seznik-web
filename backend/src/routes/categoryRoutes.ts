import express from 'express';
import { getCategories, createCategory, updateCategory, toggleCategoryActive, deleteCategory } from '../controllers/categoryController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All category routes are protected

router.get('/', getCategories);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.patch('/:id/toggle', toggleCategoryActive);
router.delete('/:id', deleteCategory);

export default router;
