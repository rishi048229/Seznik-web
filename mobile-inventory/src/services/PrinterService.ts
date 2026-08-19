import * as Print from 'expo-print';
import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid, EmitterSubscription } from 'react-native';
import { ReceiptTemplate, getTemplateById } from '../constants/receiptTemplates';
import { LabelTemplate, LabelTextElement, LabelBarcodeElement, LabelQrElement } from '../types/labelTemplate';
import { Product } from '../types/product';

const NativeBluetoothManager = NativeModules.BluetoothManager;
const NativeEscposPrinter = NativeModules.BluetoothEscposPrinter;
const NativeTscPrinter = NativeModules.BluetoothTscPrinter;

// Native discovery on Android runs a full BluetoothAdapter.startDiscovery() cycle,
// which takes ~12s to fire ACTION_DISCOVERY_FINISHED. This is a safety ceiling only —
// the scan promise normally resolves on its own once discovery completes.
const SCAN_SAFETY_TIMEOUT_MS = 16000;

export interface PrintSaleData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  /** Business logo URL/URI (Settings.businessLogoURL) — printed as a real bitmap at the top of the receipt. */
  storeLogoUrl?: string;
  /** UPI VPA (Settings.upiId), e.g. "store@upi" — printed as a scannable payment QR code near the bottom. */
  upiId?: string;
  invoiceNumber: string;
  date: string;
  customerName?: string;
  items: { productName: string; quantity: number; unitPrice: number; total: number; unit?: string; gstRate?: number; discount?: number }[];
  subtotal: number;
  taxableAmt?: number;
  sgst?: number;
  cgst?: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  amountPaid?: number;
  changeReturned?: number;
  paymentMethod: string;
}

/**
 * Kitchen Order Ticket content — deliberately has NO prices/tax/totals anywhere in it. A KOT is
 * what the kitchen reads to cook, not a customer-facing bill, so it prints item names/quantities/
 * modifiers/notes as large, scannable text instead of the itemized-pricing layout PrintSaleData
 * uses for the final receipt.
 */
export interface PrintKotData {
  storeName?: string;
  orderNumber: number;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableName?: string;
  partyLabel?: string;
  guestCount?: number;
  contactNumber?: string;
  priority?: 'normal' | 'urgent';
  notes?: string;
  time: string;
  items: { productName: string; quantity: number; notes?: string; modifiers?: string[] }[];
}

/** Dedicated compact counter token slip data */
export interface PrintTokenData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  tokenNumber: number | string;
  typeName: string;
  quantity?: number;
  price?: number;
  totalAmount?: number;
  paymentMethod?: string;
  date?: string;
  time?: string;
  note?: string;
}

/** Calibration/personalization options threaded through the receipt print pipeline — sourced from usePrinterStore. */
export interface ReceiptPrintOptions {
  template?: ReceiptTemplate;
  /** Blank feed lines before print starts. */
  topMargin?: number;
  /** Feeds + cuts after printing, via the native printText `cut` option — no-op on printers without a cutter. */
  autoCut?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  /** Number of times to print the same receipt (e.g. customer + merchant copy). */
  copies?: number;
}

export interface BluetoothPrinterDevice {
  id: string;
  name: string;
  macAddress?: string;
  type?: 'receipt' | 'label' | 'dual';
  isDefault?: boolean;
  connected?: boolean;
  /** True when the OS already had this device bonded/paired at scan time (from the phone's real Bluetooth adapter). */
  bonded?: boolean;
}

type StatusCallback = (state: 'connected' | 'disconnected' | 'connecting' | 'scanning') => void;

/** Parses a device entry coming off the native bridge, which may arrive as a JSON object or a raw JSON string. */
function parseNativeDevice(raw: any): { name: string; address: string } | null {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || !obj.address) return null;
    return { name: obj.name || 'Unknown Device', address: obj.address };
  } catch {
    return null;
  }
}

class ThermalPrinterServiceManager {
  private activeDevice: BluetoothPrinterDevice | null = null;
  private connectionState: 'connected' | 'disconnected' | 'connecting' | 'scanning' = 'disconnected';
  private statusListeners: StatusCallback[] = [];
  private warningText = '';
  private eventEmitter: NativeEventEmitter | null = null;
  private eventSubscriptions: EmitterSubscription[] = [];
  /** Live callback wired up only while a scan is in-flight, used to stream devices to the UI as they're discovered. */
  private onDeviceDiscovered: ((device: BluetoothPrinterDevice, bonded: boolean) => void) | null = null;

  constructor() {
    this.activeDevice = null;
    this.connectionState = 'disconnected';
    this.attachNativeEventListeners();
    this.disconnectStaleNativeConnection();
  }

  /** Whether the native Bluetooth Classic module is actually linked into this build (false in Expo Go / a build without the dev client rebuild). */
  public isNativeModuleAvailable(): boolean {
    return !!(NativeBluetoothManager && typeof NativeBluetoothManager.scanDevices === 'function');
  }

  /**
   * The native Android Bluetooth module (and its underlying socket) keeps running independently
   * of the JS bundle — a JS refresh/reload recreates this singleton with connectionState reset to
   * 'disconnected', but the *actual* native connection to the printer can still be open from the
   * previous session, so the printer's Bluetooth light stays lit even though the app now shows
   * "Disconnected". Force-close any such lingering native connection on startup so the app state
   * and the physical device actually match after every refresh.
   */
  private async disconnectStaleNativeConnection() {
    if (!this.isNativeModuleAvailable() || typeof NativeBluetoothManager.isDeviceConnected !== 'function') return;
    try {
      // Guarded with a timeout: the native isDeviceConnected() implementation never resolves its
      // promise at all if its internal BluetoothService happens to be null, which would otherwise
      // hang app startup indefinitely.
      const isConnected = await Promise.race([
        NativeBluetoothManager.isDeviceConnected(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
      ]);
      if (!isConnected) return;

      const address =
        typeof NativeBluetoothManager.getConnectedDeviceAddress === 'function'
          ? await NativeBluetoothManager.getConnectedDeviceAddress()
          : null;
      if (address && typeof NativeBluetoothManager.disconnect === 'function') {
        await NativeBluetoothManager.disconnect(address);
      }
    } catch (e) {
      console.warn('Failed to clear stale native Bluetooth connection on startup:', e);
    }
  }

  private attachNativeEventListeners() {
    if (!this.isNativeModuleAvailable()) return;
    try {

      if (typeof NativeBluetoothManager.addListener !== 'function') {
        NativeBluetoothManager.addListener = () => {};
      }
      if (typeof NativeBluetoothManager.removeListeners !== 'function') {
        NativeBluetoothManager.removeListeners = () => {};
      }

      this.eventEmitter = new NativeEventEmitter(NativeBluetoothManager);

      this.eventSubscriptions.push(
        this.eventEmitter.addListener('EVENT_DEVICE_ALREADY_PAIRED', (params: any) => {
          try {
            const list = JSON.parse(params?.devices || '[]');
            list.forEach((d: any) => {
              if (!d?.address) return;
              this.onDeviceDiscovered?.({ id: d.address, name: d.name || 'Paired Device', macAddress: d.address, type: 'receipt' }, true);
            });
          } catch {
            // ignore malformed payload
          }
        })
      );

      this.eventSubscriptions.push(
        this.eventEmitter.addListener('EVENT_DEVICE_FOUND', (params: any) => {
          const device = parseNativeDevice(params?.device);
          if (!device) return;
          this.onDeviceDiscovered?.(
            { id: device.address, name: device.name, macAddress: device.address, type: 'receipt' },
            false
          );
        })
      );

      this.eventSubscriptions.push(
        this.eventEmitter.addListener('EVENT_CONNECTED', (params: any) => {
          if (this.activeDevice) {
            this.activeDevice = { ...this.activeDevice, name: params?.DEVICE_NAME || this.activeDevice.name, connected: true };
          }
          this.warningText = '';
          this.notifyStatusChange('connected');
        })
      );

      this.eventSubscriptions.push(
        this.eventEmitter.addListener('EVENT_CONNECTION_LOST', () => {
          this.activeDevice = null;
          this.warningText = 'Printer connection was lost. Please reconnect.';
          this.notifyStatusChange('disconnected');
        })
      );

      this.eventSubscriptions.push(
        this.eventEmitter.addListener('EVENT_UNABLE_CONNECT', () => {
          this.activeDevice = null;
          this.warningText = 'Unable to connect to the Bluetooth printer.';
          this.notifyStatusChange('disconnected');
        })
      );

      this.eventSubscriptions.push(
        this.eventEmitter.addListener('EVENT_BLUETOOTH_NOT_SUPPORT', () => {
          this.warningText = 'Bluetooth is not supported on this device.';
        })
      );
    } catch (err) {
      console.warn('Failed to attach Bluetooth native event listeners:', err);
    }
  }


  public getActiveDevice(): BluetoothPrinterDevice | null {
    return this.activeDevice;
  }

  public getWarningText(): string {
    return this.warningText;
  }

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.push(callback);
    callback(this.connectionState);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyStatusChange(state: 'connected' | 'disconnected' | 'connecting' | 'scanning') {
    this.connectionState = state;
    this.statusListeners.forEach((cb) => cb(state));
  }

  /**
   * Request Android 12+ Bluetooth permissions at runtime
   */
  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Android Bluetooth permissions error:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Scans the phone's real Bluetooth adapter for thermal printers: bonded/paired devices surface almost
   * immediately, nearby unpaired devices stream in over the discovery window via `onDeviceFound`.
   * Requires a native dev-client build (see `isNativeModuleAvailable`) — Expo Go cannot access classic Bluetooth.
   */
  public async scanForDevices(onDeviceFound?: (device: BluetoothPrinterDevice, bonded: boolean) => void): Promise<BluetoothPrinterDevice[]> {
    if (!this.isNativeModuleAvailable()) {
      this.warningText =
        Platform.OS === 'web'
          ? ''
          : 'Bluetooth scanning needs a custom dev-client build (Expo Go does not include native Bluetooth modules).';

      // Web Bluetooth Fallback
      if (Platform.OS === 'web' && typeof window !== 'undefined' && (navigator as any).bluetooth) {
        try {
          const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['0000180f', '0000180a', '0000ff00', '0000ffe0', '00001101-0000-1000-8000-00805f9b34fb'],
          });
          if (device) {
            const found: BluetoothPrinterDevice = {
              id: device.id || `bt-${Date.now()}`,
              name: device.name || 'Generic Thermal Printer',
              macAddress: device.id,
              type: 'receipt',
            };
            onDeviceFound?.(found, false);
            return [found];
          }
        } catch (webBtErr) {
          console.log('Web Bluetooth scan dismissed or unavailable:', webBtErr);
        }
      }
      return [];
    }

    const granted = await this.requestPermissions();
    if (!granted) {
      this.warningText = 'Bluetooth permission was denied. Enable Bluetooth & Nearby Devices permission in phone settings.';
      return [];
    }

    try {
      const isEnabled = await NativeBluetoothManager.isBluetoothEnabled();
      if (!isEnabled && NativeBluetoothManager.enableBluetooth) {
        await NativeBluetoothManager.enableBluetooth();
      }
    } catch (adapterErr) {
      console.warn('Bluetooth adapter check failed:', adapterErr);
    }

