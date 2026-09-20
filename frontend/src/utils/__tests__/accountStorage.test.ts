import { afterEach, describe, expect, it } from 'vitest'
import { adoptLegacyJson, readAccountJson, writeAccountJson } from '../accountStorage'

const KEY = 'pos_lite_recent_items'

afterEach(() => {
  localStorage.clear()
})

describe('adoptLegacyJson', () => {
  it('does not copy another shop’s unscoped recent items into a new account', () => {
    localStorage.setItem(KEY, JSON.stringify([
      { productId: 'other-shop-prod', productName: 'Aashirvaad Biscuits', sellingPrice: 860 },
    ]))

    const result = adoptLegacyJson(KEY, 'new-user', new Set<string>(), [])
    expect(result).toEqual([])
    expect(readAccountJson(KEY, 'new-user')).toBeUndefined()
    expect(localStorage.getItem(KEY)).toBeTruthy()
  })

  it('keeps this shop’s namespaced items and drops ids that no longer belong here', () => {
    writeAccountJson(KEY, 'shop-a', [
      { productId: 'owned-1', productName: 'Milk' },
      { productId: 'gone', productName: 'Deleted' },
    ])

    const result = adoptLegacyJson(KEY, 'shop-a', new Set(['owned-1']), [])
    expect(result).toEqual([{ productId: 'owned-1', productName: 'Milk' }])
  })

  it('migrates a legacy cart only when a catalog id belongs to this shop', () => {
    localStorage.setItem('pos_lite_cart', JSON.stringify([
      { id: 'owned-1', productName: 'Milk', sellingPrice: 30 },
      { id: 'other', productName: 'Phone', sellingPrice: 7000 },
    ]))

    const result = adoptLegacyJson('pos_lite_cart', 'shop-a', new Set(['owned-1']), [])
    expect(result).toEqual([{ id: 'owned-1', productName: 'Milk', sellingPrice: 30 }])
    expect(localStorage.getItem('pos_lite_cart')).toBeNull()
  })
})
