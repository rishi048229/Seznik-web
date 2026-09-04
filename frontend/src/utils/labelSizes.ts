export const LABEL_SIZE_PRESETS = [
  { id: '50x30', label: '50 × 30', width: 50, height: 30, description: 'Standard' },
  { id: '50x25', label: '25 mm', width: 50, height: 25, description: '50 × 25' },
  { id: '50x50', label: '50 mm', width: 50, height: 50, description: '50 × 50' },
  { id: '50x75', label: '75 mm', width: 50, height: 75, description: '50 × 75' },
  { id: '50x100', label: '100 mm', width: 50, height: 100, description: '50 × 100' },
] as const

export type LabelSizePresetId = (typeof LABEL_SIZE_PRESETS)[number]['id']
export type LabelSizePreset = (typeof LABEL_SIZE_PRESETS)[number]

export const LABEL_ROTATIONS = [0, 90, 180, 270] as const
export type LabelRotation = (typeof LABEL_ROTATIONS)[number]

/** Extra blank space between labels on continuous receipt paper (ESC/POS). */
export const RECEIPT_LABEL_GAP_MM = 6

/** ~203 dpi thermal printers: 8 dots per mm. ESC J accepts 0–255. */
export const receiptLabelGapDots = (dpi = 203) =>
  Math.max(24, Math.min(255, Math.round(RECEIPT_LABEL_GAP_MM * (dpi / 25.4))))

export const matchLabelPreset = (width: number, height: number) =>
  LABEL_SIZE_PRESETS.find(p => p.width === width && p.height === height)

/** Map a saved/custom size onto the 50 mm sticker family. */
export const snapLabelPreset = (width: number, height: number): LabelSizePreset => {
  const exact = matchLabelPreset(width, height)
  if (exact) return exact
  return LABEL_SIZE_PRESETS.reduce((best, p) =>
    Math.abs(p.height - height) < Math.abs(best.height - height) ? p : best
  )
}

/**
 * Rotate content inside the original sticker box. 90° / 270° is scaled so the
 * artwork stays inside the same W × H instead of overflowing the sticker.
 */
export const labelContentCssTransform = (
  rotation: LabelRotation,
  width: number,
  height: number,
  extra = '',
) => {
  if (rotation === 0) return extra || 'none'
  const swapped = rotation === 90 || rotation === 270
  const scale = swapped ? Math.min(width / height, height / width) : 1
  const rotateScale = `rotate(${rotation}deg)${scale === 1 ? '' : ` scale(${scale})`}`
  return extra ? `${extra} ${rotateScale}` : rotateScale
}
