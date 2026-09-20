import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import type { CartItem, Product } from '@/types/product.types'
import { isExpiringSoon, formatExpiryMessage } from '@/utils/expiry'
import { useAuth } from '@/contexts/AuthContext'
import { adoptLegacyJson, writeAccountJson } from '@/utils/accountStorage'
import { useProducts } from '@/hooks/useProducts'

const CART_STORAGE_KEY = 'pos_cart'

export const useCart = () => {
  const { user } = useAuth()
  const userId = user?.id || user?.uid
  const { data: products, isFetched } = useProducts()
  const ownedIds = useMemo(() => new Set((products ?? []).map(p => p.id)), [products])
  const hydratedFor = useRef<string | null>(null)

  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    if (!userId) {
      hydratedFor.current = null
      setItems([])
      return
    }
    if (!isFetched) return
    setItems(adoptLegacyJson<CartItem>(CART_STORAGE_KEY, userId, ownedIds, []))
    hydratedFor.current = userId
  }, [userId, isFetched, ownedIds])

  useEffect(() => {
    if (!userId || hydratedFor.current !== userId) return
    writeAccountJson(CART_STORAGE_KEY, userId, items)
  }, [items, userId])

  const addItem = useCallback((product: Product) => {
    if (isExpiringSoon(product.expiryDate)) {
      toast(`⚠ ${product.name} — ${formatExpiryMessage(product.expiryDate)}`, { icon: '⏳' })
    }
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        return prev.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        imageURL: product.imageURL,
        quantity: 1,
        sellingPrice: product.sellingPrice,
        taxRate: product.taxRate ?? 0,
        priceIncludesGst: product.priceIncludesGst ?? false,
        discount: 0,
      }]
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }, [])

  const updateQty = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.productId !== productId))
    } else {
      setItems(prev =>
        prev.map(i =>
          i.productId === productId ? { ...i, quantity } : i
        )
      )
    }
  }, [])

  const applyDiscount = useCallback((productId: string, discount: number) => {
    setItems(prev =>
      prev.map(i =>
        i.productId === productId ? { ...i, discount } : i
      )
    )
  }, [])

  // Refreshes an already-added line when its underlying product is edited
  // mid-sale (e.g. from the "Scan to Bill" quick-edit) — a no-op if that
  // product isn't currently in the cart.
  const updateItemDetails = useCallback((
    productId: string,
    updates: Partial<Pick<CartItem, 'productName' | 'imageURL' | 'sellingPrice' | 'taxRate' | 'priceIncludesGst'>>
  ) => {
    setItems(prev =>
      prev.map(i =>
        i.productId === productId ? { ...i, ...updates } : i
      )
    )
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => {
      const lineTotal = (i.sellingPrice * i.quantity) - i.discount
      if (i.priceIncludesGst && i.taxRate > 0) {
        return s + (lineTotal / (1 + i.taxRate / 100))
      }
      return s + lineTotal
    }, 0)

    const tax = items.reduce((s, i) => {
      const lineTotal = (i.sellingPrice * i.quantity) - i.discount
      if (i.priceIncludesGst && i.taxRate > 0) {
        const baseAmt = lineTotal / (1 + i.taxRate / 100)
        return s + (lineTotal - baseAmt)
      }
      return s + (lineTotal * (i.taxRate || 0) / 100)
    }, 0)

    return {
      subtotal,
      tax,
      grandTotal: subtotal + tax,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
    }
  }, [items])

  return {
    items,
    addItem,
    removeItem,
    updateQty,
    applyDiscount,
    updateItemDetails,
    clearCart,
    totals,
  }
}
