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
  getExpiringProducts,
  aiExtractFromDocument,
  bulkImportProducts,
  checkAiStatus
} from '../controllers/productController';
import { upsertProductLocationStock, getProductLocationStock } from '../controllers/locationController';
import { protect } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/requirePermission';

const router = express.Router();

// Public / Diagnostic AI Status Check Endpoint (no auth token required)
router.get('/ai-status', checkAiStatus);

router.use(protect); // All product CRUD routes are protected

const canViewCatalog = requirePermission('canAccessProducts', 'canAccessSales', 'canManipulateStock');
const canManageCatalog = requirePermission('canAccessProducts');
const canChangeStock = requirePermission('canManipulateStock', 'canAccessProducts');

router.get('/', canViewCatalog, getProducts);
router.post('/', canManageCatalog, createProduct);
router.post('/ai-extract-document', canManageCatalog, aiExtractFromDocument);
router.post('/bulk-import', canManageCatalog, bulkImportProducts);
router.get('/low-stock', canViewCatalog, getLowStockProducts);
router.get('/expiring', canViewCatalog, getExpiringProducts);
router.get('/:productId/location-stock', canViewCatalog, getProductLocationStock);
router.put('/:productId/location-stock/:locationId', canChangeStock, upsertProductLocationStock);
router.post('/batch-stock-update', canChangeStock, batchBarcodeStockUpdate);
router.post('/bulk-delete', canManageCatalog, bulkSoftDeleteProducts);
router.get('/barcode/:barcode', canViewCatalog, getProductByBarcode);
router.put('/:id', canManageCatalog, updateProduct);
router.delete('/:id', canManageCatalog, softDeleteProduct);
router.post('/:id/stock', canChangeStock, adjustStock);

export default router;
