import type { PrinterConfig } from '@/types/settings.types'

type PrinterConfigLoose = Partial<PrinterConfig> & Record<string, unknown>

const isThermalPaper = (v: unknown): v is '58mm' | '80mm' => v === '58mm' || v === '80mm'

/** Web historically stored `paperSize`; mobile stored `paperWidth`. Either is enough. */
export function resolveThermalPaper(
  printerConfig?: PrinterConfigLoose | null
): '58mm' | '80mm' {
  const cfg = printerConfig || {}
  if (isThermalPaper(cfg.paperWidth)) return cfg.paperWidth
  if (isThermalPaper(cfg.paperSize)) return cfg.paperSize
  return '58mm'
}

export function resolveThermalPrintOptions(printerConfig?: PrinterConfigLoose | null): {
  paperSize: '58mm' | '80mm'
  printCopies: number
  autoCut: boolean
  topMargin: number
  fontSize: 'small' | 'medium' | 'large'
} {
  const cfg = printerConfig || {}
  const copies = Number(cfg.printCopies)
  const margin = Number(cfg.topMargin)
  const font = cfg.fontSize
  return {
    paperSize: resolveThermalPaper(cfg),
    printCopies: Number.isFinite(copies) ? Math.min(3, Math.max(1, Math.round(copies))) : 1,
    autoCut: cfg.autoCut !== false,
    topMargin: Number.isFinite(margin) ? Math.min(10, Math.max(0, Math.round(margin))) : 0,
    fontSize: font === 'small' || font === 'large' || font === 'medium' ? font : 'medium',
  }
}

export function withSyncedPaperKeys<T extends PrinterConfigLoose>(config: T): T {
  const paper = resolveThermalPaper(config)
  return { ...config, paperSize: paper, paperWidth: paper }
}
