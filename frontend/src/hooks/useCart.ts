import { useState, useEffect, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import type { CartItem, Product } from '@/types/product.types'
import { isExpiringSoon, formatExpiryMessage } from '@/utils/expiry'

import { roundCurrency } from '@/utils/currency'

export const useCart = () => {
  const { user } = useAuth()
  const userId = user?.id || user?.uid || 'guest'
  const storageKey = `pos_cart_${userId}`

  const [items, setItems] = useState<CartItem[]>(() => {
    // Remove legacy un-scoped key to avoid showing foreign/stale items across sessions
    try {
      localStorage.removeItem('pos_cart')
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Whenever the active user changes (login, register, logout, switch account), sync to that user's cart
  useEffect(() => {
    try {
      localStorage.removeItem('pos_cart')
      const saved = localStorage.getItem(storageKey)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(saved ? JSON.parse(saved) : [])
    } catch {
      setItems([])
    }
  }, [storageKey])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch (e) {
      console.error('Failed to persist POS cart', e)
    }
  }, [storageKey, items])

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
    const rawSubtotal = items.reduce((s, i) => {
      const lineTotal = (i.sellingPrice * i.quantity) - i.discount
      if (i.priceIncludesGst && i.taxRate > 0) {
        return s + (lineTotal / (1 + i.taxRate / 100))
      }
      return s + lineTotal
    }, 0)

    const rawTax = items.reduce((s, i) => {
      const lineTotal = (i.sellingPrice * i.quantity) - i.discount
      if (i.priceIncludesGst && i.taxRate > 0) {
        const baseAmt = lineTotal / (1 + i.taxRate / 100)
        return s + (lineTotal - baseAmt)
      }
      return s + (lineTotal * (i.taxRate || 0) / 100)
    }, 0)

    const subtotal = roundCurrency(rawSubtotal)
    const tax = roundCurrency(rawTax)
    const grandTotal = roundCurrency(subtotal + tax)

    return {
      subtotal,
      tax,
      grandTotal,
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
