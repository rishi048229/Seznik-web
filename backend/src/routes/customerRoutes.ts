import express from 'express';
import { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } from '../controllers/customerController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

router.use(protect); // All customer routes are protected

const canUseCustomers = requirePermission('canAccessCustomers', 'canAccessSales');

router.get('/', canUseCustomers, getCustomers);
router.get('/:id', canUseCustomers, getCustomerById);
router.post('/', canUseCustomers, createCustomer);
router.put('/:id', canUseCustomers, updateCustomer);
router.delete('/:id', requirePermission('canAccessCustomers'), deleteCustomer);

export default router;
