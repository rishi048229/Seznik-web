import { fetchApi } from './api'

export interface Category {
  id: string
  name: string
  isActive: boolean
  /** null/undefined = top-level category. Otherwise the id of its parent category. */
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export const getCategories = async (uid: string): Promise<Category[]> => {
  // Using token-based auth, uid in URL isn't strictly necessary but we can just hit /categories
  return await fetchApi('/categories')
}

export const createCategory = async (uid: string, name: string, parentId?: string | null): Promise<string> => {
  const category = await fetchApi('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, parentId: parentId || undefined }),
  })
  return category.id
}

export const updateCategory = async (uid: string, categoryId: string, name: string, parentId?: string | null): Promise<void> => {
  await fetchApi(`/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, parentId }),
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
