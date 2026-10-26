import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import * as productService from '@/services/productService'
import type { Product } from '@/types/product.types'
import type { BarcodeStockEntry } from '@/types/barcode.types'

const accountId = (user: { id?: string; uid?: string } | null | undefined) =>
  user?.id || user?.uid || ''

const productsKey = (userId: string) => [QUERY_KEYS.PRODUCTS, userId] as const

/** Keep list cache free of multi‑MB base64 blobs. */
const slimCachedProduct = (p: Product): Product => {
  if (p.imageURL?.startsWith('data:') && p.imageURL.length > 4096) {
    return { ...p, imageURL: undefined }
  }
  return p
}

export const useProducts = (opts?: { enabled?: boolean }) => {
  const { user } = useAuth()
  const userId = accountId(user)
  return useQuery({
    queryKey: productsKey(userId),
    queryFn: () => productService.getProducts(userId),
    enabled: !!userId && opts?.enabled !== false,
    // Catalog is patched on mutate; avoid re-downloading on every navigation.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export const useProduct = (productId: string | null | undefined) => {
  const { user } = useAuth()
  const userId = accountId(user)
  return useQuery({
    queryKey: [...productsKey(userId), productId],
    queryFn: () => productService.getProduct(userId, productId!),
    enabled: !!userId && !!productId,
    staleTime: 30 * 1000,
  })
}

export const useCreateProduct = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'sku'>) =>
      productService.createProduct(userId, data),
    onSuccess: (created) => {
      if (created && typeof created === 'object' && 'id' in created) {
        const product = slimCachedProduct(created as Product)
        qc.setQueryData<Product[]>(productsKey(userId), (prev) =>
          prev ? [product, ...prev.filter((p) => p.id !== product.id)] : [product]
        )
      }
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useUpdateProduct = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      productId,
      data,
    }: {
      productId: string
      data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
    }) => productService.updateProduct(userId, productId, data),
    onMutate: async ({ productId, data }) => {
      await qc.cancelQueries({ queryKey: productsKey(userId) })
      const previous = qc.getQueryData<Product[]>(productsKey(userId))
      qc.setQueryData<Product[]>(productsKey(userId), (prev) =>
        (prev ?? []).map((p) =>
          p.id === productId
            ? slimCachedProduct({
                ...p,
                ...data,
                id: p.id,
                updatedAt: new Date(),
              } as Product)
            : p
        )
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(productsKey(userId), ctx.previous)
      }
    },
    onSuccess: (updated, { productId }) => {
      if (updated && typeof updated === 'object' && 'id' in updated) {
        const product = slimCachedProduct(updated as Product)
        qc.setQueryData<Product[]>(productsKey(userId), (prev) =>
          (prev ?? []).map((p) => (p.id === product.id ? { ...p, ...product } : p))
        )
        qc.setQueryData([...productsKey(userId), productId], updated)
      }
    },
    onSettled: () => {
      // Background refresh — UI already shows optimistic/server patch.
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useAdjustStock = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, qty, reason }: { productId: string; qty: number; reason: string }) =>
      productService.adjustStock(userId, productId, qty, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useBarcodeProductLookup = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  return useMutation({
    mutationFn: (barcode: string) => productService.getProductByBarcode(userId, barcode),
  })
}

export const useBulkDeleteProducts = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => productService.bulkSoftDeleteProducts(userId, ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: productsKey(userId) })
      const previous = qc.getQueryData<Product[]>(productsKey(userId))
      const idSet = new Set(ids)
      qc.setQueryData<Product[]>(productsKey(userId), (prev) =>
        (prev ?? []).map((p) => (idSet.has(p.id) ? { ...p, isActive: false } : p))
      )
      return { previous }
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(productsKey(userId), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useBatchBarcodeStockUpdate = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entries: BarcodeStockEntry[]) =>
      productService.batchBarcodeStockUpdate(userId, entries),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
    },
  })
}

export const useAiExtractDocument = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  return useMutation({
    mutationFn: ({
      documentData,
      mimeType,
      customApiKey,
    }: {
      documentData: string
      mimeType?: string
      customApiKey?: string
    }) => productService.extractProductsFromAiDocument(userId, documentData, mimeType, customApiKey),
  })
}

export const useBulkImportProducts = () => {
  const { user } = useAuth()
  const userId = accountId(user)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (products: Partial<productService.AiExtractedProduct>[]) =>
      productService.bulkImportProducts(userId, products),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
      await qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
      await qc.invalidateQueries({ queryKey: [QUERY_KEYS.REPORTS_TOP_CATEGORIES] })
      await qc.refetchQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
      await qc.refetchQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
    },
  })
}
