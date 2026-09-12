import express from 'express';
import {
  getTables,
  createTable,
  updateTable,
  deleteTable,
} from '../controllers/restaurantTableController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('canAccessSales', 'canAccessSettings'), getTables);
router.post('/', requirePermission('canAccessSettings'), createTable);
router.put('/:id', requirePermission('canAccessSettings', 'canAccessSales'), updateTable);
router.delete('/:id', requirePermission('canAccessSettings'), deleteTable);

export default router;
