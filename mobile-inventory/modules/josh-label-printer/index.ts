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
      /** Cap height in mm — LPAPI sizes text by height, not by point size. */
      fontHeight?: number;
      bold?: boolean;
      /** 0 = left, 1 = centre, 2 = right. */
      align?: 0 | 1 | 2;
    }
  | {
      type: 'barcode';
      value: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      /** Height of the human-readable digits under the bars, in mm. 0 hides them. */
      textHeight?: number;
      /** LPAPI BarcodeType ordinal; 0 (AUTO) lets the SDK choose. */
      barcodeType?: number;
      align?: 0 | 1 | 2;
    }
  | { type: 'qrcode'; value: string; x: number; y: number; size?: number; align?: 0 | 1 | 2 }
  | {
      type: 'image';
      /** Local file path or file:// URI. */
      uri: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      /** 0-255 grey cutoff. Omit to let the SDK decide. */
      threshold?: number;
    }
  | { type: 'line'; x: number; y: number; x2: number; y2: number; thickness?: number }
  | {
      type: 'rectangle';
      x: number;
      y: number;
      width: number;
      height: number;
      thickness?: number;
      filled?: boolean;
    };

export interface JoshLabelSpec {
  widthMm: number;
  heightMm: number;
  /** 0 / 90 / 180 / 270. */
  rotation?: number;
  copies?: number;
  gapMm?: number;
  /** Printer darkness, typically 1-15 depending on model. */
  darkness?: number;
  speed?: number;
  elements: JoshLabelElement[];
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
  getPrinterInfo(): Promise<{ name: string; address: string } | null>;
  printLabel(spec: JoshLabelSpec): Promise<boolean>;
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
    return JoshLabelPrinter.isAvailable();
  } catch {
    return false;
  }
}

export default JoshLabelPrinter;
