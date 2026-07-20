import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CartItem, Product } from '@/types/product.types'

export const useCart = () => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('pos_cart')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(items))
  }, [items])

  const addItem = useCallback((product: Product) => {
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

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (s, i) => s + (i.sellingPrice * i.quantity) - i.discount,
      0
    )
    const tax = items.reduce(
      (s, i) => s + ((i.sellingPrice * i.quantity - i.discount) * (i.taxRate || 0) / 100),
      0
    )
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
    clearCart,
    totals,
  }
}
