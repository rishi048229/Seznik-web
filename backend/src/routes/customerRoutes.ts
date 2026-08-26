import express from 'express';
import { getCustomers, getCustomerById, createCustomer, bulkCreateCustomers, updateCustomer, deleteCustomer } from '../controllers/customerController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All customer routes are protected

router.get('/', getCustomers);
// Registered before '/:id' so the literal path is never swallowed by the param route.
router.post('/bulk-create', bulkCreateCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
