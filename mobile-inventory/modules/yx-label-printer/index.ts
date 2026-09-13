import { NativeModule, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { JoshLabelElement, JoshLabelSpec, JoshPrinterDevice, JoshPrinterState } from '../josh-label-printer';

/**
 * A second non-ESC/POS label printer family (vendor "YX", com.yx.print), sitting
 * alongside DothanTech/Josh rather than duplicating it.
 *
 * The label spec types are deliberately imported from the Josh module instead of being
 * redeclared: both printers consume the exact same element list, so PrinterService can
 * build one label and hand the identical object to whichever transport is connected.
 * Redeclaring them here would let the two drift apart silently the first time an element
 * type is added on one side only.
 *
 * The two SDKs differ underneath — LPAPI composes the label from draw commands on the
 * printer, this one prints a Bitmap rasterized on the phone — but that is a native-side
 * concern and does not reach this API.
 */
export type YxLabelElement = JoshLabelElement;
export type YxLabelSpec = JoshLabelSpec;
export type YxPrinterDevice = JoshPrinterDevice;
export type YxPrinterState = JoshPrinterState;

export interface YxPrinterStateEvent {
  state: YxPrinterState;
  address: string;
  name: string;
}

type YxLabelPrinterEvents = {
  onPrinterFound: (device: YxPrinterDevice) => void;
  onPrinterStateChange: (event: YxPrinterStateEvent) => void;
};

declare class YxLabelPrinterNativeModule extends NativeModule<YxLabelPrinterEvents> {
  isAvailable(): boolean;
  getState(): YxPrinterState;
  startDiscovery(): Promise<boolean>;
  stopDiscovery(): Promise<boolean>;
  getPairedPrinters(): Promise<YxPrinterDevice[]>;
  connect(address: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
  isConnected(): Promise<boolean>;
  getPrinterInfo(): Promise<{ name: string; address: string } | null>;
  printLabel(spec: YxLabelSpec): Promise<boolean>;
  calibrate(gapType?: number, widthMm?: number, heightMm?: number): Promise<boolean>;
  rasterizeLabelBase64(spec: YxLabelSpec & { headMm?: number }): Promise<string>;
}

/**
 * Optional on purpose, exactly like the Josh module: the SDK is Android-only and
 * compiled in natively, so on iOS — and in any JS-only client that has not been
 * rebuilt — this resolves to null and callers fall back to another printer path.
 */
const YxLabelPrinter = requireOptionalNativeModule<YxLabelPrinterNativeModule>('YxLabelPrinter');

export function isYxPrinterSupported(): boolean {
  if (Platform.OS !== 'android') return false;
  if (!YxLabelPrinter) return false;
  try {
    if (typeof (YxLabelPrinter as any).isAvailable === 'function') {
      return !!(YxLabelPrinter as any).isAvailable();
    }
    return true;
  } catch {
    return true;
  }
}

export default YxLabelPrinter;
