import { fetchApi } from './api'

export interface Category {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const getCategories = async (uid: string): Promise<Category[]> => {
  // Using token-based auth, uid in URL isn't strictly necessary but we can just hit /categories
  return await fetchApi('/categories')
}

export const createCategory = async (uid: string, name: string): Promise<string> => {
  const category = await fetchApi('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return category.id
}

export const updateCategory = async (uid: string, categoryId: string, name: string): Promise<void> => {
  await fetchApi(`/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export const toggleCategoryActive = async (uid: string, categoryId: string, isActive: boolean): Promise<void> => {
  await fetchApi(`/categories/${categoryId}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
}

export const deleteCategory = async (uid: string, categoryId: string): Promise<void> => {
  await fetchApi(`/categories/${categoryId}`, {
    method: 'DELETE',
  })
}
