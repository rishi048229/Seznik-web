export interface LabelSizeConfig {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  printableWidthMm: number;
  widthDots: number;
  printableWidthDots: number;
  heightDots: number;
  gapMm: number;
  gapDots: number;
  totalPitchMm: number;
  totalPitchDots: number;
}

export const PRINTER_DPI = 203; // 203.2 DPI = 8 dots/mm
export const DOTS_PER_MM = 8;
export const ROLL_WIDTH_MM = 50;
export const PRINTABLE_WIDTH_MM = 48; // Physical thermal head width (384 dots)
export const DEFAULT_GAP_MM = 2; // 2mm inter-label gap (16 dots)

/**
 * Canonical sizing lookup table for 2-inch (~50mm) thermal label printers (TEJ / Y50 / LPAPI).
 * Single source of truth for both image rasterization/canvas generation and inter-label feed math.
 *
 * Hardware Metrics (203 DPI / 8 dots/mm):
 * - Nominal roll width: 50mm (400 dots)
 * - Printable width: 48mm (384 dots) — 1mm physical margins on each side of the paper guide
 * - Standard inter-label die-cut gap: 2mm (16 dots)
 */
export const TEJ_LABEL_SIZES: LabelSizeConfig[] = [
  {
    id: '50x15',
    label: '50×15mm',
    widthMm: 50,
    heightMm: 15,
    printableWidthMm: 48,
    widthDots: 400,
    printableWidthDots: 384,
    heightDots: 120,
    gapMm: 2,
    gapDots: 16,
    totalPitchMm: 17,
    totalPitchDots: 136,
  },
  {
    id: '50x25',
    label: '50×25mm',
    widthMm: 50,
    heightMm: 25,
    printableWidthMm: 48,
    widthDots: 400,
    printableWidthDots: 384,
    heightDots: 200,
    gapMm: 2,
    gapDots: 16,
    totalPitchMm: 27,
    totalPitchDots: 216,
  },
  {
    id: '50x30',
    label: '50×30mm',
    widthMm: 50,
    heightMm: 30,
    printableWidthMm: 48,
    widthDots: 400,
    printableWidthDots: 384,
    heightDots: 240,
    gapMm: 2,
    gapDots: 16,
    totalPitchMm: 32,
    totalPitchDots: 256,
  },
  {
    id: '50x50',
    label: '50×50mm',
    widthMm: 50,
    heightMm: 50,
    printableWidthMm: 48,
    widthDots: 400,
    printableWidthDots: 384,
    heightDots: 400,
    gapMm: 2,
    gapDots: 16,
    totalPitchMm: 52,
    totalPitchDots: 416,
  },
  {
    id: '50x75',
    label: '50×75mm',
    widthMm: 50,
    heightMm: 75,
    printableWidthMm: 48,
    widthDots: 400,
    printableWidthDots: 384,
    heightDots: 600,
    gapMm: 2,
    gapDots: 16,
    totalPitchMm: 77,
    totalPitchDots: 616,
  },
  {
    id: '50x100',
    label: '50×100mm',
    widthMm: 50,
    heightMm: 100,
    printableWidthMm: 48,
    widthDots: 400,
    printableWidthDots: 384,
    heightDots: 800,
    gapMm: 2,
    gapDots: 16,
    totalPitchMm: 102,
    totalPitchDots: 816,
  },
];

export interface LabelSizePreset {
  label: string;
  widthMm: number;
  heightMm: number;
}

export const LABEL_SIZE_PRESETS: LabelSizePreset[] = TEJ_LABEL_SIZES.map((s) => ({
  label: s.label,
  widthMm: s.widthMm,
  heightMm: s.heightMm,
}));

export function getLabelSizeConfig(widthMm: number, heightMm: number, gapMm: number = DEFAULT_GAP_MM): LabelSizeConfig {
  const match = TEJ_LABEL_SIZES.find((s) => s.widthMm === widthMm && s.heightMm === heightMm);
  if (match) {
    if (gapMm === match.gapMm) return match;
    const gapDots = Math.round(gapMm * DOTS_PER_MM);
    return {
      ...match,
      gapMm,
      gapDots,
      totalPitchMm: match.heightMm + gapMm,
      totalPitchDots: match.heightDots + gapDots,
    };
  }
  // Custom or unlisted size fallback
  const w = widthMm || 50;
  const h = heightMm || 30;
  const wDots = Math.round(w * DOTS_PER_MM);
  const pWDots = Math.min(wDots, PRINTABLE_WIDTH_MM * DOTS_PER_MM);
  const hDots = Math.round(h * DOTS_PER_MM);
  const gDots = Math.round(gapMm * DOTS_PER_MM);
  return {
    id: `${w}x${h}`,
    label: `${w}×${h}mm`,
    widthMm: w,
    heightMm: h,
    printableWidthMm: Math.min(w, PRINTABLE_WIDTH_MM),
    widthDots: wDots,
    printableWidthDots: pWDots,
    heightDots: hDots,
    gapMm,
    gapDots: gDots,
    totalPitchMm: h + gapMm,
    totalPitchDots: hDots + gDots,
  };
}