    const deviceMap = new Map<string, BluetoothPrinterDevice>();
    this.onDeviceDiscovered = (device, bonded) => {
      deviceMap.set(device.macAddress || device.id, { ...device, bonded });
      onDeviceFound?.(device, bonded);
    };

    try {
      const scanPromise = NativeBluetoothManager.scanDevices().then((raw: any) => {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        (parsed?.paired || []).forEach((d: any) => {
          if (!d?.address) return;
          deviceMap.set(d.address, { id: d.address, name: d.name || 'Paired Device', macAddress: d.address, type: 'receipt', bonded: true });
        });
        (parsed?.found || []).forEach((d: any) => {
          if (!d?.address) return;
          if (!deviceMap.has(d.address)) {
            deviceMap.set(d.address, { id: d.address, name: d.name || 'Discovered Device', macAddress: d.address, type: 'receipt', bonded: false });
          }
        });
      });

      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, SCAN_SAFETY_TIMEOUT_MS));
      await Promise.race([scanPromise, timeoutPromise]);

      this.warningText = '';
      return Array.from(deviceMap.values());
    } catch (err: any) {
      console.warn('Native Bluetooth scan error:', err);
      this.warningText = err?.message || 'Bluetooth scan failed.';
      return Array.from(deviceMap.values());
    } finally {
      this.onDeviceDiscovered = null;
      this.notifyStatusChange(this.activeDevice ? 'connected' : 'disconnected');
    }
  }

  /**
   * Opens the phone's OS-level system print/printer picker (AirPrint-style dialog) as an alternative
   * to raw Bluetooth Classic pairing — useful for network/AirPrint printers or when the native BT module is unavailable.
   */
  public async selectSystemPrinter(): Promise<BluetoothPrinterDevice | null> {
    if (Platform.OS === 'web' || !Print.selectPrinterAsync) return null;
    const printer = await Print.selectPrinterAsync();
    if (!printer) return null;
    return {
      id: printer.url || printer.name,
      name: printer.name,
      macAddress: printer.url,
      type: 'receipt',
      connected: true,
    };
  }

  public async connect(deviceId: string, deviceName?: string): Promise<boolean> {
    this.notifyStatusChange('connecting');

    if (this.isNativeModuleAvailable()) {
      try {
        const connectedName = await NativeBluetoothManager.connect(deviceId);
        this.activeDevice = {
          id: deviceId,
          name: deviceName || connectedName || `Bluetooth Printer (${deviceId.slice(-6)})`,
          macAddress: deviceId,
          type: 'receipt',
          connected: true,
        };
        this.warningText = '';
        this.notifyStatusChange('connected');
        return true;
      } catch (err: any) {
        this.activeDevice = null;
        this.notifyStatusChange('disconnected');
        throw new Error(`Failed to connect to ${deviceName || deviceId}: ${err?.message || 'Printer unreachable'}`);
      }
    }

    if (Platform.OS !== 'web') {
      this.notifyStatusChange('disconnected');
      throw new Error('Bluetooth scanning needs a custom dev-client build (Expo Go does not include native Bluetooth modules).');
    }

    // Web Bluetooth: pairing already happened during scanForDevices(); just mark it active.
    this.activeDevice = {
      id: deviceId,
      name: deviceName || `Bluetooth Printer (${deviceId.length > 10 ? deviceId.slice(-6) : deviceId})`,
      macAddress: deviceId,
      type: 'receipt',
      connected: true,
    };
    this.warningText = '';
    this.notifyStatusChange('connected');
    return true;
  }

  public async disconnect(): Promise<void> {
    const address = this.activeDevice?.macAddress || this.activeDevice?.id;
    if (this.isNativeModuleAvailable() && typeof NativeBluetoothManager.disconnect === 'function' && address) {
      try {
        await NativeBluetoothManager.disconnect(address);
      } catch (e) {
        console.warn('Native Bluetooth disconnect error:', e);
      }
    }
    this.activeDevice = null;
    this.warningText = 'Printer Disconnected';
    this.notifyStatusChange('disconnected');
  }

  public resolveActiveTemplate(options?: ReceiptPrintOptions): ReceiptTemplate {
    if (options?.template) return options.template;
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      const activeId = usePrinterStore.getState().activeTemplateId;
      return getTemplateById(activeId);
    } catch {
      return getTemplateById();
    }
  }

  /**
   * Plaintext formatted receipt representation
   */
  public formatReceiptText(data: PrintSaleData, paperWidth: '58mm' | '80mm' = '58mm', options: ReceiptPrintOptions = {}): string {
    const template = this.resolveActiveTemplate(options);
    // 58mm paper rolls have a 48mm printable head (384 dots). With hardware margins, safe character width is 30 cols.
    // 80mm rolls have a 72mm printable head, safe character width is 44 cols.
    const width = paperWidth === '58mm' ? 30 : 44;
    const divider = template.dividerChar.repeat(width);
    const doubleDivider = '='.repeat(width);

    const padLine = (left: string, right: string) => {
      const leftStr = String(left ?? '');
      const rightStr = String(right ?? '');
      const available = width - leftStr.length - rightStr.length;
      if (available <= 0) {
        const maxLeft = Math.max(1, width - rightStr.length - 1);
        return leftStr.slice(0, maxLeft) + ' ' + rightStr;
      }
      return leftStr + ' '.repeat(available) + rightStr;
    };

    const lines: string[] = [];

    const wrapAndCenter = (str: string) => {
      const trimmed = String(str ?? '').trim();
      if (!trimmed) return;
      if (trimmed.length <= width) {
        const padLeft = Math.max(0, Math.floor((width - trimmed.length) / 2));
        lines.push(' '.repeat(padLeft) + trimmed);
        return;
      }
      // Word-wrap cleanly so long names, taglines, or footers never get clipped at the right margin
      const words = trimmed.split(' ');
      let currentLine = '';
      for (const word of words) {
        if (!currentLine) {
          currentLine = word;
        } else if (currentLine.length + 1 + word.length <= width) {
          currentLine += ' ' + word;
        } else {
          const padLeft = Math.max(0, Math.floor((width - currentLine.length) / 2));
          lines.push(' '.repeat(padLeft) + currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        const padLeft = Math.max(0, Math.floor((width - currentLine.length) / 2));
        lines.push(' '.repeat(padLeft) + currentLine);
      }
    };

    // Top margin: blank feed lines before anything prints (see usePrinterStore.topMargin).
    for (let i = 0; i < (options.topMargin || 0); i++) lines.push('');

    // Header — tagline + contact lines
    const storeName = (data.storeName || 'Your Store Name').toUpperCase();
    wrapAndCenter(storeName);
    if (template.tagline) wrapAndCenter(template.tagline);
    if (data.storeAddress) wrapAndCenter(data.storeAddress);
    if (data.storePhone) wrapAndCenter(`Phone: ${data.storePhone}`);
    if (template.showTaxBreakdown && data.storeGstin) wrapAndCenter(`GSTIN: ${data.storeGstin}`);
    lines.push(divider);

    // Meta / Bill Info
    lines.push(padLine(`${template.billLabel}: ${data.invoiceNumber}`, data.date));
    if (template.showCustomerLine) {
      const custLine = `Customer: ${data.customerName || 'Walk-in'}`;
      if (custLine.length <= width) {
        lines.push(custLine);
      } else {
        lines.push(custLine.slice(0, width));
      }
    }
    lines.push(divider);

    // Item Table Header
    lines.push(padLine(template.itemColumnLeft, template.itemColumnRight));
    lines.push(divider);

    // Items
    data.items.forEach((item, idx) => {
      const namePrefix = `${idx + 1}. `;
      const rawName = String(item.productName || 'Item');
      if (namePrefix.length + rawName.length <= width) {
        lines.push(namePrefix + rawName);
      } else {
        const maxFirstLine = Math.max(1, width - namePrefix.length);
        lines.push(namePrefix + rawName.slice(0, maxFirstLine));
        const rem = rawName.slice(maxFirstLine);
        if (rem) {
          lines.push('   ' + rem.slice(0, Math.max(1, width - 3)));
        }
      }

      if (template.showTaxBreakdown && item.gstRate) {
        lines.push(`   ${item.gstRate.toFixed(2)}% GST`);
      }
      lines.push(
        padLine(
          `   ${item.quantity} ${item.unit || 'Pc'} x ${item.unitPrice.toFixed(2)}`,
          item.total.toFixed(2)
        )
      );
    });

    lines.push(divider);

    if (template.showTaxBreakdown) {
      // Full tax-invoice style breakdown — retail/electronics/jewellery etc.
      const taxable = data.taxableAmt !== undefined ? data.taxableAmt : data.subtotal;
      const halfTax = data.totalTax / 2;
      const sgstVal = data.sgst !== undefined ? data.sgst : halfTax;
      const cgstVal = data.cgst !== undefined ? data.cgst : halfTax;

      lines.push(padLine('Sub Total', `Rs.${data.subtotal.toFixed(2)}`));
      if (data.totalDiscount > 0) lines.push(padLine('Discount', `-Rs.${data.totalDiscount.toFixed(2)}`));
      lines.push(padLine('Taxable Amt', `Rs.${taxable.toFixed(2)}`));
      lines.push(padLine('SGST', `Rs.${sgstVal.toFixed(2)}`));
      lines.push(padLine('CGST', `Rs.${cgstVal.toFixed(2)}`));
      lines.push(doubleDivider);
      lines.push(padLine('Total Amount', `Rs.${data.grandTotal.toFixed(2)}`));
      const paid = data.amountPaid !== undefined ? data.amountPaid : data.grandTotal;
      const balance = data.changeReturned !== undefined ? data.changeReturned : 0;
      lines.push(padLine('Paid Amount', `Rs.${paid.toFixed(2)}`));
      lines.push(padLine('Balance', `Rs.${balance.toFixed(2)}`));
    } else {
      // Compact style — cafe/bakery/salon/garage/bookstore: just the bottom line, no tax table.
      if (data.totalDiscount > 0) lines.push(padLine('Discount', `-Rs.${data.totalDiscount.toFixed(2)}`));
      if (data.totalTax > 0) lines.push(padLine('Tax', `Rs.${data.totalTax.toFixed(2)}`));
      lines.push(doubleDivider);
      lines.push(padLine('Grand Total', `Rs.${data.grandTotal.toFixed(2)}`));
    }
    lines.push(divider);

    // Footer
    wrapAndCenter(template.footerMessage);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Kitchen Order Ticket — plain text, no prices anywhere, printed extra-large (see printKotTicket's
   * widthtimes/heigthtimes) so it reads clearly from across a kitchen. Independent of ReceiptTemplate
   * (a KOT doesn't vary by business vertical the way a customer bill's layout does).
   */
  public formatKotText(data: PrintKotData, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const width = paperWidth === '58mm' ? 32 : 48;
    const divider = '='.repeat(width);
    const thinDivider = '-'.repeat(width);

    const centerLine = (str: string) => {
      const trimmed = str.trim();
      if (trimmed.length >= width) return trimmed.slice(0, width);
      const padLeft = Math.floor((width - trimmed.length) / 2);
      return ' '.repeat(padLeft) + trimmed;
    };

    const lines: string[] = [];
    lines.push(centerLine('*** KITCHEN ORDER TICKET ***'));
    lines.push(divider);
    if (data.priority === 'urgent') {
      lines.push(centerLine('!!! URGENT !!!'));
      lines.push(divider);
    }

    lines.push(centerLine(`KOT #${data.orderNumber}`));
    const typeLabel = data.orderType === 'dine_in' ? 'DINE-IN' : data.orderType === 'takeaway' ? 'TAKEAWAY' : 'DELIVERY';
    lines.push(centerLine(typeLabel));
    if (data.orderType === 'dine_in') {
      lines.push(centerLine(data.tableName || data.partyLabel || 'No table'));
      if (data.guestCount) lines.push(centerLine(`${data.guestCount} guests`));
    } else if (data.partyLabel) {
      lines.push(centerLine(data.partyLabel));
    }
    if (data.contactNumber) lines.push(centerLine(`Ph: ${data.contactNumber}`));
    lines.push(centerLine(data.time));
    lines.push(divider);

    data.items.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.quantity} x ${item.productName}`);
      if (item.modifiers && item.modifiers.length > 0) {
        lines.push(`   * ${item.modifiers.join(', ')}`);
      }
      if (item.notes) {
        lines.push(`   note: ${item.notes}`);
      }
      lines.push(thinDivider);
    });

    if (data.notes) {
      lines.push(`ORDER NOTE: ${data.notes}`);
      lines.push(divider);
    }

    lines.push('');
    return lines.join('\n');
  }

  /** HTML fallback for KOT tickets (system print dialog / no Bluetooth ESC/POS device paired). */
  public generateKotHtml(data: PrintKotData, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const widthPx = paperWidth === '58mm' ? '280px' : '380px';
    const typeLabel = data.orderType === 'dine_in' ? 'DINE-IN' : data.orderType === 'takeaway' ? 'TAKEAWAY' : 'DELIVERY';
    const itemsHtml = data.items
      .map(
        (item, idx) => `
        <div style="margin-bottom: 10px;">
          <div><b>${idx + 1}. ${item.quantity} x ${item.productName}</b></div>
          ${item.modifiers && item.modifiers.length ? `<div style="font-size: 0.9em;">* ${item.modifiers.join(', ')}</div>` : ''}
          ${item.notes ? `<div style="font-size: 0.9em; font-style: italic;">note: ${item.notes}</div>` : ''}
        </div>`
      )
      .join('<hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;">');

    return `
      <html><body style="font-family: monospace; width: ${widthPx}; margin: 0 auto; padding: 12px; font-size: 16px;">
        <div style="text-align: center; font-weight: bold; font-size: 1.2em;">*** KITCHEN ORDER TICKET ***</div>
        ${data.priority === 'urgent' ? '<div style="text-align: center; font-weight: bold; color: #DC2626; margin-top: 6px;">!!! URGENT !!!</div>' : ''}
        <hr style="border: none; border-top: 2px solid #000; margin: 8px 0;">
        <div style="text-align: center; font-weight: bold; font-size: 1.3em;">KOT #${data.orderNumber}</div>
        <div style="text-align: center; font-weight: bold;">${typeLabel}</div>
        <div style="text-align: center;">${data.orderType === 'dine_in' ? (data.tableName || data.partyLabel || 'No table') : (data.partyLabel || '')}</div>
        ${data.guestCount ? `<div style="text-align: center;">${data.guestCount} guests</div>` : ''}
        ${data.contactNumber ? `<div style="text-align: center;">Ph: ${data.contactNumber}</div>` : ''}
        <div style="text-align: center;">${data.time}</div>
        <hr style="border: none; border-top: 2px solid #000; margin: 8px 0;">
        ${itemsHtml}
        ${data.notes ? `<hr style="border: none; border-top: 2px solid #000; margin: 8px 0;"><div><b>ORDER NOTE:</b> ${data.notes}</div>` : ''}
      </body></html>
    `;
  }

  /**
   * Compact Counter Token Slip — super small, paper-efficient slip (under 8cm length)
   * with prominent centered TOKEN #X header, concise item line, and counter note.
   */
  public formatTokenSlipText(data: PrintTokenData, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const width = paperWidth === '58mm' ? 32 : 48;
    const divider = '='.repeat(width);
    const thinDivider = '-'.repeat(width);

    const centerLine = (str: string) => {
      const trimmed = str.trim();
      if (trimmed.length >= width) return trimmed.slice(0, width);
      const padLeft = Math.floor((width - trimmed.length) / 2);
      return ' '.repeat(padLeft) + trimmed;
    };

    const padLine = (left: string, right: string) => {
      const available = width - left.length - right.length;
      if (available <= 0) {
        return left.slice(0, width - right.length - 1) + ' ' + right;
      }
      return left + ' '.repeat(available) + right;
    };

    const lines: string[] = [];
    const storeName = (data.storeName || 'SEZNIK TOKEN').toUpperCase();
    lines.push(centerLine(storeName));
    if (data.storePhone) lines.push(centerLine(`Ph: ${data.storePhone}`));
    lines.push(divider);

    lines.push(centerLine(`*** TOKEN #${data.tokenNumber} ***`));
    lines.push(divider);

    const qty = data.quantity || 1;
    const total = (data.totalAmount !== undefined ? data.totalAmount : (data.price || 0) * qty).toFixed(2);
    lines.push(padLine(`${qty} x ${data.typeName}`, `Rs.${total}`));

    if (data.note) {
      lines.push(thinDivider);
      lines.push(`Note: ${data.note}`);
    }

    lines.push(thinDivider);
    lines.push(padLine('TOTAL PAID:', `Rs.${total}`));
    lines.push(padLine(data.date || new Date().toLocaleDateString('en-GB'), data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
    lines.push(divider);
    lines.push(centerLine('* Please show token at counter *'));
    lines.push('');

    return lines.join('\n');
  }

  /** HTML representation for small compact token slip fallback */
  public generateTokenSlipHtml(data: PrintTokenData, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const widthPx = paperWidth === '58mm' ? '260px' : '340px';
    const qty = data.quantity || 1;
    const total = (data.totalAmount !== undefined ? data.totalAmount : (data.price || 0) * qty).toFixed(2);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { margin: 0; size: auto; }
            body {
              width: ${widthPx};
              margin: 0 auto;
              padding: 8px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 13px;
              color: #000;
              background: #fff;
              text-align: center;
            }
            .bold { font-weight: 900; }
            .token-box {
              border: 2px solid #000;
              padding: 8px;
              margin: 6px 0;
              font-size: 20px;
              font-weight: 900;
            }
            .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="bold" style="font-size: 15px;">${(data.storeName || 'SEZNIK TOKEN').toUpperCase()}</div>
          ${data.storePhone ? `<div style="font-size: 11px;">Ph: ${data.storePhone}</div>` : ''}
          <div class="token-box">TOKEN #${data.tokenNumber}</div>
          <div class="divider"></div>
          <div class="row bold">
            <span>${qty} x ${data.typeName}</span>
            <span>Rs.${total}</span>
          </div>
          ${data.note ? `<div style="text-align: left; font-size: 11px; margin: 4px 0;">Note: ${data.note}</div>` : ''}
          <div class="divider"></div>
          <div class="row bold" style="font-size: 14px;">
            <span>TOTAL (${(data.paymentMethod || 'CASH').toUpperCase()})</span>
            <span>Rs.${total}</span>
          </div>
          <div class="row" style="font-size: 10px; color: #555;">
            <span>${data.date || new Date().toLocaleDateString('en-GB')}</span>
            <span>${data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="divider"></div>
          <div style="font-size: 11px; font-weight: bold; margin-top: 4px;">* Please show token at counter *</div>
        </body>
      </html>
    `;
  }

  /**
   * Direct in-app thermal printing for compact counter token slip.
   * Prints a short, paper-efficient slip with large bold token header.
   */
  public async printTokenSlip(data: PrintTokenData, paperWidth: '58mm' | '80mm' = '58mm'): Promise<boolean> {
    try {
      if (NativeEscposPrinter && typeof NativeEscposPrinter.printText === 'function') {
        const textContent = this.sanitizeForThermalPrint(this.formatTokenSlipText(data, paperWidth));
        await NativeEscposPrinter.printText(textContent, { widthtimes: 0, heigthtimes: 0, cut: false });
        if (typeof NativeEscposPrinter.printAndFeed === 'function') {
          try {
            await NativeEscposPrinter.printAndFeed(25);
          } catch (e) {
            // non-fatal
          }
        }
        return true;
      }
      const html = this.generateTokenSlipHtml(data, paperWidth);
      await Print.printAsync({ html });
      return true;
    } catch (err) {
      console.error('printTokenSlip error:', err);
      return false;
    }
  }

  /**
   * HTML receipt tailored for thermal printers (58mm / 80mm paper widths)
   */
  public generateReceiptHtml(data: PrintSaleData, paperWidth: '58mm' | '80mm' = '58mm', options: ReceiptPrintOptions = {}): string {
    const template = this.resolveActiveTemplate(options);
    const widthPx = paperWidth === '58mm' ? '260px' : '360px';
    const fontSize = paperWidth === '58mm' ? '12px' : '14px';
    const topMarginPx = (options.topMargin || 0) * 10;

    const itemsHtml = data.items
      .map(
        (item, idx) => `
        <div style="margin-bottom: 6px;">
          <div><b>${idx + 1}. ${item.productName}</b></div>
          ${template.showTaxBreakdown && item.gstRate ? `<div style="font-size: 0.85em; color: #555;">${item.gstRate.toFixed(2)}% GST</div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span>&nbsp;&nbsp;${item.quantity} ${item.unit || 'Pc'} x ${item.unitPrice.toFixed(2)}</span>
            <span>${item.total.toFixed(2)}</span>
          </div>
        </div>
      `
      )
      .join('');

    const totalsHtml = template.showTaxBreakdown
      ? (() => {
          const taxable = data.taxableAmt !== undefined ? data.taxableAmt : data.subtotal;
          const halfTax = data.totalTax / 2;
          const sgstVal = data.sgst !== undefined ? data.sgst : halfTax;
          const cgstVal = data.cgst !== undefined ? data.cgst : halfTax;
          const paid = data.amountPaid !== undefined ? data.amountPaid : data.grandTotal;
          const balance = data.changeReturned !== undefined ? data.changeReturned : 0;
          return `
          <table>
            <tr><td>Sub Total</td><td class="right">Rs.${data.subtotal.toFixed(2)}</td></tr>
            ${data.totalDiscount > 0 ? `<tr><td>Discount</td><td class="right">-Rs.${data.totalDiscount.toFixed(2)}</td></tr>` : ''}
            <tr><td>Taxable Amt</td><td class="right">Rs.${taxable.toFixed(2)}</td></tr>
            <tr><td>SGST</td><td class="right">Rs.${sgstVal.toFixed(2)}</td></tr>
            <tr><td>CGST</td><td class="right">Rs.${cgstVal.toFixed(2)}</td></tr>
          </table>
          <div class="double-divider"></div>
          <table class="bold">
            <tr><td>Total Amount</td><td class="right">Rs.${data.grandTotal.toFixed(2)}</td></tr>
            <tr><td>Paid Amount</td><td class="right">Rs.${paid.toFixed(2)}</td></tr>
            <tr><td>Balance</td><td class="right">Rs.${balance.toFixed(2)}</td></tr>
          </table>`;
        })()
      : `
          <table>
            ${data.totalDiscount > 0 ? `<tr><td>Discount</td><td class="right">-Rs.${data.totalDiscount.toFixed(2)}</td></tr>` : ''}
            ${data.totalTax > 0 ? `<tr><td>Tax</td><td class="right">Rs.${data.totalTax.toFixed(2)}</td></tr>` : ''}
          </table>
          <div class="double-divider"></div>
          <table class="bold">
            <tr><td>Grand Total</td><td class="right">Rs.${data.grandTotal.toFixed(2)}</td></tr>
          </table>`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { margin: 0; size: auto; }
            body {
              width: ${widthPx};
              margin: ${topMarginPx}px auto 0;
              padding: 6px;
              font-family: 'Courier New', Courier, monospace;
              font-size: ${fontSize};
              color: #000;
              background: #fff;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-bottom: 2px double #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div class="center" style="margin-bottom: 6px;">
            ${
              data.storeLogoUrl
                ? `<img src="${data.storeLogoUrl}" style="width: 56px; height: 56px; border-radius: 12px; object-fit: cover;" />`
                : `<div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: ${template.accentColor}; font-size: 22px; line-height: 1;">${template.emoji}</div>`
            }
          </div>
          <div class="center bold" style="font-size: 16px;">${(data.storeName || 'Your Store Name').toUpperCase()}</div>
          ${template.tagline ? `<div class="center" style="color: ${template.accentColor}; font-weight: bold;">${template.tagline}</div>` : ''}
          ${data.storeAddress ? `<div class="center">${data.storeAddress}</div>` : ''}
          ${data.storePhone ? `<div class="center">Phone: ${data.storePhone}</div>` : ''}
          ${template.showTaxBreakdown && data.storeGstin ? `<div class="center">GSTIN: ${data.storeGstin}</div>` : ''}

          <div class="divider"></div>

          <div style="display: flex; justify-content: space-between;">
            <span>${template.billLabel}: ${data.invoiceNumber}</span>
            <span>${data.date}</span>
          </div>
          ${template.showCustomerLine ? `<div>Customer: ${data.customerName || 'Walk-in'}</div>` : ''}

          <div class="divider"></div>

          <div class="bold" style="display: flex; justify-content: space-between;">
            <span>${template.itemColumnLeft}</span>
            <span>${template.itemColumnRight}</span>
          </div>
          <div style="margin-top: 4px;">${itemsHtml}</div>

          <div class="divider"></div>

          ${totalsHtml}

          <div class="divider"></div>

          <div class="center" style="margin-top: 8px; font-weight: bold; color: ${template.accentColor};">${template.footerMessage}</div>
        </body>
      </html>
    `;
  }

  /**
   * Full-page A4 tax invoice — a completely different document from the thermal receipt above,
   * for standard laser/inkjet A4 printers (not thermal). Those printers don't speak the raw ESC/POS
   * protocol the Bluetooth thermal SDK uses; on Android/iOS they're reached through the OS's own
   * Print Framework (expo-print -> Print.printAsync), which opens the system print dialog and lists
   * any printer whose manufacturer print-service driver is installed on the phone (e.g. Mopria,
   * HP Print Service, Epson Print Enabler) — the same mechanism the "System" test button already
   * uses. That's why a Bluetooth-paired A4 printer looks "connected" but never actually prints
   * anything sent via the ESC/POS SDK: it isn't listening for ESC/POS commands at all.
   */
  public generateA4InvoiceHtml(data: PrintSaleData, options: ReceiptPrintOptions = {}): string {
    const template = this.resolveActiveTemplate(options);
    const taxable = data.taxableAmt !== undefined ? data.taxableAmt : data.subtotal;
    const halfTax = data.totalTax / 2;
    const sgstVal = data.sgst !== undefined ? data.sgst : halfTax;
    const cgstVal = data.cgst !== undefined ? data.cgst : halfTax;
    const paid = data.amountPaid !== undefined ? data.amountPaid : data.grandTotal;
    const balance = data.changeReturned !== undefined ? data.changeReturned : 0;

    const rowsHtml = data.items
      .map(
        (item, idx) => `
        <tr>
          <td class="c">${idx + 1}</td>
          <td>${item.productName}</td>
          <td class="c">${item.quantity} ${item.unit || 'Pc'}</td>
          <td class="r">${item.unitPrice.toFixed(2)}</td>
          <td class="c">${item.gstRate != null ? `${item.gstRate.toFixed(1)}%` : '-'}</td>
          <td class="r">${item.total.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { size: A4; margin: 16mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111827; }
            .row { display: flex; justify-content: space-between; align-items: flex-start; }
            .letterhead { border-bottom: 3px solid ${template.accentColor}; padding-bottom: 14px; margin-bottom: 18px; }
            .store-name { font-size: 22px; font-weight: 900; }
            .muted { color: #6B7280; font-size: 11px; margin-top: 2px; }
            .invoice-title { font-size: 20px; font-weight: 900; color: ${template.accentColor}; text-align: right; }
            .logo { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #D1D5DB; padding: 8px 10px; font-size: 11.5px; }
            th { background: #F3F4F6; text-align: left; font-weight: 800; text-transform: uppercase; font-size: 10px; }
            .c { text-align: center; } .r { text-align: right; }
            .totals { width: 300px; margin-left: auto; margin-top: 14px; }
            .totals table { margin-top: 0; }
            .totals td { border: none; padding: 4px 0; font-size: 12px; }
            .totals .grand td { border-top: 2px solid #111827; font-weight: 900; font-size: 15px; padding-top: 8px; }
            .bill-to { margin-top: 18px; }
            .bill-to .label { font-size: 10px; font-weight: 800; color: #6B7280; text-transform: uppercase; }
            .upi-note { margin-top: 16px; font-size: 11px; color: #374151; }
            .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #D1D5DB; text-align: center; font-size: 10.5px; color: #6B7280; }
          </style>
        </head>
        <body>
          <div class="letterhead row">
            <div>
              ${data.storeLogoUrl ? `<img class="logo" src="${data.storeLogoUrl}" />` : ''}
              <div class="store-name">${(data.storeName || 'Your Store Name').toUpperCase()}</div>
              ${data.storeAddress ? `<div class="muted">${data.storeAddress}</div>` : ''}
              ${data.storePhone ? `<div class="muted">Phone: ${data.storePhone}</div>` : ''}
              ${data.storeGstin ? `<div class="muted">GSTIN: ${data.storeGstin}</div>` : ''}
            </div>
            <div>
              <div class="invoice-title">TAX INVOICE</div>
              <div class="muted" style="text-align: right;">${template.billLabel}: ${data.invoiceNumber}</div>
              <div class="muted" style="text-align: right;">Date: ${data.date}</div>
            </div>
          </div>

          <div class="bill-to">
            <div class="label">Bill To</div>
            <div style="font-size: 13px; font-weight: 700; margin-top: 2px;">${data.customerName || 'Walk-in Customer'}</div>
          </div>

          <table>
            <thead>
              <tr><th class="c">#</th><th>Item</th><th class="c">Qty</th><th class="r">Rate</th><th class="c">Tax</th><th class="r">Amount</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="totals">
            <table>
              <tr><td>Sub Total</td><td class="r">Rs.${data.subtotal.toFixed(2)}</td></tr>
              ${data.totalDiscount > 0 ? `<tr><td>Discount</td><td class="r">-Rs.${data.totalDiscount.toFixed(2)}</td></tr>` : ''}
              ${
                template.showTaxBreakdown
                  ? `<tr><td>Taxable Amt</td><td class="r">Rs.${taxable.toFixed(2)}</td></tr>
                     <tr><td>SGST</td><td class="r">Rs.${sgstVal.toFixed(2)}</td></tr>
                     <tr><td>CGST</td><td class="r">Rs.${cgstVal.toFixed(2)}</td></tr>`
                  : data.totalTax > 0
                    ? `<tr><td>Tax</td><td class="r">Rs.${data.totalTax.toFixed(2)}</td></tr>`
                    : ''
              }
              <tr class="grand"><td>Grand Total</td><td class="r">Rs.${data.grandTotal.toFixed(2)}</td></tr>
              <tr><td>Paid Amount</td><td class="r">Rs.${paid.toFixed(2)}</td></tr>
              ${balance > 0 ? `<tr><td>Balance Due</td><td class="r">Rs.${balance.toFixed(2)}</td></tr>` : ''}
            </table>
          </div>

          ${data.upiId ? `<div class="upi-note">Pay via UPI: <b>${data.upiId}</b></div>` : ''}

          <div class="footer">
            This is a computer-generated invoice from ${(data.storeName || 'the store')}. ${template.footerMessage}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Sends the A4 invoice through the OS Print Framework (not the Bluetooth ESC/POS SDK — see the
   * generateA4InvoiceHtml doc comment for why those are different code paths). On Android this opens
   * the system print dialog listing any printer whose manufacturer print-service is installed; on
   * iOS, pass a `printerUrl` from `selectSystemPrinter()` first, or it opens the iOS print sheet.
   */
  public async printA4Invoice(data: PrintSaleData, options: ReceiptPrintOptions = {}): Promise<boolean> {
    try {
      const html = this.generateA4InvoiceHtml(data, options);
      await Print.printAsync({ html, width: 595, height: 842 }); // A4 at 72 PPI
      return true;
    } catch (error) {
      console.error('A4 Invoice print error:', error);
      return false;
    }
  }

  /**
   * Print Custom Product Barcode / QR Label (TSPL 50x30mm)
   */
  /**
   * Builds centered, properly-proportioned TSPL text/barcode/qrcode fields for a 50x30mm label —
   * shared by printCustomLabel() and printTestLabel(), which previously each hard-coded an
   * identical left-pinned layout (`x: 20` for every element, regardless of content width — that's
   * why prior prints looked left-jammed instead of centered "like industrial labels").
   *
   * TSPL (the command language this SDK's TscCommand.java actually emits — confirmed by reading
   * its addText/add1DBarcode/addQRCode methods) has no built-in text/barcode centering primitive;
   * every element is placed by explicit x/y in dots. Centering here is computed from TSPL's
   * documented fixed font-cell size (FONT_3 = 16x24 dots/char at 1x) for text, and from EAN13's
   * fixed 95-module width (GS1 spec) for EAN13 barcodes — both exact. CODE128/QR centering is a
   * best-effort estimate (their encoded width depends on content/version and isn't computable from
   * this SDK alone) — bar/module size is increased instead so the result reads as bold and
   * confidently placed even if a few dots off true center, rather than thin and edge-hugging.
   *
   * Also fixes a second bug: the previous barcode sat at y:160 with height:60 on a 240-dot-tall
   * (30mm) label — only 20 dots of clearance before the label's physical bottom edge, not enough
   * room for the human-readable digits underneath (readable:1 was set correctly, but the text had
   * nowhere left to print and was getting clipped at the tear edge) — that's the missing HRI text
   * under the barcode in the printed photo. Repositioned with real clearance below.
   */
  /**
   * Exact module count (21 for a small V1 code, 25 for V2, ...) for the given content at ECC
   * level M — computed with the `qrcode` package's own encoder (already installed as a transitive
   * dependency of react-native-qrcode-svg; its core module is pure JS with no rendering/Node-only
   * code, so it's safe to call directly). Used to size/center the TSPL QRCODE command exactly
   * instead of guessing — an estimated module count could over- or under-shoot the real size,
   * which is what let a QR code overflow onto the next label.
   */
  private getQrModuleCount(content: string): number {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const QRCodeCore = require('qrcode/lib/core/qrcode');
    const symbol = QRCodeCore.create(content, { errorCorrectionLevel: 'M' });
    return symbol.modules.size;
  }

  private buildTsplLabelFields(
    product: { name: string; sellingPrice: number; barcode?: string | null; sku?: string | null; id?: string },
    format: 'qr' | 'code128' | 'ean13',
    labelWidthMm: number = 50,
    labelHeightMm: number = 30
  ) {
    const DOTS_PER_MM = 8; // 203 DPI standard for thermal label printers (8 dots per mm)
    const LABEL_W_DOTS = labelWidthMm * DOTS_PER_MM; // 50mm = 400 dots
    const LABEL_H_DOTS = labelHeightMm * DOTS_PER_MM; // 30mm = 240 dots
    const FONT3_CHAR_W = 16; // TSPL FONT_3 width at 1x
    const MARGIN_2MM = 16; // Standard 2mm minimum margin = 16 dots at 203 DPI

    const rawCode = product.barcode || product.sku || `PROD-${product.id?.slice(-6) || '1234'}`;

    // Max characters that can fit on top line with 2mm side margins
    const maxNameChars = Math.max(4, Math.floor((LABEL_W_DOTS - MARGIN_2MM * 2) / FONT3_CHAR_W));
    const displayName = product.name.length > maxNameChars ? `${product.name.slice(0, maxNameChars - 1)}…` : product.name;
    const priceText = `Rs.${product.sellingPrice.toFixed(2)}`;

    // 1. Name Text — Centered Horizontally at Top (y=10)
    const nameWidthDots = displayName.length * FONT3_CHAR_W;
    const nameX = Math.max(MARGIN_2MM, Math.round((LABEL_W_DOTS - nameWidthDots) / 2));
    const nameY = 10;

    // 2. Price Text — Centered Horizontally below Name (y=34)
    const priceWidthDots = priceText.length * FONT3_CHAR_W;
    const priceX = Math.max(MARGIN_2MM, Math.round((LABEL_W_DOTS - priceWidthDots) / 2));
    const priceY = 34;

    const text = [
      {
        text: displayName,
        x: nameX,
        y: nameY,
        fonttype: NativeTscPrinter.FONTTYPE?.FONT_3 ?? '3',
        rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
        xscal: NativeTscPrinter.FONTMUL?.MUL_1 ?? 1,
        yscal: NativeTscPrinter.FONTMUL?.MUL_1 ?? 1,
      },
      {
        text: priceText,
        x: priceX,
        y: priceY,
        fonttype: NativeTscPrinter.FONTTYPE?.FONT_3 ?? '3',
        rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
        xscal: NativeTscPrinter.FONTMUL?.MUL_1 ?? 1,
        yscal: NativeTscPrinter.FONTMUL?.MUL_1 ?? 1,
        bold: true,
      },
    ];

    // 3. Code Zone (QR Code or Barcode) — Starts at y=62 (2mm gap below price text), leaving 2mm (16 dots) bottom margin
    const codeZoneY = 62;
    const maxBottomY = Math.round(LABEL_H_DOTS - MARGIN_2MM); // 224 dots max Y for 30mm label
    const maxCodeH = Math.max(40, maxBottomY - codeZoneY); // 162 dots max available height

    let qrcode: any[] | undefined;
    let barcode: any[] | undefined;
    let effectiveFormat = format;

    if (effectiveFormat === 'ean13') {
      const digits = rawCode.replace(/\D/g, '');
      if (digits.length !== 12 && digits.length !== 13) {
        effectiveFormat = 'code128';
      }
    }

    if (effectiveFormat === 'qr') {
      let qrModules = 25;
      try {
        qrModules = this.getQrModuleCount(rawCode);
      } catch {
        qrModules = 25;
      }

      // STANDARD SPEC: QR Code size = 15x15mm (120x120 dots) to 20x20mm (160x160 dots) square
      const MIN_QR_DOTS = 120; // 15mm
      const MAX_QR_DOTS = 160; // 20mm

      let cellWidth = Math.floor(150 / qrModules);
      let qrSize = qrModules * cellWidth;

      if (qrSize < MIN_QR_DOTS) {
        cellWidth = Math.min(6, Math.ceil(MIN_QR_DOTS / qrModules));
        qrSize = qrModules * cellWidth;
      } else if (qrSize > MAX_QR_DOTS) {
        cellWidth = Math.max(2, Math.floor(MAX_QR_DOTS / qrModules));
        qrSize = qrModules * cellWidth;
      }

      // Perfectly Centered Horizontally & Vertically in lower region with >2mm margin on all sides
      const qrX = Math.max(MARGIN_2MM, Math.round((LABEL_W_DOTS - qrSize) / 2));
      const qrY = codeZoneY + Math.max(0, Math.round((maxCodeH - qrSize) / 2));

      qrcode = [
        {
          x: qrX,
          y: qrY,
          level: NativeTscPrinter.EEC?.LEVEL_M ?? 'M',
          width: cellWidth,
          rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
          code: rawCode,
        },
      ];
    } else {
      // STANDARD SPEC: Barcode size = 35x8mm (280x64 dots) to 40x10mm (320x80 dots) rectangle
      const barY = codeZoneY + 6;
      const barHeight = 64; // 8mm height standard rectangle
      const TARGET_MIN_W_DOTS = 280; // 35mm
      const TARGET_MAX_W_DOTS = 320; // 40mm

      if (effectiveFormat === 'ean13') {
        const digits = rawCode.replace(/\D/g, '');
        const EAN13_MODULES = 95; // GS1 spec
        // narrow=3 => 95 * 3 = 285 dots (35.6mm wide), perfectly inside 35-40mm range
        const narrow = 3;
        const barWidth = EAN13_MODULES * narrow;
        const barX = Math.max(MARGIN_2MM, Math.round((LABEL_W_DOTS - barWidth) / 2));

        barcode = [
          {
            x: barX,
            y: barY,
            type: NativeTscPrinter.BARCODETYPE?.EAN13 ?? 'EAN13',
            height: barHeight,
            wide: narrow * 2,
            narrow,
            readable: NativeTscPrinter.READABLE?.EANBLE ?? 1,
            rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
            code: digits,
          },
        ];
      } else {
        const content = rawCode.replace(/[^\x20-\x7E]/g, '');
        const estModules = 35 + content.length * 11;
        let narrow = Math.min(3, Math.max(2, Math.floor(TARGET_MAX_W_DOTS / estModules)));
        let barWidth = estModules * narrow;

        if (barWidth < TARGET_MIN_W_DOTS && narrow < 4) {
          narrow = Math.min(4, Math.ceil(TARGET_MIN_W_DOTS / estModules));
          barWidth = estModules * narrow;
        }

        const barX = Math.max(MARGIN_2MM, Math.round((LABEL_W_DOTS - Math.min(TARGET_MAX_W_DOTS, barWidth)) / 2));

        barcode = [
          {
            x: barX,
            y: barY,
            type: NativeTscPrinter.BARCODETYPE?.CODE128 ?? '128',
            height: barHeight,
            wide: narrow * 2,
            narrow,
            readable: NativeTscPrinter.READABLE?.EANBLE ?? 1,
            rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
            code: content,
          },
        ];
      }
    }

    return { text, qrcode, barcode, labelWidthMm, labelHeightMm };
  }

  /**
   * Prints a user-designed Label Studio template with the REAL product's data substituted for each
   * bound element (see src/types/labelTemplate.ts's `binding` field) — the template only stores
   * WHICH field to show, never a captured value, so printing a different product through the same
   * template shows THAT product's actual name/price/barcode, not placeholder/test data.
   *
   * Phase 1 scope: only 'text', 'barcode', 'qrcode' elements become native TSPL commands (same
   * mm->dot math and exact-QR-sizing approach as buildTsplLabelFields/getQrModuleCount above).
   * Image/Rect/CurveRect/Circle/Line/Table elements are silently skipped — Label Studio's editor
   * doesn't create them yet either; the planned fix is compositing them into one flattened bitmap
   * via the native SDK's confirmed-working `image` field (see buildTsplLabelFields's doc comment
   * on addBitmap) once that editor support exists.
   */
  public async printLabelFromTemplate(product: Product, template: LabelTemplate, copies: number = 1): Promise<boolean> {
    if (!NativeTscPrinter || typeof NativeTscPrinter.printLabel !== 'function') return false;

    const DOTS_PER_MM = 8;
    const FONT3_CHAR_W = 16;
    const toDots = (mm: number) => Math.round(mm * DOTS_PER_MM);

    const resolveTextValue = (el: LabelTextElement): string => {
      switch (el.binding) {
        case 'productName':
          return product.name || 'Product';
        case 'price':
          return `Rs.${product.sellingPrice.toFixed(2)}`;
        case 'sku':
          return product.sku || '';
        case 'barcodeText':
          return product.barcode || product.sku || '';
        case 'unit':
          return product.unit || 'Pc';
        case 'category':
          return product.category?.name || '';
        case 'custom':
        default:
          return el.customText || '';
      }
    };

    const resolveCodeValue = (el: LabelBarcodeElement | LabelQrElement): string => {
      switch (el.binding) {
        case 'barcode':
          return product.barcode || product.sku || `PROD-${product.id.slice(-6)}`;
        case 'sku':
          return product.sku || product.barcode || `PROD-${product.id.slice(-6)}`;
        case 'custom':
        default:
          return el.customValue || '';
      }
    };

    const textFields: any[] = [];
    const barcodeFields: any[] = [];
    const qrFields: any[] = [];

    for (const el of template.elements) {
      if (el.type === 'text') {
        const value = this.sanitizeForThermalPrint(resolveTextValue(el));
        if (!value) continue;
        // fontSizePt is stored in mm (24 dots = 3mm at FONT_3's native 1x cell height) — derive the
        // nearest whole TSPL FONTMUL scale from it, same convention buildTsplLabelFields assumes.
        const scale = Math.min(10, Math.max(1, Math.round(el.fontSizePt / 3)));
        const boxWidthDots = toDots(el.widthMm);
        const textWidthDots = value.length * FONT3_CHAR_W * scale;
        let xDots = toDots(el.xMm);
        if (el.align === 'center') xDots += Math.max(0, Math.round((boxWidthDots - textWidthDots) / 2));
        else if (el.align === 'right') xDots += Math.max(0, boxWidthDots - textWidthDots);

        textFields.push({
          text: value,
          x: xDots,
          y: toDots(el.yMm),
          fonttype: NativeTscPrinter.FONTTYPE?.FONT_3 ?? '3',
          rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
          xscal: scale,
          yscal: scale,
          bold: !!el.bold,
        });
      } else if (el.type === 'barcode') {
        const raw = resolveCodeValue(el);
        const digits = raw.replace(/\D/g, '');
        let type = NativeTscPrinter.BARCODETYPE?.CODE128 ?? '128';
        let content = raw.replace(/[^\x20-\x7E]/g, '');
        let moduleCount = 35 + content.length * 11; // CODE128 approximation, same as buildTsplLabelFields
        if (el.format === 'ean13' && (digits.length === 12 || digits.length === 13)) {
          type = NativeTscPrinter.BARCODETYPE?.EAN13 ?? 'EAN13';
          content = digits;
          moduleCount = 95; // exact, fixed by the GS1 spec
        }
        if (!content) continue;
        // Fit the module width to the box the user actually drew, same "grow when there's spare
        // room, shrink when it must" approach as buildTsplLabelFields's narrow calculation.
        const narrow = Math.min(4, Math.max(1, Math.floor(toDots(el.widthMm) / moduleCount)));
        barcodeFields.push({
          x: toDots(el.xMm),
          y: toDots(el.yMm),
          type,
          height: toDots(el.heightMm),
          wide: narrow + 1,
          narrow,
          readable: NativeTscPrinter.READABLE?.EANBLE ?? 1,
          rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
          code: content,
        });
      } else if (el.type === 'qrcode') {
        const content = resolveCodeValue(el);
        if (!content) continue;
        let qrModules = 27;
        try {
          qrModules = this.getQrModuleCount(content);
        } catch {
          // keep the fallback estimate
        }
        // The box is square-constrained to whichever side (width/height) is tighter, same
        // structural guarantee against overflow as buildTsplLabelFields's QR sizing.
        const boxDots = Math.min(toDots(el.widthMm), toDots(el.heightMm));
        const cellWidth = Math.max(2, Math.min(10, Math.floor(boxDots / qrModules)));
        qrFields.push({
          x: toDots(el.xMm),
          y: toDots(el.yMm),
          level: NativeTscPrinter.EEC?.LEVEL_M ?? 'M',
          width: cellWidth,
          rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
          code: content,
        });
      }
      // Image/Rect/CurveRect/Circle/Line/Table: not yet supported natively — skipped (Phase 2).
    }

    try {
      if (NativeTscPrinter && typeof NativeTscPrinter.printLabel === 'function') {
        try {
          for (let i = 0; i < Math.max(1, copies); i++) {
            await NativeTscPrinter.printLabel({
              width: template.widthMm,
              height: template.heightMm,
              gap: 2,
              direction: NativeTscPrinter.DIRECTION?.FORWARD ?? 0,
              reference: [0, 0],
              tear: NativeTscPrinter.TEAR?.ON ?? 'ON',
              sound: 0,
              text: textFields,
              barcode: barcodeFields.length ? barcodeFields : undefined,
              qrcode: qrFields.length ? qrFields : undefined,
            });
          }
          return true;
        } catch (tscErr) {
          console.warn('TSPL Bluetooth print failed, falling back to System Print framework:', tscErr);
        }
      }

      // Fallback: System Print framework (PDF / Laser / System Print dialog)
      const html = this.generateLabelFromTemplateHtml(product, template);
      await Print.printAsync({ html });
      return true;
    } catch (error) {
      console.error('printLabelFromTemplate error:', error);
      return false;
    }
  }

  public generateLabelFromTemplateHtml(product: Product, template: LabelTemplate): string {
    const resolveTextValue = (el: LabelTextElement): string => {
      switch (el.binding) {
        case 'productName':
          return product.name || 'Product';
        case 'price':
          return `Rs.${product.sellingPrice.toFixed(2)}`;
        case 'sku':
          return product.sku || '';
        case 'barcodeText':
          return product.barcode || product.sku || '';
        case 'unit':
          return product.unit || 'Pc';
        case 'category':
          return product.category?.name || '';
        case 'custom':
        default:
          return el.customText || '';
      }
    };

    const resolveCodeValue = (el: LabelBarcodeElement | LabelQrElement): string => {
      switch (el.binding) {
        case 'barcode':
          return product.barcode || product.sku || `PROD-${product.id.slice(-6)}`;
        case 'sku':
          return product.sku || product.barcode || `PROD-${product.id.slice(-6)}`;
        case 'custom':
        default:
          return el.customValue || '';
      }
    };

    const elementsHtml = template.elements
      .map((el) => {
        if (el.type === 'text') {
          const val = resolveTextValue(el);
          return `
            <div style="
              position: absolute;
              left: ${el.xMm}mm;
              top: ${el.yMm}mm;
              width: ${el.widthMm}mm;
              height: ${el.heightMm}mm;
              font-size: ${el.fontSizePt * 2.8}pt;
              font-weight: ${el.bold ? 'bold' : 'normal'};
              text-align: ${el.align || 'center'};
              overflow: hidden;
              white-space: nowrap;
            ">${val}</div>`;
        }
        if (el.type === 'barcode' || el.type === 'qrcode') {
          const val = resolveCodeValue(el);
          return `
            <div style="
              position: absolute;
              left: ${el.xMm}mm;
              top: ${el.yMm}mm;
              width: ${el.widthMm}mm;
              height: ${el.heightMm}mm;
              text-align: center;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: monospace;
              font-weight: bold;
              font-size: 11px;
              border: 1px dashed #666;
            ">[${el.type.toUpperCase()}: ${val}]</div>`;
        }
        if (el.type === 'image' && el.uri) {
          return `
            <div style="
              position: absolute;
              left: ${el.xMm}mm;
              top: ${el.yMm}mm;
              width: ${el.widthMm}mm;
              height: ${el.heightMm}mm;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            ">
              <img src="${el.uri}" style="
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                ${el.invert ? 'filter: invert(100%);' : ''}
              " />
            </div>`;
        }
        return '';
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { margin: 0; size: ${template.widthMm}mm ${template.heightMm}mm; }
            body {
              width: ${template.widthMm}mm;
              height: ${template.heightMm}mm;
              margin: 0;
              padding: 0;
              position: relative;
              font-family: Arial, sans-serif;
              color: #000;
              background: #fff;
            }
          </style>
        </head>
        <body>
          ${elementsHtml}
        </body>
      </html>
    `;
  }

  public async printCustomLabel(
    product: { name: string; sellingPrice: number; barcode?: string | null; sku?: string | null; id?: string },
    format: 'qr' | 'code128' | 'ean13' = 'qr',
    density?: number,
    labelWidthMm: number = 50,
    labelHeightMm: number = 30,
    labelGapMm: number = 2
  ): Promise<boolean> {
    const rawCode = product.barcode || product.sku || `PROD-${product.id?.slice(-6) || '1234'}`;

    try {
      if (NativeTscPrinter && typeof NativeTscPrinter.printLabel === 'function') {
        try {
          const fields = this.buildTsplLabelFields(product, format, labelWidthMm, labelHeightMm);

          await NativeTscPrinter.printLabel({
            width: fields.labelWidthMm,
            height: fields.labelHeightMm,
            gap: labelGapMm,
            direction: NativeTscPrinter.DIRECTION?.FORWARD ?? 0,
            reference: [0, 0],
            tear: NativeTscPrinter.TEAR?.ON ?? 'ON',
            sound: 0,
            // TSC DENSITY is a real native heat-intensity knob (0-15) — unlike ESC/POS receipts,
            // which have no density command in this SDK. Omitted entirely when not provided,
            // so the printer just uses its own default.
            density: density != null ? NativeTscPrinter.DENSITY?.[`DNESITY${Math.min(15, Math.max(0, Math.round(density)))}`] : undefined,
            text: fields.text,
            qrcode: fields.qrcode,
            barcode: fields.barcode,
          });
          return true;
        } catch (tscErr: any) {
          console.warn('TSC direct print failed, falling back to System Print:', tscErr);
        }
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { margin: 0; size: 50mm 30mm; }
              body {
                width: 50mm;
                height: 30mm;
                margin: 0;
                padding: 4px;
                box-sizing: border-box;
                font-family: Arial, sans-serif;
                text-align: center;
                color: #000;
                background: #fff;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
              }
              .store-title { font-size: 8px; font-weight: bold; text-transform: uppercase; }
              .product-name { font-size: 11px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              .price { font-size: 14px; font-weight: 900; }
              .code-text { font-size: 9px; letter-spacing: 1px; font-family: monospace; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="store-title">SEZNIK POS STORE</div>
            <div class="product-name">${product.name}</div>
            <div class="price">₹${product.sellingPrice.toFixed(2)}</div>
            <div class="code-text">[${format.toUpperCase()}]: *${rawCode}*</div>
          </body>
        </html>
      `;
      await Print.printAsync({ html });
      return true;
    } catch (error) {
      console.error('Custom Label Print error:', error);
      return false;
    }
  }

  /**
   * Prints a barcode/QR product label on the CONNECTED ESC/POS THERMAL RECEIPT PRINTER (58/80mm
   * continuous roll) — for stores whose only printer is the receipt roll, not a separate TSPL
   * die-cut label printer. `printCustomLabel()` above only ever talks to `NativeTscPrinter`
   * (a genuinely different physical printer/protocol using die-cut label stock with a gap sensor);
   * when that module isn't present it falls back to `generateLabelHtml()`'s `Print.printAsync`
   * path, which renders the barcode as literal text wrapped in asterisks (e.g. "*8901234567890*")
   * relying on a "Free 3 of 9" barcode font that doesn't exist on the phone or the printer — that's
   * the unreadable text ("gibberish") instead of an actual scannable barcode. This method instead
   * uses the ESC/POS SDK's real native barcode/QR commands (confirmed in the installed source:
   * `printQRCode()` — already used for the receipt UPI QR — and `printBarCode()`, whose valid
   * `nType` range 0x41-0x49 is the standard ESC/POS "GS k" symbology table: 0x43=EAN13, 0x49=CODE128).
   */
  public async printLabelOnReceiptPaper(
    product: { name: string; sellingPrice: number; barcode?: string | null; sku?: string | null; id?: string },
    format: 'qr' | 'code128' | 'ean13' = 'qr',
    paperWidth: '58mm' | '80mm' = '58mm',
    copies: number = 1
  ): Promise<boolean> {
    if (!NativeEscposPrinter || typeof NativeEscposPrinter.printText !== 'function') return false;

    const rawCode = product.barcode || product.sku || `PROD-${product.id?.slice(-6) || '1234'}`;
    // Cap the product name length so it stays on one line instead of wrapping mid-word and
    // throwing off the compact label look — purely a truncation guard now, NOT used for padding
    // (padding text with spaces AND setting hardware printerAlign(CENTER) was the actual bug: the
    // printer re-centers an already left-padded string, visibly shifting it off true center).
    const maxNameLen = paperWidth === '80mm' ? 36 : 24;
    const truncatedName = product.name.trim().length > maxNameLen ? `${product.name.trim().slice(0, maxNameLen - 1)}…` : product.name.trim();

    try {
      for (let i = 0; i < Math.max(1, copies); i++) {
        if (typeof NativeEscposPrinter.printerAlign === 'function') {
          await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.CENTER ?? 1);
        }

        // Raw, unpadded text — printerAlign(CENTER) above centers it natively at the dot level,
        // which is what actually gets it aligned correctly (character-column padding fights it).
        const header = this.sanitizeForThermalPrint(`${truncatedName}\nRs.${product.sellingPrice.toFixed(2)}\n`);
        await NativeEscposPrinter.printText(header, { widthtimes: 0, heigthtimes: 0, cut: false });

        // Sized to sit within a ~30mm-tall label footprint (matching the 50x30mm die-cut stock the
        // TSPL Gap-mode path uses) rather than spanning arbitrarily large — at ~8 dots/mm: QR 130
        // dots ≈ 16mm, barcode bars 64 dots ≈ 8mm, leaving room for the header text + HRI digits
        // within the ~30mm vertical budget instead of overflowing what a label-sized print should be.
        if (format === 'qr') {
          if (typeof NativeEscposPrinter.printQRCode === 'function') {
            await NativeEscposPrinter.printQRCode(rawCode, 130, NativeEscposPrinter.ERROR_CORRECTION?.M ?? 0);
          }
        } else if (typeof NativeEscposPrinter.printBarCode === 'function') {
          // EAN13 needs exactly 12-13 digits (the printer computes/verifies the checksum itself) —
          // if the product's code isn't valid EAN13 content, fall back to CODE128, which accepts
          // any printable ASCII, rather than silently printing wrong/truncated digits.
          let nType = 0x49; // CODE128
          let barcodeContent = rawCode.replace(/[^\x20-\x7E]/g, '');
          if (format === 'ean13') {
            const digits = rawCode.replace(/\D/g, '');
            if (digits.length === 12 || digits.length === 13) {
              nType = 0x43; // EAN13
              barcodeContent = digits;
            }
          }
          if (barcodeContent) {
            // widthX=2 (narrowest module, dots), height=64dots (~8mm), HRI font A, text below the bars.
            NativeEscposPrinter.printBarCode(barcodeContent, nType, 2, 64, 0, 2);
          }
        }

        if (typeof NativeEscposPrinter.printerAlign === 'function') {
          await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
        }
        if (typeof NativeEscposPrinter.printAndFeed === 'function') {
          try {
            // Tighter than a full receipt's tear-clearance feed (60) — a label is meant to be
            // compact, not leave a long blank gap before the next one.
            await NativeEscposPrinter.printAndFeed(30);
          } catch (feedErr) {
            console.warn('printAndFeed failed (non-fatal):', feedErr);
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Receipt-paper label print error:', error);
      return false;
    }
  }

  /**
   * Prints a Label Studio TEMPLATE on the CONNECTED ESC/POS RECEIPT PRINTER (58/80mm continuous
   * roll) — the continuous-mode counterpart to `printLabelFromTemplate()` (which is TSPL-only,
   * for the die-cut Gap-mode printer). Without this, the Label Studio "Test Print"/real-print paths
   * had no receipt-paper option at all and fell through to `printLabelFromTemplate`, which sent raw
   * TSPL command text (`SIZE 50 mm,30 mm`, `TEXT 10,10,...`, etc.) to an ESC/POS printer that has no
   * concept of TSPL syntax — the printer just prints those command bytes as literal characters,
   * which is exactly the "gibberish text" this fixes.
   *
   * IMPORTANT LIMITATION (real, not a bug to "just fix further"): ESC/POS receipt printers have no
   * native absolute X/Y positioning command the way TSPL does — `printText()` is a linear top-to-
   * bottom stream with only left/center/right alignment, confirmed against the same native SDK used
   * throughout this file. A template designed with elements freely positioned/overlapping cannot be
   * reproduced pixel-for-pixel on this hardware. This renders a best-effort SEQUENTIAL approximation
   * instead: elements sorted top-to-bottom by their designed yMm, each on its own line/block, using
   * the element's own `align` for left/center/right and `fontSizePt` for size — same real-product-
   * data binding as the TSPL path, just a different physical rendering model.
   */
  public async printLabelTemplateOnReceiptPaper(
    product: Product,
    template: LabelTemplate,
    paperWidth: '58mm' | '80mm' = '58mm',
    copies: number = 1
  ): Promise<boolean> {
    if (!NativeEscposPrinter || typeof NativeEscposPrinter.printText !== 'function') return false;

    const DOTS_PER_MM = 8;
    const toDots = (mm: number) => Math.round(mm * DOTS_PER_MM);
    const ALIGN = { left: NativeEscposPrinter.ALIGN?.LEFT ?? 0, center: NativeEscposPrinter.ALIGN?.CENTER ?? 1, right: NativeEscposPrinter.ALIGN?.RIGHT ?? 2 };

    const resolveTextValue = (el: LabelTextElement): string => {
      switch (el.binding) {
        case 'productName':
          return product.name || 'Product';
        case 'price':
          return `Rs.${product.sellingPrice.toFixed(2)}`;
        case 'sku':
          return product.sku || '';
        case 'barcodeText':
          return product.barcode || product.sku || '';
        case 'unit':
          return product.unit || 'Pc';
        case 'category':
          return product.category?.name || '';
        case 'custom':
        default:
          return el.customText || '';
      }
    };

    const resolveCodeValue = (el: LabelBarcodeElement | LabelQrElement): string => {
      switch (el.binding) {
        case 'barcode':
          return product.barcode || product.sku || `PROD-${product.id.slice(-6)}`;
        case 'sku':
          return product.sku || product.barcode || `PROD-${product.id.slice(-6)}`;
        case 'custom':
        default:
          return el.customValue || '';
      }
    };

    // Elements print in a linear top-to-bottom stream on this hardware, so the design's Y order is
    // the only positional information that carries over — X position doesn't apply beyond alignment.
    const orderedElements = [...template.elements].sort((a, b) => a.yMm - b.yMm);
    // Same truncation convention as printLabelOnReceiptPaper — keeps each text element on one
    // printed line instead of wrapping mid-word on the narrower 58mm roll.
    const maxLineLen = paperWidth === '80mm' ? 36 : 24;

    try {
      for (let i = 0; i < Math.max(1, copies); i++) {
        for (const el of orderedElements) {
          if (el.type === 'text') {
            let value = this.sanitizeForThermalPrint(resolveTextValue(el));
            if (value.length > maxLineLen) value = `${value.slice(0, maxLineLen - 1)}…`;
            if (!value) continue;
            if (typeof NativeEscposPrinter.printerAlign === 'function') {
              await NativeEscposPrinter.printerAlign(ALIGN[el.align || 'left']);
            }
            // ESC/POS text scale here only goes 0 (normal) or 1 (double) — no native "bold" option
            // exposed by this SDK's printText, so larger fontSizePt is the closest approximation.
            const scale = el.fontSizePt >= 4 ? 1 : 0;
            await NativeEscposPrinter.printText(`${value}\n`, { widthtimes: scale, heigthtimes: scale, cut: false });
          } else if (el.type === 'barcode') {
            const raw = resolveCodeValue(el);
            const digits = raw.replace(/\D/g, '');
            let nType = 0x49; // CODE128
            let content = raw.replace(/[^\x20-\x7E]/g, '');
            if (el.format === 'ean13' && (digits.length === 12 || digits.length === 13)) {
              nType = 0x43; // EAN13
              content = digits;
            }
            if (!content) continue;
            if (typeof NativeEscposPrinter.printerAlign === 'function') {
              await NativeEscposPrinter.printerAlign(ALIGN.center);
            }
            if (typeof NativeEscposPrinter.printBarCode === 'function') {
              const height = Math.max(24, Math.min(160, toDots(el.heightMm)));
              NativeEscposPrinter.printBarCode(content, nType, 2, height, 0, 2);
            }
          } else if (el.type === 'qrcode') {
            const content = resolveCodeValue(el);
            if (!content) continue;
            if (typeof NativeEscposPrinter.printerAlign === 'function') {
              await NativeEscposPrinter.printerAlign(ALIGN.center);
            }
            if (typeof NativeEscposPrinter.printQRCode === 'function') {
              let qrModules = 27;
              try {
                qrModules = this.getQrModuleCount(content);
              } catch {
                // keep the fallback estimate
              }
              const targetDots = Math.max(60, Math.min(240, toDots(Math.min(el.widthMm, el.heightMm))));
              await NativeEscposPrinter.printQRCode(content, targetDots, NativeEscposPrinter.ERROR_CORRECTION?.M ?? 0);
              void qrModules; // printQRCode takes a target pixel size directly (unlike TSPL's cell-size param) — module count isn't needed here, kept only for parity/clarity with the other paths
            }
          } else if (el.type === 'image' && el.uri) {
            try {
              const base64Pic = await this.uriToBase64(el.uri);
              if (base64Pic && typeof NativeEscposPrinter.printPic === 'function') {
                const paperSizeDots = paperWidth === '80mm' ? 576 : 384;
                const widthDots = Math.min(paperSizeDots, toDots(el.widthMm));
                NativeEscposPrinter.printPic(base64Pic, { width: widthDots, center: true, autoCut: false, paperSize: paperSizeDots });
              }
            } catch (imgErr) {
              console.warn('Image element print failed:', imgErr);
            }
          }
        }

        if (typeof NativeEscposPrinter.printerAlign === 'function') {
          await NativeEscposPrinter.printerAlign(ALIGN.left);
        }
        if (typeof NativeEscposPrinter.printAndFeed === 'function') {
          try {
            await NativeEscposPrinter.printAndFeed(30);
          } catch (feedErr) {
            console.warn('printAndFeed failed (non-fatal):', feedErr);
          }
        }
      }
      return true;
    } catch (error) {
      console.error('printLabelTemplateOnReceiptPaper error:', error);
      return false;
    }
  }

  /**
   * HTML label tailored for TSPL / CPCL barcode & QR printers (50x30mm)
   */
  public generateLabelHtml(product: { name: string; sellingPrice: number; barcode?: string; storeName?: string }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { margin: 0; size: 50mm 30mm; }
            body {
              width: 50mm;
              height: 30mm;
              margin: 0;
              padding: 4px;
              box-sizing: border-box;
              font-family: Arial, sans-serif;
              text-align: center;
              color: #000;
              background: #fff;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .store-title { font-size: 9px; font-weight: bold; text-transform: uppercase; }
            .product-name { font-size: 11px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .price { font-size: 14px; font-weight: 900; }
            .code-text { font-size: 9px; letter-spacing: 1px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="store-title">${product.storeName || 'SEZNIK POS'}</div>
          <div class="product-name">${product.name}</div>
          <div class="price">₹${product.sellingPrice.toFixed(2)}</div>
          <div class="code-text">*${product.barcode || '8901234567890'}*</div>
        </body>
      </html>
    `;
  }

  /**
   * Helper alias for printReceipt accepting options object with optional paperWidth
   */
  public async printSaleReceipt(
    data: PrintSaleData,
    options: ReceiptPrintOptions & { paperWidth?: '58mm' | '80mm' } = {}
  ): Promise<boolean> {
    const { paperWidth = '58mm', ...restOptions } = options;
    return this.printReceipt(data, paperWidth, restOptions);
  }

  /**
   * Direct in-app thermal printing via Native Bluetooth ESC/POS module or system fallback.
   * Prints `options.copies` times sequentially (default 1) — e.g. customer + merchant copy.
   */
  public async printReceipt(data: PrintSaleData, paperWidth: '58mm' | '80mm' = '58mm', options: ReceiptPrintOptions = {}): Promise<boolean> {

    const copies = Math.max(1, options.copies || 1);

    try {
      if (NativeEscposPrinter && typeof NativeEscposPrinter.printText === 'function') {
        try {
          // sanitizeForThermalPrint strips/normalizes anything the GBK-default native printText()
          // can't render (emoji, em/en dashes, curly quotes, ...) — without this, free-text fields
          // like footerMessage (e.g. "...stopping by — see you tomorrow!") print as garbled bytes.
          const textContent = this.sanitizeForThermalPrint(this.formatReceiptText(data, paperWidth, options));
          // fontSize maps to real ESC/POS GS! scale commands (widthtimes/heigthtimes) —
          // 'small'/'medium' print at normal size (thermal printers have no smaller-than-default
          // scale), 'large' doubles it. Cut is handled manually below (after any logo/QR) instead
          // of via printText's own `cut` option, since that would fire immediately after the text
          // block and before the QR code gets a chance to print.
          const scale = options.fontSize === 'large' ? 1 : 0;
          const printOptions = { widthtimes: scale, heigthtimes: scale, cut: false };

          const logoBase64 = data.storeLogoUrl ? await this.uriToBase64(data.storeLogoUrl) : null;
          const paperSizeDots = paperWidth === '80mm' ? 80 : 58;
          // printPic's native `width` defaults to the FULL paper width in dots (384/576) whenever
          // it's omitted or 0 — that's why the logo was printing edge-to-edge, dominating the
          // receipt. Cap it to ~40% of paper width for a normal header-logo size instead.
          const paperWidthDots = paperWidth === '80mm' ? 576 : 384;
          const logoWidthDots = Math.round(paperWidthDots * 0.4);
          const upiString = data.upiId
            ? `upi://pay?pa=${encodeURIComponent(data.upiId)}&pn=${encodeURIComponent(data.storeName || 'Store')}&am=${data.grandTotal.toFixed(2)}&cu=INR`
            : null;

          for (let i = 0; i < copies; i++) {
            // printPic has no Promise parameter (fire-and-forget on the native side) and defaults
            // autoCut:true internally — must pass autoCut:false explicitly, or the printer cuts
            // the paper immediately after the logo, before the rest of the receipt prints.
            if (logoBase64 && typeof NativeEscposPrinter.printPic === 'function') {
              NativeEscposPrinter.printPic(logoBase64, { width: logoWidthDots, center: true, autoCut: false, paperSize: paperSizeDots });
            }

            await NativeEscposPrinter.printText(textContent, printOptions);

            // A scannable UPI payment QR, placed after the totals — matches where real receipts
            // (e.g. utility bills) place their payment QR.
            if (upiString && typeof NativeEscposPrinter.printQRCode === 'function') {
              try {
                if (typeof NativeEscposPrinter.printerAlign === 'function') {
                  await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.CENTER ?? 1);
                }
                await NativeEscposPrinter.printQRCode(upiString, 200, NativeEscposPrinter.ERROR_CORRECTION?.M ?? 0);
                if (typeof NativeEscposPrinter.printerAlign === 'function') {
                  await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
                }
              } catch (qrErr) {
                console.warn('UPI QR print failed (non-fatal):', qrErr);
              }
            }

            // Force extra physical paper feed (ESC J) beyond the text's own line breaks, so the
            // receipt tail clears the tear bar — line-feed height alone is unreliable across
            // printers. Then cut this copy if requested, so multi-copy prints (e.g. customer +
            // merchant) come out as separate torn receipts rather than one long strip.
            if (typeof NativeEscposPrinter.printAndFeed === 'function') {
              try {
                await NativeEscposPrinter.printAndFeed(60);
              } catch (feedErr) {
                console.warn('printAndFeed failed (non-fatal):', feedErr);
              }
            }
            if (options.autoCut && typeof NativeEscposPrinter.cutOnePoint === 'function') {
              await NativeEscposPrinter.cutOnePoint();
            }
          }
          return true;
        } catch (escErr: any) {
          console.error('ESC/POS direct print failed:', escErr);
          throw new Error(`Thermal printer error: ${escErr?.message || 'Could not print text'}`);
        }
      }

      // If running in web browser without native ESC/POS, use web print preview
      if (Platform.OS === 'web') {
        const html = this.generateReceiptHtml(data, paperWidth, options);
        for (let i = 0; i < copies; i++) {
          await Print.printAsync({ html });
        }
        return true;
      }

      throw new Error('Bluetooth thermal printer is not connected. Please connect your printer in Printers settings.');
    } catch (error: any) {
      console.error('Print error:', error);
      throw error;
    }
  }

  /**
   * Prints a Kitchen Order Ticket — same connect-and-print pipeline as printReceipt (native ESC/POS
   * with a system-print-dialog fallback), but always at double width/height (kitchen tickets need to
   * be readable at a glance, unlike a bill a cashier reads up close) and with no logo/QR/pricing.
   */
  public async printKotTicket(data: PrintKotData, paperWidth: '58mm' | '80mm' = '58mm', options: { autoCut?: boolean } = {}): Promise<boolean> {
    try {
      if (NativeEscposPrinter && typeof NativeEscposPrinter.printText === 'function') {
        try {
          const textContent = this.sanitizeForThermalPrint(this.formatKotText(data, paperWidth));
          const printOptions = { widthtimes: 1, heigthtimes: 1, cut: false };

          await NativeEscposPrinter.printText(textContent, printOptions);

          if (typeof NativeEscposPrinter.printAndFeed === 'function') {
            try {
              await NativeEscposPrinter.printAndFeed(60);
            } catch (feedErr) {
              console.warn('printAndFeed failed (non-fatal):', feedErr);
            }
          }
          if (options.autoCut && typeof NativeEscposPrinter.cutOnePoint === 'function') {
            await NativeEscposPrinter.cutOnePoint();
          }
          return true;
        } catch (escErr: any) {
          console.warn('ESC/POS KOT print failed or socket disconnected, falling back to System Printer dialog:', escErr);
        }
      }

      const html = this.generateKotHtml(data, paperWidth);
      await Print.printAsync({ html });
      return true;
    } catch (error) {
      console.error('KOT print error:', error);
      return false;
    }
  }

  /**
   * The native printText() call defaults to GBK encoding, which has no glyphs for emoji or "smart"
   * Unicode typography (em/en dashes, curly quotes, ellipsis) — any of those print as "??" or
   * garbled bytes on the physical receipt (e.g. a footerMessage like "...stopping by — see you
   * tomorrow!" came out as "...stopping by í¬ see..."). Store names, taglines, footer messages,
   * customer/product names are all free-text and can contain any of this, so normalize/strip right
   * before the text reaches the native call rather than trying to keep every upstream source clean.
   */
  private sanitizeForThermalPrint(text: string): string {
    return text
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/[^\x00-\x7E\n]/g, '');
  }

  /**
   * Converts a local (file://, content://) or remote (http/https) image URI to raw base64 —
   * printPic() needs base64 bytes, not a URI. Uses fetch()+FileReader rather than a dedicated
   * file-reading package, since that already works for both local and remote sources and avoids
   * pulling in expo-file-system as a new dependency for one call site.
   */
  private async uriToBase64(uri: string): Promise<string | null> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Strip the "data:image/...;base64," prefix — printPic wants raw base64 only.
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = () => reject(new Error('Failed to read logo image'));
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Failed to convert logo image to base64 for printing:', e);
      return null;
    }
  }

  /**
   * 1-Tap Sample Test Print for Receipts
   */
  public async printTestReceipt(paperWidth: '58mm' | '80mm' = '58mm', options: ReceiptPrintOptions = {}): Promise<boolean> {
    const template = this.resolveActiveTemplate(options);
    const sampleItems = template.sampleItems && template.sampleItems.length > 0
      ? template.sampleItems
      : [
          { productName: 'Sample Item One', quantity: 1, unitPrice: 250.0, total: 250.0 },
          { productName: 'Sample Item Two', quantity: 2, unitPrice: 120.0, total: 240.0 },
        ];

    const subtotal = sampleItems.reduce((s, it) => s + it.total, 0);
    const totalTax = template.showTaxBreakdown ? Math.round(subtotal * 0.18 * 100) / 100 : 0;
    const grandTotal = subtotal + totalTax;

    const sampleData: PrintSaleData = {
      storeName: 'SEZNIK POS STORE',
      storeAddress: '123 Market Road, City Center',
      storePhone: '9876543210',
      storeGstin: '07AAAAA0000A1Z5',
      invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      customerName: 'Walk-in Customer',
      items: sampleItems,
      subtotal,
      totalDiscount: 0,
      totalTax,
      grandTotal,
      paymentMethod: 'CASH (BLUETOOTH PRINTER)',
    };

    return this.printReceipt(sampleData, paperWidth, { ...options, template });
  }

  /**
   * 1-Tap Sample Test Print for Barcode Labels
   */
  public async printTestLabel(
    product?: { name: string; sellingPrice: number; barcode?: string },
    density?: number,
    // ean13 is the default here (not code128) because its width is exactly computable from the
    // fixed GS1 95-module spec — CODE128's is only estimated — and the sample barcode below is a
    // valid 13-digit EAN13 code, so the test print showcases the reliable path by default.
    format: 'qr' | 'code128' | 'ean13' = 'ean13',
    labelWidthMm: number = 50,
    labelHeightMm: number = 30,
    labelGapMm: number = 2
  ): Promise<boolean> {
    const item = product || {
      name: 'Organic Basmati Rice 5kg',
      sellingPrice: 480.0,
      barcode: '8901234567890',
    };

    try {
      if (NativeTscPrinter && typeof NativeTscPrinter.printLabel === 'function') {
        const fields = this.buildTsplLabelFields(item, format, labelWidthMm, labelHeightMm);
        await NativeTscPrinter.printLabel({
          width: fields.labelWidthMm,
          height: fields.labelHeightMm,
          gap: labelGapMm,
          direction: NativeTscPrinter.DIRECTION?.FORWARD ?? 0,
          reference: [0, 0],
          tear: NativeTscPrinter.TEAR?.ON ?? 'ON',
          sound: 0,
          density: density != null ? NativeTscPrinter.DENSITY?.[`DNESITY${Math.min(15, Math.max(0, Math.round(density)))}`] : undefined,
          text: fields.text,
          qrcode: fields.qrcode,
          barcode: fields.barcode,
        });
        return true;
      }

      const html = this.generateLabelHtml(item);
      await Print.printAsync({ html });
      return true;
    } catch (error) {
      console.error('Label Print error:', error);
      return false;
    }
  }

  /**
   * 1-Tap Sample Test Print for a barcode/QR label on the RECEIPT PAPER (continuous roll), via
   * printLabelOnReceiptPaper — the "Gap Mode: Continuous Roll" counterpart to printTestLabel above.
   */
  public async printTestLabelOnReceiptPaper(
    format: 'qr' | 'code128' | 'ean13' = 'qr',
    paperWidth: '58mm' | '80mm' = '58mm'
  ): Promise<boolean> {
    const sampleProduct = {
      name: 'Organic Basmati Rice 5kg',
      sellingPrice: 480.0,
      barcode: '8901234567890',
    };
    return this.printLabelOnReceiptPaper(sampleProduct, format, paperWidth);
  }
}

export const ThermalPrinterService = new ThermalPrinterServiceManager();
export default ThermalPrinterService;
