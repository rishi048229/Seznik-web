import { describe, expect, it } from 'vitest'
import { completedSales, isCancelledSale } from '../saleStatus'

describe('saleStatus', () => {
  it('treats cancelled sales as cancelled', () => {
    expect(isCancelledSale({ status: 'cancelled' })).toBe(true)
    expect(isCancelledSale({ status: 'completed' })).toBe(false)
    expect(isCancelledSale({})).toBe(false)
  })

  it('drops cancelled rows from revenue lists', () => {
    const rows = [
      { id: '1', status: 'completed' },
      { id: '2', status: 'cancelled' },
    ]
    expect(completedSales(rows).map((r) => r.id)).toEqual(['1'])
  })
})
