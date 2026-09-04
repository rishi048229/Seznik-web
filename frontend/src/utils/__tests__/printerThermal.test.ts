import { describe, it, expect } from 'vitest'
import { resolveThermalPaper, resolveThermalPrintOptions, withSyncedPaperKeys } from '@/utils/printerThermal'

describe('printerThermal', () => {
  it('prefers paperWidth over paperSize', () => {
    expect(resolveThermalPaper({ paperWidth: '58mm', paperSize: '80mm' })).toBe('58mm')
  })

  it('falls back to paperSize when paperWidth is missing', () => {
    expect(resolveThermalPaper({ paperSize: '80mm' })).toBe('80mm')
  })

  it('defaults copies to 1 and autoCut to true', () => {
    const opts = resolveThermalPrintOptions({})
    expect(opts.printCopies).toBe(1)
    expect(opts.autoCut).toBe(true)
    expect(opts.paperSize).toBe('58mm')
    expect(opts.fontSize).toBe('medium')
    expect(opts.receiptFont).toBe('classic')
  })

  it('resolves receiptFont from printerConfig', () => {
    const opts = resolveThermalPrintOptions({ receiptFont: 'serif' })
    expect(opts.receiptFont).toBe('serif')
  })

  it('maps legacy compact receiptFont to classic', () => {
    const opts = resolveThermalPrintOptions({ receiptFont: 'compact' })
    expect(opts.receiptFont).toBe('classic')
  })

  it('clamps copies and mirrors paper keys', () => {
    const opts = resolveThermalPrintOptions({ paperWidth: '80mm', printCopies: 9, autoCut: false, topMargin: 4 })
    expect(opts.printCopies).toBe(3)
    expect(opts.autoCut).toBe(false)
    expect(opts.topMargin).toBe(4)
    expect(opts.paperSize).toBe('80mm')
    const synced = withSyncedPaperKeys({ paperSize: '80mm' as const })
    expect(synced.paperWidth).toBe('80mm')
    expect(synced.paperSize).toBe('80mm')
  })
})
