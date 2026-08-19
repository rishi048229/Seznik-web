import { fetchApi } from './client';
import { RestaurantTable } from '@/types/kot';

export const restaurantTablesApi = {
  getTables: async (): Promise<RestaurantTable[]> => {
    return fetchApi<RestaurantTable[]>('/restaurant-tables');
  },

  createTable: async (payload: { name: string; sortOrder?: number }): Promise<RestaurantTable> => {
    return fetchApi<RestaurantTable>('/restaurant-tables', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateTable: async (id: string, payload: { name?: string; sortOrder?: number; isActive?: boolean }): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/restaurant-tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteTable: async (id: string): Promise<{ success: boolean }> => {
    return fetchApi<{ success: boolean }>(`/restaurant-tables/${id}`, {
      method: 'DELETE',
    });
  },
};
