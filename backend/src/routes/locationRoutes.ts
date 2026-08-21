import express from 'express';
import {
  getLocations,
  createLocation,
  updateLocation,
  toggleLocationActive,
  deleteLocation,
  getLocationStock,
  createStockTransfer,
  getStockTransfers,
} from '../controllers/locationController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', getLocations);
router.post('/', createLocation);
router.put('/:id', updateLocation);
router.patch('/:id/toggle', toggleLocationActive);
router.delete('/:id', deleteLocation);
router.get('/:id/stock', getLocationStock);

router.get('/transfers/history', getStockTransfers);
router.post('/transfers', createStockTransfer);

export default router;
