import express from 'express';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';
import {
  addStock,
  createIngredient,
  getSummary,
  listIngredients,
  listRecipes,
  logWastage,
  saveRecipeLine,
} from '../controllers/kitchenInventoryController';

const router = express.Router();
router.use(protect);
router.use(requirePermission('canAccessKOT', 'canAccessProducts'));

router.get('/summary', getSummary);
router.get('/ingredients', listIngredients);
router.post('/ingredients', createIngredient);
router.post('/ingredients/:id/stock', addStock);
router.post('/wastage', logWastage);
router.get('/recipes', listRecipes);
router.post('/recipes', saveRecipeLine);

export default router;
