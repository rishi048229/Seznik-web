import { fetchApi } from './client';

export interface KitchenIngredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
}

export const kitchenApi = {
  listIngredients: () => fetchApi<KitchenIngredient[]>('/kitchen/ingredients'),
  createIngredient: (data: { name: string; unit: string; currentStock: number; lowStockThreshold: number }) =>
    fetchApi<KitchenIngredient>('/kitchen/ingredients', { method: 'POST', body: JSON.stringify(data) }),
  addStock: (id: string, data: { quantity: number; supplierName?: string; asPurchase?: boolean }) =>
    fetchApi(`/kitchen/ingredients/${id}/stock`, { method: 'POST', body: JSON.stringify(data) }),
  logWastage: (data: { ingredientId: string; quantity: number; reason?: string }) =>
    fetchApi('/kitchen/wastage', { method: 'POST', body: JSON.stringify(data) }),
};
