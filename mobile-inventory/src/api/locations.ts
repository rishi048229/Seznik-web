import { fetchApi } from './client';
import { Location, ProductLocationStock, StockTransfer } from '@/types/location';

// Multi-location inventory (opt-in — see Settings.locationConfig.enabled). Mirrors the
// web app's locationService.ts field-for-field; "Location" is the API/model name, "Store"
// is the user-facing word used throughout the UI.
export const locationsApi = {
  getLocations: async (): Promise<Location[]> => {
    return fetchApi<Location[]>('/locations');
  },

  createLocation: async (name: string, sortOrder?: number, seedFromCurrentStock?: boolean): Promise<Location> => {
    return fetchApi<Location>('/locations', {
      method: 'POST',
      body: JSON.stringify({ name, sortOrder, seedFromCurrentStock }),
    });
  },

  updateLocation: async (locationId: string, name: string, sortOrder?: number): Promise<void> => {
    await fetchApi(`/locations/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, sortOrder }),
    });
  },

  toggleLocationActive: async (locationId: string, isActive: boolean): Promise<void> => {
    await fetchApi(`/locations/${locationId}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },

  deleteLocation: async (locationId: string): Promise<void> => {
    await fetchApi(`/locations/${locationId}`, { method: 'DELETE' });
  },

  getLocationStock: async (locationId: string): Promise<ProductLocationStock[]> => {
    return fetchApi<ProductLocationStock[]>(`/locations/${locationId}/stock`);
  },

  /** One product's stock/price across every location — for the product edit form's "Stock by Location". */
  getProductLocationStock: async (productId: string): Promise<ProductLocationStock[]> => {
    return fetchApi<ProductLocationStock[]>(`/products/${productId}/location-stock`);
  },

  upsertProductLocationStock: async (
    productId: string,
    locationId: string,
    data: { stock?: number; priceOverride?: number | null; lowStockThreshold?: number | null }
  ): Promise<ProductLocationStock> => {
    return fetchApi<ProductLocationStock>(`/products/${productId}/location-stock/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  createStockTransfer: async (data: {
    productId: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    note?: string;
  }): Promise<StockTransfer> => {
    return fetchApi<StockTransfer>('/locations/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getStockTransfers: async (): Promise<StockTransfer[]> => {
    return fetchApi<StockTransfer[]>('/locations/transfers/history');
  },
};
