import { NativeModule, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type Td404PrinterState = 'disconnected' | 'connecting' | 'connected' | 'printing';

export interface Td404PrinterDevice {
  name: string;
  address: string;
}

export interface Td404PrinterStateEvent {
  state: Td404PrinterState;
  address: string;
  name: string;
}

type Td404LabelPrinterEvents = {
  onPrinterFound: (device: Td404PrinterDevice) => void;
  onPrinterStateChange: (event: Td404PrinterStateEvent) => void;
};

declare class Td404LabelPrinterNativeModule extends NativeModule<Td404LabelPrinterEvents> {
  isAvailable(): boolean;
  getState(): Td404PrinterState;
  isConnected(): boolean;
  getBondedDevices(): Promise<Td404PrinterDevice[]>;
  connect(address: string, name?: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
  printRawBytes(base64Data: string): Promise<boolean>;
  printLabel(spec: any): Promise<boolean>;
  printLabelBitmap(base64Png: string, widthMm: number, heightMm: number, gapMm: number, copies: number): Promise<boolean>;
  printReceiptBitmap(base64Png: string, paperWidthMm: number): Promise<boolean>;
  printReceiptText(text: string, is80mm: boolean): Promise<boolean>;
  calibrate(): Promise<boolean>;
}

const Td404LabelPrinter = requireOptionalNativeModule<Td404LabelPrinterNativeModule>('Td404LabelPrinter');

export function isTd404PrinterSupported(): boolean {
  if (Platform.OS !== 'android') return false;
  if (!Td404LabelPrinter) return false;
  try {
    if (typeof (Td404LabelPrinter as any).isAvailable === 'function') {
      return !!(Td404LabelPrinter as any).isAvailable();
    }
    return true;
  } catch {
    return true;
  }
}

export default Td404LabelPrinter;
