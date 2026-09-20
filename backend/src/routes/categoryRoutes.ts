import express from 'express';
import { getCategories, createCategory, updateCategory, toggleCategoryActive, deleteCategory } from '../controllers/categoryController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect); // All category routes are protected

const canViewCatalog = requirePermission('canAccessProducts', 'canAccessSales');
const canManageCatalog = requirePermission('canAccessProducts');

router.get('/', canViewCatalog, getCategories);
router.post('/', canManageCatalog, createCategory);
router.put('/:id', canManageCatalog, updateCategory);
router.patch('/:id/toggle', canManageCatalog, toggleCategoryActive);
router.delete('/:id', canManageCatalog, deleteCategory);

export default router;
