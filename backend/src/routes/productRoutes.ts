import express from 'express';
import { 
  getProducts,
  getProductCatalog,
  getProductById,
  createProduct, 
  updateProduct, 
  softDeleteProduct, 
  bulkSoftDeleteProducts, 
  adjustStock, 
  getProductByBarcode, 
  batchBarcodeStockUpdate, 
  getLowStockProducts,
  aiExtractFromDocument,
  aiConvertInvoice,
  bulkImportProducts
} from '../controllers/productController';
import { upsertProductLocationStock, getProductLocationStock } from '../controllers/locationController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(protect); // All product routes are protected

router.get('/', getProducts);
router.post('/', createProduct);

// AI Extraction & Bulk Import Routes (aliases supporting both mobile app and web frontend)
router.post('/ai-extract', aiExtractFromDocument);
router.post('/ai-extract-document', aiExtractFromDocument);
router.post('/ai-convert-invoice', aiConvertInvoice);
router.post('/bulk-create', bulkImportProducts);
router.post('/bulk-import', bulkImportProducts);

router.get('/catalog', getProductCatalog);
router.get('/low-stock', getLowStockProducts);
router.post('/batch-stock-update', batchBarcodeStockUpdate);
router.post('/bulk-delete', bulkSoftDeleteProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.delete('/:id', softDeleteProduct);
router.post('/:id/stock', adjustStock);

// Multi-location inventory (opt-in — see Settings.locationConfig).
router.get('/:productId/location-stock', getProductLocationStock);
router.put('/:productId/location-stock/:locationId', upsertProductLocationStock);

export default router;
