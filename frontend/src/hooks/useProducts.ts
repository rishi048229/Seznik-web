import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as productService from '@/services/productService'
import type { Product } from '@/types/product.types'
import type { BarcodeStockEntry } from '@/types/barcode.types'

export const useProducts = () => {
  const { user } = useAuth()
  return useQuery({
    queryKey: [QUERY_KEYS.PRODUCTS, user?.uid],
    queryFn: () => productService.getProducts(user!.uid),
    enabled: !!user,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export const useCreateProduct = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'sku'>) =>
      productService.createProduct(user!.uid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useUpdateProduct = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> }) =>
      productService.updateProduct(user!.uid, productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useAdjustStock = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, qty, reason }: { productId: string; qty: number; reason: string }) =>
      productService.adjustStock(user!.uid, productId, qty, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useBarcodeProductLookup = () => {
  const { user } = useAuth()
  return useMutation({
    mutationFn: (barcode: string) => productService.getProductByBarcode(user!.uid, barcode),
  })
}

export const useBulkDeleteProducts = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => productService.bulkSoftDeleteProducts(user!.uid, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useBatchBarcodeStockUpdate = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entries: BarcodeStockEntry[]) =>
      productService.batchBarcodeStockUpdate(user!.uid, entries),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useAiExtractDocument = () => {
  const { user } = useAuth()
  return useMutation({
    mutationFn: ({ documentData, mimeType, customApiKey }: { documentData: string; mimeType?: string; customApiKey?: string }) =>
      productService.extractProductsFromAiDocument(user!.uid, documentData, mimeType, customApiKey),
  })
}

export const useBulkImportProducts = () => {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (products: Partial<productService.AiExtractedProduct>[]) =>
      productService.bulkImportProducts(user!.uid, products),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.REPORTS_TOP_CATEGORIES] })
      qc.refetchQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
      qc.refetchQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}
