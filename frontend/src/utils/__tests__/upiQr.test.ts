import { describe, it, expect } from 'vitest'
import { buildUpiPayLink, isValidUpiVpa } from '@/utils/upiQr'

describe('isValidUpiVpa', () => {
  it('accepts merchant VPAs', () => {
    expect(isValidUpiVpa('shopname@okhdfcbank')).toBe(true)
    expect(isValidUpiVpa('9876543210@paytm')).toBe(true)
    expect(isValidUpiVpa('  store.pos@ybl  ')).toBe(true)
  })

  it('rejects empty or placeholder values', () => {
    expect(isValidUpiVpa('')).toBe(false)
    expect(isValidUpiVpa('   ')).toBe(false)
    expect(isValidUpiVpa('store@upi')).toBe(true)
    expect(isValidUpiVpa('not-an-id')).toBe(false)
    expect(isValidUpiVpa('@okhdfcbank')).toBe(false)
  })
})

describe('buildUpiPayLink', () => {
  it('keeps a literal UPI ID and encodes the exact bill amount', () => {
    const uri = buildUpiPayLink({
      upiId: 'shop@okhdfcbank',
      payeeName: 'Seznik Cafe',
      amount: 249.5,
      note: 'INV-42',
    })
    expect(uri).toContain('pa=shop@okhdfcbank')
    expect(uri).not.toContain('pa=shop%40okhdfcbank')
    expect(uri).toContain('am=249.50')
    expect(uri.startsWith('upi://pay?')).toBe(true)
  })
})
