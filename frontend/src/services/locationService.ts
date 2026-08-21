import { fetchApi } from './api'
import type { Location, ProductLocationStock, StockTransfer } from '@/types/location.types'

export const getLocations = async (): Promise<Location[]> => {
  return await fetchApi('/locations')
}

export const createLocation = async (name: string, sortOrder?: number): Promise<Location> => {
  return await fetchApi('/locations', {
    method: 'POST',
    body: JSON.stringify({ name, sortOrder }),
  })
}

export const updateLocation = async (locationId: string, name: string, sortOrder?: number): Promise<void> => {
  await fetchApi(`/locations/${locationId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, sortOrder }),
  })
}

export const toggleLocationActive = async (locationId: string, isActive: boolean): Promise<void> => {
  await fetchApi(`/locations/${locationId}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
}

export const deleteLocation = async (locationId: string): Promise<void> => {
  await fetchApi(`/locations/${locationId}`, { method: 'DELETE' })
}

export const getLocationStock = async (locationId: string): Promise<ProductLocationStock[]> => {
  return await fetchApi(`/locations/${locationId}/stock`)
}

export const upsertProductLocationStock = async (
  productId: string,
  locationId: string,
  data: { stock?: number; priceOverride?: number | null; lowStockThreshold?: number | null }
): Promise<ProductLocationStock> => {
  return await fetchApi(`/products/${productId}/location-stock/${locationId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const createStockTransfer = async (data: {
  productId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
  note?: string
}): Promise<StockTransfer> => {
  return await fetchApi('/locations/transfers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const getStockTransfers = async (): Promise<StockTransfer[]> => {
  return await fetchApi('/locations/transfers/history')
}
