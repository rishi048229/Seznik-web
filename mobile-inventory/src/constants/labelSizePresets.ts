export interface LabelSizePreset {
  label: string;
  widthMm: number;
  heightMm: number;
}

/** Common die-cut label stock sizes — shown as quick-pick chips alongside the freeform mm steppers
 *  (both in Printers > Label calibration and inside Label Studio itself) so users don't have to
 *  know or manually dial in the exact mm dimensions for standard stock. */
export const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
  { label: '50×30mm', widthMm: 50, heightMm: 30 },
  { label: '50×25mm', widthMm: 50, heightMm: 25 },
  { label: '50×75mm', widthMm: 50, heightMm: 75 },
  { label: '50×100mm', widthMm: 50, heightMm: 100 },
];
