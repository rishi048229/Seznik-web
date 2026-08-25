import express from 'express';
import {
  getTables,
  createTable,
  updateTable,
  deleteTable,
} from '../controllers/restaurantTableController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getTables);
router.post('/', createTable);
router.put('/:id', updateTable);
router.delete('/:id', deleteTable);

export default router;
