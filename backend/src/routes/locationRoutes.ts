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
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect);

const canViewLocations = requirePermission('canAccessProducts', 'canAccessSales', 'canManipulateStock');
const canManageLocations = requirePermission('canAccessProducts', 'canAccessSettings');
const canMoveStock = requirePermission('canManipulateStock', 'canAccessProducts');

router.get('/', canViewLocations, getLocations);
router.post('/', canManageLocations, createLocation);
router.put('/:id', canManageLocations, updateLocation);
router.patch('/:id/toggle', canManageLocations, toggleLocationActive);
router.delete('/:id', canManageLocations, deleteLocation);
router.get('/:id/stock', canViewLocations, getLocationStock);

router.get('/transfers/history', canMoveStock, getStockTransfers);
router.post('/transfers', canMoveStock, createStockTransfer);

export default router;
