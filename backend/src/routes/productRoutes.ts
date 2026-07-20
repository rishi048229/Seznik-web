import express from 'express';
import { 
  getProducts, 
  createProduct, 
  updateProduct, 
  softDeleteProduct, 
  bulkSoftDeleteProducts, 
  adjustStock, 
  getProductByBarcode, 
  batchBarcodeStockUpdate, 
  getLowStockProducts 
} from '../controllers/productController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All product routes are protected

router.get('/', getProducts);
router.post('/', createProduct);
router.get('/low-stock', getLowStockProducts);
router.post('/batch-stock-update', batchBarcodeStockUpdate);
router.post('/bulk-delete', bulkSoftDeleteProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.put('/:id', updateProduct);
router.delete('/:id', softDeleteProduct);
router.post('/:id/stock', adjustStock);

export default router;
