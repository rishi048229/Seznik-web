import { fetchApi } from './api'

export interface KitchenIngredient {
  id: string
  name: string
  unit: string
  currentStock: number
  lowStockThreshold: number
}

export interface RecipeLine {
  id: string
  productId: string
  ingredientId: string
  quantity: number
}

export const getKitchenSummary = () =>
  fetchApi<{ tracked: number; lowStock: number; outOfStock: number }>('/kitchen/summary')

export const listKitchenIngredients = () =>
  fetchApi<KitchenIngredient[]>('/kitchen/ingredients')

export const createKitchenIngredient = (data: {
  name: string
  unit: string
  currentStock: number
  lowStockThreshold: number
}) =>
  fetchApi<KitchenIngredient>('/kitchen/ingredients', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const addKitchenStock = (
  id: string,
  data: { quantity: number; supplierName?: string; asPurchase?: boolean }
) =>
  fetchApi<KitchenIngredient>(`/kitchen/ingredients/${id}/stock`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const logKitchenWastage = (data: { ingredientId: string; quantity: number; reason?: string }) =>
  fetchApi('/kitchen/wastage', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const listKitchenRecipes = () => fetchApi<RecipeLine[]>('/kitchen/recipes')

export const saveKitchenRecipeLine = (data: { productId: string; ingredientId: string; quantity: number }) =>
  fetchApi<RecipeLine>('/kitchen/recipes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
