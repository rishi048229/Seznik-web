import { NativeModule, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** One drawable item on a label. All geometry is in millimetres. */
export type JoshLabelElement =
  | {
      type: 'text';
      value: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      rotation?: number;
      /** Cap height in mm — LPAPI sizes text by height, not by point size. */
      fontHeight?: number;
      bold?: boolean;
      /** 0 = left, 1 = centre, 2 = right. */
      align?: 0 | 1 | 2;
      fontFamily?: string;
      monospace?: boolean;
    }
  | {
      type: 'barcode';
      value: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      rotation?: number;
      /** Height of the human-readable digits under the bars, in mm. 0 hides them. */
      textHeight?: number;
      /** LPAPI BarcodeType ordinal; 0 (AUTO) lets the SDK choose. */
      barcodeType?: number;
      align?: 0 | 1 | 2;
    }
  | { type: 'qrcode'; value: string; x: number; y: number; size?: number; align?: 0 | 1 | 2; rotation?: number }
  | {
      type: 'image';
      /** Local file path, file:// URI, or base64 data URI. */
      uri: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      rotation?: number;
      /** Invert colors (black becomes white, white becomes black). */
      invert?: boolean;
      /** 0-255 grey cutoff. Omit to let the SDK decide. */
      threshold?: number;
    }
  | { type: 'line'; x: number; y: number; x2: number; y2: number; thickness?: number; rotation?: number }
  | {
      type: 'rectangle';
      x: number;
      y: number;
      width: number;
      height: number;
      thickness?: number;
      filled?: boolean;
      /** Corner radius in mm — > 0 draws a rounded rectangle. */
      cornerRadius?: number;
      rotation?: number;
    }
  | {
      type: 'ellipse';
      x: number;
      y: number;
      width: number;
      height: number;
      thickness?: number;
      filled?: boolean;
      rotation?: number;
    };

export interface JoshLabelSpec {
  widthMm: number;
  heightMm: number;
  /** 0 / 90 / 180 / 270. */
  rotation?: number;
  copies?: number;
  gapMm?: number;
  /** LPAPI GAP_TYPE: 0 = continuous, 2 = die-cut gap paper, 3 = black mark. Omit to keep the printer's own setting. */
  gapType?: number;
  /** Printer darkness, typically 1-15 depending on model. */
  darkness?: number;
  speed?: number;
  elements: JoshLabelElement[];
}

export interface JoshLabelBatchSpec {
  widthMm: number;
  heightMm: number;
  rotation?: number;
  gapMm?: number;
  gapType?: number;
  darkness?: number;
  speed?: number;
  labels: JoshLabelSpec[];
}

export interface JoshPrinterDevice {
  address: string;
  name: string;
}

export type JoshPrinterState = 'disconnected' | 'connecting' | 'connected' | 'printing';

export interface JoshPrinterStateEvent {
  state: JoshPrinterState;
  address: string;
  name: string;
}

type JoshLabelPrinterEvents = {
  onPrinterFound: (device: JoshPrinterDevice) => void;
  onPrinterStateChange: (event: JoshPrinterStateEvent) => void;
};

declare class JoshLabelPrinterNativeModule extends NativeModule<JoshLabelPrinterEvents> {
  isAvailable(): boolean;
  getState(): JoshPrinterState;
  startDiscovery(): Promise<boolean>;
  stopDiscovery(): Promise<boolean>;
  getPairedPrinters(): Promise<JoshPrinterDevice[]>;
  connect(address: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
  isConnected(): Promise<boolean>;
  getPrinterInfo(): Promise<{
    name: string;
    address: string;
    /** Print head resolution, e.g. 203. 0 when the printer didn't report it. */
    dpi?: number;
    /** Print head width in dots, e.g. 384. */
    widthPx?: number;
    /** Physical printable width in mm derived from dpi+widthPx, e.g. 48. 0 when unknown. */
    widthMm?: number;
  } | null>;
  printLabel(spec: JoshLabelSpec): Promise<boolean>;
  printLabelBatch(batch: JoshLabelBatchSpec): Promise<boolean>;
}

/**
 * Optional on purpose: the SDK is Android-only and is compiled in from a vendored
 * JAR, so on iOS — and in any JS-only client that has not been rebuilt — this
 * resolves to null and callers fall back to the existing ESC/POS printer path.
 */
const JoshLabelPrinter = requireOptionalNativeModule<JoshLabelPrinterNativeModule>('JoshLabelPrinter');

export function isJoshPrinterSupported(): boolean {
  if (Platform.OS !== 'android') return false;
  if (!JoshLabelPrinter) return false;
  try {
    if (typeof (JoshLabelPrinter as any).isAvailable === 'function') {
      return !!(JoshLabelPrinter as any).isAvailable();
    }
    if (typeof (JoshLabelPrinter as any).isSupported === 'function') {
      return !!(JoshLabelPrinter as any).isSupported();
    }
    return true;
  } catch {
    return true;
  }
}

export default JoshLabelPrinter;
