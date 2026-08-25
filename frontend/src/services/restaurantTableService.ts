import { fetchApi } from './api'
import type { RestaurantTable } from '@/types/kot.types'

export const getTables = async (): Promise<RestaurantTable[]> => {
  return await fetchApi('/restaurant-tables')
}

export const createTable = async (data: {
  name: string
  capacity?: number | null
  sortOrder?: number
}): Promise<RestaurantTable> => {
  return await fetchApi('/restaurant-tables', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const updateTable = async (
  id: string,
  data: { name?: string; capacity?: number | null; sortOrder?: number; isActive?: boolean }
): Promise<void> => {
  await fetchApi(`/restaurant-tables/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const deleteTable = async (id: string): Promise<void> => {
  await fetchApi(`/restaurant-tables/${id}`, { method: 'DELETE' })
}
