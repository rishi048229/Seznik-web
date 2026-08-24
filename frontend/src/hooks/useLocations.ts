import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as locationService from '@/services/locationService'

export const useLocations = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.LOCATIONS, user?.uid],
    queryFn: () => locationService.getLocations(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreateLocation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, sortOrder, seedFromCurrentStock }: { name: string; sortOrder?: number; seedFromCurrentStock?: boolean }) =>
      locationService.createLocation(name, sortOrder, seedFromCurrentStock),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.LOCATIONS] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.LOCATION_STOCK] })
    },
  })
}

export const useUpdateLocation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ locationId, name, sortOrder }: { locationId: string; name: string; sortOrder?: number }) =>
      locationService.updateLocation(locationId, name, sortOrder),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEYS.LOCATIONS] }),
  })
}

export const useToggleLocationActive = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ locationId, isActive }: { locationId: string; isActive: boolean }) =>
      locationService.toggleLocationActive(locationId, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEYS.LOCATIONS] }),
  })
}

export const useDeleteLocation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (locationId: string) => locationService.deleteLocation(locationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEYS.LOCATIONS] }),
  })
}

export const useLocationStock = (locationId: string | null) => {
  return useQuery({
    queryKey: [QUERY_KEYS.LOCATION_STOCK, locationId],
    queryFn: () => locationService.getLocationStock(locationId!),
    enabled: !!locationId,
    staleTime: 60 * 1000,
  })
}

/** One product's stock/price across every location — for the Products page's "Stock by Location" section. */
export const useProductLocationStock = (productId: string | null) => {
  return useQuery({
    queryKey: [QUERY_KEYS.LOCATION_STOCK, 'product', productId],
    queryFn: () => locationService.getProductLocationStock(productId!),
    enabled: !!productId,
    staleTime: 30 * 1000,
  })
}

export const useUpsertProductLocationStock = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      productId,
      locationId,
      data,
    }: {
      productId: string
      locationId: string
      data: { stock?: number; priceOverride?: number | null; lowStockThreshold?: number | null }
    }) => locationService.upsertProductLocationStock(productId, locationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.LOCATION_STOCK] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useCreateStockTransfer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: locationService.createStockTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.LOCATION_STOCK] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_TRANSFERS] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useStockTransfers = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_TRANSFERS, user?.uid],
    queryFn: () => locationService.getStockTransfers(),
    enabled: !!user,
    staleTime: 30 * 1000,
  })
}
