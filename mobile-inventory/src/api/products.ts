import { fetchApi } from './client';
import { Category, CreateProductPayload, Product, StockAdjustmentPayload } from '@/types/product';

// Normalise a single product coming back from the backend:
// Prisma stores `imageURL` but the frontend expects `imageUrl`.
const normalizeProduct = (raw: any): Product => ({
  ...raw,
  imageUrl: raw.imageURL ?? raw.imageUrl ?? null,
});

export const productsApi = {
  getProducts: async (): Promise<Product[]> => {
    const raw = await fetchApi<any>('/products');
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.products) ? raw.products : []);
    return list.map(normalizeProduct);
  },

  getLowStockProducts: async (): Promise<Product[]> => {
    const raw = await fetchApi<any>('/products/low-stock');
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.products) ? raw.products : []);
    return list.map(normalizeProduct);
  },

  getProductByBarcode: async (barcode: string): Promise<Product> => {
    const raw = await fetchApi<any>(`/products/barcode/${encodeURIComponent(barcode)}`);
    return normalizeProduct(raw);
  },

  createProduct: async (payload: CreateProductPayload): Promise<Product> => {
    // Map frontend field names → backend Prisma column names
    const { imageUrl, ...rest } = payload;
    const body: any = {
      ...rest,
      imageUrl, // backend controller maps this → imageURL
      sku: payload.sku || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    };
    const raw = await fetchApi<any>('/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return normalizeProduct(raw);
  },

  updateProduct: async (id: string, payload: Partial<CreateProductPayload>): Promise<Product> => {
    const raw = await fetchApi<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return normalizeProduct(raw);
  },

  deleteProduct: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  adjustStock: async (id: string, payload: StockAdjustmentPayload): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Categories API
  getCategories: async (): Promise<Category[]> => {
    return fetchApi<Category[]>('/categories');
  },

  createCategory: async (name: string, parentId?: string): Promise<Category> => {
    return fetchApi<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    });
  },

  updateCategory: async (id: string, name: string, parentId?: string): Promise<Category> => {
    return fetchApi<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, parentId }),
    });
  },

  deleteCategory: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  aiExtractProducts: async (payload: { imageBase64?: string; documentData?: string; mimeType?: string; textData?: string }): Promise<{ success: boolean; count: number; products: any[] }> => {
    const bodyPayload = {
      ...payload,
      documentData: payload.documentData || payload.imageBase64 || payload.textData,
      imageBase64: payload.imageBase64 || payload.documentData,
    };
    return fetchApi<{ success: boolean; count: number; products: any[] }>('/products/ai-extract', {
      method: 'POST',
      body: JSON.stringify(bodyPayload),
      timeoutMs: 120000,
    });
  },

  aiConvertInvoice: async (payload: { imageBase64?: string; documentData?: string; mimeType?: string; textData?: string }): Promise<{ success: boolean; saleData: any }> => {
    const bodyPayload = {
      ...payload,
      documentData: payload.documentData || payload.imageBase64 || payload.textData,
      imageBase64: payload.imageBase64 || payload.documentData,
    };
    return fetchApi<{ success: boolean; saleData: any }>('/products/ai-convert-invoice', {
      method: 'POST',
      body: JSON.stringify(bodyPayload),
      timeoutMs: 120000,
    });
  },

  bulkCreateProducts: async (products: any[]): Promise<{ success: boolean; count: number; products: Product[] }> => {
    const raw = await fetchApi<any>('/products/bulk-create', {
      method: 'POST',
      body: JSON.stringify({ products }),
      timeoutMs: 120000,
    });
    return {
      ...raw,
      products: (raw.products || []).map(normalizeProduct),
    };
  },
};





