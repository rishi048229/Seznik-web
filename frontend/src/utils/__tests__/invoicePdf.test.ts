import { describe, expect, it } from 'vitest'
import { toPdfFilename } from '../invoicePdf'

describe('toPdfFilename', () => {
  it('keeps a simple invoice number and adds .pdf', () => {
    expect(toPdfFilename('INV-1042')).toBe('INV-1042.pdf')
  })

  it('does not double the .pdf suffix', () => {
    expect(toPdfFilename('INV-1042.pdf')).toBe('INV-1042.pdf')
  })

  it('strips characters that break file downloads', () => {
    expect(toPdfFilename('INV/1042:final')).toBe('INV-1042-final.pdf')
  })
})
