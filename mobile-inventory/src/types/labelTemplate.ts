/**
 * A user-designed label layout — the "Label Studio" editor's save format. Every position/size is
 * in millimeters (resolution-independent); converted to printer dots only at render/print time
 * (DOTS_PER_MM = 8, matching PrinterService.buildTsplLabelFields's established conversion).
 *
 * `binding` on text/barcode/qrcode elements is what makes a printed label show the REAL product
 * being printed rather than whatever placeholder text was on screen while designing — the template
 * only stores WHICH field to show, not a captured value; PrinterService.printLabelFromTemplate()
 * resolves the actual value against the live Product at print time.
 */

export type LabelTextBinding = 'productName' | 'price' | 'sku' | 'barcodeText' | 'unit' | 'category' | 'custom' | 'sequence';
export type LabelCodeBinding = 'barcode' | 'sku' | 'custom';

interface BaseLabelElement {
  id: string;
  /** Top-left position, mm from the label's top-left corner. */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** Rotation angle in degrees (0, 90, 180, 270 or arbitrary 0-360) */
  rotation?: number;
  /** Fix/Lock element in place so it cannot be dragged or resized */
  locked?: boolean;
}

export interface LabelTextElement extends BaseLabelElement {
  type: 'text';
  binding: LabelTextBinding;
  /** Used when binding === 'custom' — fixed decorative text (store name, "MRP:" prefixes, etc). */
  customText?: string;
  fontSizePt: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface LabelBarcodeElement extends BaseLabelElement {
  type: 'barcode';
  format: 'code128' | 'ean13';
  binding: LabelCodeBinding;
  customValue?: string;
}

export interface LabelQrElement extends BaseLabelElement {
  type: 'qrcode';
  binding: LabelCodeBinding;
  customValue?: string;
}

/** Local device URI (same convention as Settings.businessLogoURL) — converted to base64 only at
 *  print/export time via PrinterService.uriToBase64(). Not portable across devices/reinstalls,
 *  same known limitation the existing logo picker already accepts. */
export interface LabelImageElement extends BaseLabelElement {
  type: 'image';
  uri: string;
  invert?: boolean;
}


export interface LabelRectElement extends BaseLabelElement {
  type: 'rect' | 'curveRect';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadiusMm?: number;
}

export interface LabelCircleElement extends BaseLabelElement {
  type: 'circle';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface LabelLineElement extends BaseLabelElement {
  type: 'line';
  stroke?: string;
  strokeWidth?: number;
}

export interface LabelTableElement extends BaseLabelElement {
  type: 'table';
  rows: number;
  cols: number;
  stroke?: string;
}

export type LabelElement =
  | LabelTextElement
  | LabelBarcodeElement
  | LabelQrElement
  | LabelImageElement
  | LabelRectElement
  | LabelCircleElement
  | LabelLineElement
  | LabelTableElement;

/** Element types with no TSPL primitive reachable from the JS bridge (confirmed against the
 *  installed native SDK: only `text`, `barcode`, `qrcode`, `image` are exposed) — these get
 *  flattened into one composited bitmap at print time instead of a native command each. */
export const BITMAP_LAYER_TYPES: LabelElement['type'][] = ['image', 'rect', 'curveRect', 'circle', 'line', 'table'];

export interface LabelTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  orientation: 'landscape' | 'portrait';
  backgroundColor?: string;
  elements: LabelElement[];
  createdAt: string;
  updatedAt: string;
}

/**
 * True when a template would actually put something on the label.
 *
 * A template whose elements were all deleted is still a valid object, and printing
 * it produces a technically-successful job that feeds one blank label — which is
 * indistinguishable from "printing is broken". Callers use this to fall back to the
 * built-in auto-layout instead of silently printing nothing.
 */
export function templateHasPrintableContent(template?: LabelTemplate | null): boolean {
  if (!template || !Array.isArray(template.elements)) return false;
  return template.elements.some(
    (el) => el.type === 'text' || el.type === 'barcode' || el.type === 'qrcode' || el.type === 'image'
  );
}
