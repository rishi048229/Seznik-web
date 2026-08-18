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
  getLowStockProducts,
  aiExtractFromDocument,
  bulkImportProducts,
  checkAiStatus
} from '../controllers/productController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

// Public / Diagnostic AI Status Check Endpoint (no auth token required)
router.get('/ai-status', checkAiStatus);

router.use(protect); // All product CRUD routes are protected

router.get('/', getProducts);
router.post('/', createProduct);
router.post('/ai-extract-document', aiExtractFromDocument);
router.post('/bulk-import', bulkImportProducts);
router.get('/low-stock', getLowStockProducts);
router.post('/batch-stock-update', batchBarcodeStockUpdate);
router.post('/bulk-delete', bulkSoftDeleteProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.put('/:id', updateProduct);
router.delete('/:id', softDeleteProduct);
router.post('/:id/stock', adjustStock);

export default router;
