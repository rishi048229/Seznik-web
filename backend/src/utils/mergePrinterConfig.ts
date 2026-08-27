/**
 * Shallow-merge printerConfig patches so web and mobile can share one JSON blob
 * without wiping each other's keys (web: paperSize / labels / A4; mobile:
 * paperWidth / copies / autoCut / topMargin / density).
 */

export type PrinterConfigLike = Record<string, unknown>

const isThermalPaper = (v: unknown): v is '58mm' | '80mm' => v === '58mm' || v === '80mm'

/** Prefer paperWidth, then paperSize — both clients historically used one or the other. */
export function resolveThermalPaper(config: PrinterConfigLike): '58mm' | '80mm' | undefined {
  if (isThermalPaper(config.paperWidth)) return config.paperWidth
  if (isThermalPaper(config.paperSize)) return config.paperSize
  return undefined
}

export function mergePrinterConfig(
  existing: PrinterConfigLike = {},
  patch: PrinterConfigLike = {}
): PrinterConfigLike {
  const merged: PrinterConfigLike = { ...existing }

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    merged[key] = value
  }

  const paper = resolveThermalPaper(patch) ?? resolveThermalPaper(existing)
  if (paper) {
    merged.paperWidth = paper
    merged.paperSize = paper
  }

  return merged
}
