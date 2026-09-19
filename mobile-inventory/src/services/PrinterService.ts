import * as Print from 'expo-print';
import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid, EmitterSubscription } from 'react-native';
import { ReceiptTemplate, getTemplateById, isRestaurantLayout } from '../constants/receiptTemplates';
import { LabelTemplate, LabelTextElement, LabelBarcodeElement, LabelQrElement } from '../types/labelTemplate';
import { CustomReceiptTemplate } from '../types/customReceipt';
import { buildBillPdfUrl, buildUpiPayString, isValidUpiVpa } from '../utils/billQrService';
import { Product } from '../types/product';
import { flattenImageOntoWhite } from '../utils/imageBackgroundRemoval';
import { parseSequencePattern, formatSequenceValue, MAX_SEQUENCE_COUNT } from '../utils/labelSequence';
import { playPrinterConnectFeedback } from '../utils/printerConnectFeedback';
import JoshLabelPrinter, { isJoshPrinterSupported, JoshLabelElement, JoshLabelSpec } from '../../modules/josh-label-printer';
import YxLabelPrinter, { isYxPrinterSupported } from '../../modules/yx-label-printer';
import Td404LabelPrinter, { isTd404PrinterSupported } from '../../modules/td404-label-printer';
import { getStoredJoshPrinter, setStoredJoshPrinter, getStoredTejPrinter, setStoredTejPrinter } from './secureStore';
import { getLabelSizeConfig, TEJ_LABEL_SIZES, LabelSizeConfig } from '../constants/labelSizePresets';
import {
  enrichCustomReceiptEntries,
  isDiscountReceiptEntry,
  isTaxReceiptEntry,
  shouldShowItemDiscount,
} from '../utils/receiptDiscount';
import {
  RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
  RECEIPT_LOGO_STANDARD_WIDTH_PERCENT,
  formatItemGstRate,
  receiptLogoHtmlMaxPx,
  receiptLogoHtmlMaxPxFromChip,
  receiptQrBitmapDots,
  receiptQrHtmlPx,
  receiptStandardQrHtmlPx,
  receiptStandardQrHtmlPxFromChip,
  type ReceiptQrSize,
  type ReceiptSizeChip,
  wrapReceiptWords,
  wrapReceiptAligned,
} from '@shared/receiptPrintGeometry';
import {
  receiptFontCols,
  receiptFontCssFamily,
  receiptFontEscPosType,
  resolveReceiptFontId,
} from '@shared/receiptFonts';
import { ensureTemplateHasLogoBlock, resolveReceiptImageSrc } from '../utils/receiptLogo';
import { rasterizeReceiptLogoForPrint, clearLogoRasterCache } from '../utils/receiptLogoRaster';
import { isRestaurantBusiness } from '../constants/businessTypes';
import { useAuthStore } from '../store/useAuthStore';
import { resolveStoreProfile } from '../hooks/useStoreProfile';
import { getCachedSettings } from '../hooks/useSettings';
import { logPrinterConnection } from '../api/printerLog';

const NativeBluetoothManager = NativeModules.BluetoothManager;
const NativeEscposPrinter = NativeModules.BluetoothEscposPrinter;
const NativeTscPrinter = NativeModules.BluetoothTscPrinter;

/** DothanTech LPAPI 1D Barcode Types (IAtBitmap.BarcodeType1D) */
const JOSH_BARCODE_TYPE_AUTO = 60;
const JOSH_BARCODE_TYPE_CODE128 = 28;
const JOSH_BARCODE_TYPE_EAN13 = 22;
const JOSH_BARCODE_TYPE_UPC_A = 20;

// Native discovery on Android runs a full BluetoothAdapter.startDiscovery() cycle,
// which takes ~12s to fire ACTION_DISCOVERY_FINISHED. This is a safety ceiling only —
// the scan promise normally resolves on its own once discovery completes.
const SCAN_SAFETY_TIMEOUT_MS = 16000;

/**
 * Ceiling on a single native connect() attempt. The native promise is only ever settled from a
 * Bluetooth service state callback, so if that callback never arrives the promise hangs forever
 * and pins the UI at "Connecting…" with no way out.
 */
const CONNECT_ATTEMPT_TIMEOUT_MS = 6000;

/**
 * Backoff between connect attempts.
 */
const CONNECT_RETRY_DELAYS_MS = [500];

/**
 * Guard for native probes that can never settle — notably isDeviceConnected(), which resolves no
 * promise at all when the native BluetoothService happens to be null.
 */
const NATIVE_PROBE_TIMEOUT_MS = 3000;

/** ESC/POS dot feed after receipt/KOT body so the tail clears the tear bar with 3mm margin before auto-cut. */
const RECEIPT_BOTTOM_FEED = 144;

/** Default terms line shown under the footer on standard retail slips (preview + print). */
const RECEIPT_DEFAULT_TERMS = 'Goods once sold cannot be returned.';

export interface QuickThermalPrintOptions {
  paperWidth?: '58mm' | '80mm';
  copies?: number;
  storeLogoUrl?: string;
  upiId?: string;
  qrCode?: string;
  barcode?: string;
  autoCut?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  receiptFont?: string;
}

export interface PrintSaleData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  /** Business logo URL/URI (Settings.businessLogoURL) — printed as a real bitmap at the top of the receipt. */
  storeLogoUrl?: string;
  /** UPI VPA (Settings.upiId), e.g. "store@upi" — printed as a scannable payment QR code near the bottom. */
  upiId?: string;
  /** Saved receipt footer (`receiptConfig.footerMessage`) for `{{footer_message}}`. */
  footerMessage?: string;
  invoiceNumber: string;
  date: string;
  time?: string;
  customerName?: string;
  customerPhone?: string;
  items: { productName: string; quantity: number; unitPrice: number; total: number; unit?: string; gstRate?: number; discount?: number }[];
  subtotal: number;
  taxableAmt?: number;
  sgst?: number;
  cgst?: number;
  /** When set, overrides the receipt template's tax block (compact / tax invoice / slab-wise). */
  gstStyle?: 'compact' | 'tax_invoice' | 'slab_wise';
  gstSlabs?: { gstRate: number; cgstRate: number; sgstRate: number; taxableValue: number; cgstAmount: number; sgstAmount: number; totalGst: number }[];
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  /** Selected restaurant / bill charge lines applied at checkout */
  billCharges?: import('@/constants/restaurantBilling').AppliedBillCharge[];
  extraChargesTotal?: number;
  amountPaid?: number;
  changeReturned?: number;
  paymentMethod: string;
  /** Restaurant bill layout — table / waiter shown in the meta row */
  tableNo?: string;
  waiterName?: string;
  tokenNo?: string;
  /** Utility / Electricity / Service bill specific fields */
  consumerNo?: string;
  dueDate?: string;
  billingPeriod?: string;
  providerName?: string;
  unitsConsumed?: string;
  amountAfterDueDate?: number;
  orderType?: 'walk_in' | 'delivery';
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryNotes?: string;
  scheduledDeliveryDate?: string;
  deliveryStatus?: 'pending' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentStatus?: 'paid' | 'pending';
  paymentDueDate?: string;
}

export function numberToIndianWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const toWords = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + toWords(n % 100);
    if (n < 100000) return toWords(Math.floor(n / 1000)) + 'Thousand ' + toWords(n % 1000);
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + 'Lakh ' + toWords(n % 100000);
    return toWords(Math.floor(n / 10000000)) + 'Crore ' + toWords(n % 10000000);
  };

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = toWords(rupees).trim();
  if (paise > 0) result += ` and ${toWords(paise).trim()} Paise`;
  return 'Rupees ' + result + ' Only';
}

/**
 * Kitchen Order Ticket content — deliberately has NO prices/tax/totals anywhere in it. A KOT is
 * what the kitchen reads to cook, not a customer-facing bill, so it prints item names/quantities/
 * modifiers/notes as large, scannable text instead of the itemized-pricing layout PrintSaleData
 * uses for the final receipt.
 */
export interface PrintKotData {
  storeName?: string;
  orderNumber: number | string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableName?: string;
  partyLabel?: string;
  guestCount?: number;
  contactNumber?: string;
  priority?: 'normal' | 'urgent';
  notes?: string;
  time: string;
  waiterName?: string;
  stationName?: string;
  copyType?: string;
  reprintCount?: number;
  version?: number;
  items: {
    productName: string;
    quantity: number;
    notes?: string;
    modifiers?: string[];
    status?: string;
    voidReason?: string;
  }[];
}

/** Modification Delta ticket data (fired when an active KOT is edited) */
export interface PrintKotDeltaData {
  storeName?: string;
  orderNumber: number | string;
  tableName?: string;
  partyLabel?: string;
  time: string;
  version?: number;
  waiterName?: string;
  stationName?: string;
  changes: {
    type: 'new' | 'void' | 'qty_change';
    productName: string;
    quantity: number;
    oldQuantity?: number;
    notes?: string;
    reason?: string;
  }[];
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
  customTemplate?: CustomReceiptTemplate | null;
  includeBillQr?: boolean;
  /** Blank feed lines before print starts. */
  topMargin?: number;
  /** Feeds + cuts after printing, via the native printText `cut` option — no-op on printers without a cutter. */
  autoCut?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  /** Shared receipt font library — maps to ESC/POS fonttype + HTML/CSS family. */
  receiptFont?: import('@shared/receiptFonts').ReceiptFontId;
  /** Paper-saving compact layout (invoice + date on one line). */
  compactMode?: boolean;
  /** Number of times to print the same receipt (e.g. customer + merchant copy). */
  copies?: number;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeGstin?: string;
  storeLogoUrl?: string;
  upiId?: string;
  footerMessage?: string;
  customerName?: string;
  customerPhone?: string;
  /** When set, overrides ReceiptTemplate.showTaxBreakdown. */
  showTaxBreakdown?: boolean;
  /** GST breakdown style override ('compact' | 'tax_invoice' | 'slab_wise'). */
  gstStyle?: 'compact' | 'tax_invoice' | 'slab_wise';
  /** Print each line's GST % under the item name. */
  itemWiseGst?: boolean;
  /** When unset on the table block, restaurant/cafe bills number items; retail does not. */
  isRestaurant?: boolean;
  /** User-selected logo size chip (synced from ReceiptConfig.receiptLogoSize) */
  receiptLogoSize?: ReceiptSizeChip;
  /** User-selected QR size chip (synced from ReceiptConfig.receiptQrSize) */
  receiptQrSize?: ReceiptSizeChip;
}

function effectiveShowTaxBreakdown(
  template: ReceiptTemplate,
  options: ReceiptPrintOptions,
  data: PrintSaleData,
): boolean {
  if (options.showTaxBreakdown !== undefined) return options.showTaxBreakdown;
  if (data.gstStyle === 'compact') return false;
  if (data.gstStyle === 'tax_invoice' || data.gstStyle === 'slab_wise') return true;
  return template.showTaxBreakdown;
}

function effectiveShowItemGst(options: ReceiptPrintOptions, showBreakdown: boolean): boolean {
  if (options.itemWiseGst !== undefined) return options.itemWiseGst;
  return showBreakdown;
}

function resolvePrintIsRestaurant(options: ReceiptPrintOptions): boolean {
  if (options.isRestaurant !== undefined) return options.isRestaurant;
  return isRestaurantBusiness(useAuthStore.getState().user?.businessType);
}

function resolveShowItemNumbers(
  entry: { showItemNumbers?: boolean },
  isRestaurant?: boolean
): boolean {
  if (entry.showItemNumbers === true) return true;
  if (entry.showItemNumbers === false) return false;
  return isRestaurant === true;
}

function gstTotalsHtml(data: PrintSaleData): string {
  if (data.gstStyle === 'slab_wise' && data.gstSlabs && data.gstSlabs.length > 0) {
    return data.gstSlabs
      .map((slab) => {
        if (slab.gstRate === 0) {
          return `<tr><td>Nil / Exempt</td><td class="right">Rs.${slab.taxableValue.toFixed(2)}</td></tr>`;
        }
        return `<tr><td>Taxable @ ${slab.gstRate}%</td><td class="right">Rs.${slab.taxableValue.toFixed(2)}</td></tr>
            <tr><td>CGST ${slab.cgstRate}%</td><td class="right">Rs.${slab.cgstAmount.toFixed(2)}</td></tr>
            <tr><td>SGST ${slab.sgstRate}%</td><td class="right">Rs.${slab.sgstAmount.toFixed(2)}</td></tr>`;
      })
      .join('');
  }
  const taxable = data.taxableAmt !== undefined ? data.taxableAmt : data.subtotal;
  const halfTax = data.totalTax / 2;
  const sgstVal = data.sgst !== undefined ? data.sgst : halfTax;
  const cgstVal = data.cgst !== undefined ? data.cgst : halfTax;
  return `<tr><td>Taxable Amt</td><td class="right">Rs.${taxable.toFixed(2)}</td></tr>
            <tr><td>SGST</td><td class="right">Rs.${sgstVal.toFixed(2)}</td></tr>
            <tr><td>CGST</td><td class="right">Rs.${cgstVal.toFixed(2)}</td></tr>`;
}

function billChargesHtml(data: PrintSaleData): string {
  const charges = data.billCharges?.filter((c) => c.amount > 0) || [];
  return charges.map((charge) => `<tr><td>${charge.label}</td><td class="right">Rs.${charge.amount.toFixed(2)}</td></tr>`).join('');
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
  /** Avoid re-processing the same logo URI on every receipt print/preview. */
  private logoBase64Cache = new Map<string, string>();
  /**
   * Resolves once the startup stale-connection sweep has finished. connect() awaits it so a tap in
   * the first seconds of app life can't have its fresh socket torn down by the sweep's disconnect().
   */
  private startupCleanup: Promise<void>;
  /**
   * The in-flight scan, awaited before connecting. An active Android inquiry saturates the 2.4GHz
   * radio and is the single most common cause of RFCOMM connects failing or crawling.
   */
  private scanInFlight: Promise<unknown> | null = null;
  /** Dedupes overlapping connect() calls — a double-tap, or a screen reconnecting under the user. */
  private connectInFlight: Promise<boolean> | null = null;
  private connectInFlightId: string | null = null;
  /** True when the in-flight connect was started by auto-reconnect rather than the user. */
  private connectInFlightIsAuto = false;
  /**
   * Cooperative cancellation for the in-flight connect's retry loop. A single native
   * attempt can't be interrupted mid-handshake, but the loop checks this token between
   * attempts, so a cancelled auto-connect yields the radio within one attempt timeout
   * instead of grinding through every remaining retry.
   */
  private connectAbortToken: { aborted: boolean } | null = null;
  /**
   * Fired only for unexpected drops (printer switched off, out of range, battery dead) — never for a
   * user-initiated disconnect. That distinction is what keeps auto-reconnect from fighting the user.
   */
  private connectionLostListeners: (() => void)[] = [];
  /** The device we last connected to, kept after a drop so auto-reconnect knows what to reach for. */
  private lastConnectedDevice: BluetoothPrinterDevice | null = null;
  /** True while the user intentionally requested a disconnect, so EVENT_CONNECTION_LOST ignores it */
  private isUserDisconnecting = false;

  constructor() {
    this.activeDevice = null;
    this.connectionState = 'disconnected';
    this.attachNativeEventListeners();
    this.startupCleanup = this.disconnectStaleNativeConnection();
  }

  /** Clear the cached bitmap data for logos so updated logos from Web/Mobile are re-processed immediately. */
  public clearLogoCache(): void {
    this.logoBase64Cache.clear();
    clearLogoRasterCache();
  }

  /** Resolves the fallback instead of hanging when a native call never settles its promise. */
  private withProbeTimeout<T>(promise: Promise<T>, fallback: T, ms = NATIVE_PROBE_TIMEOUT_MS): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fully resets the printer to factory defaults before every print job using
   * the native module's own ESC/POS commands:
   *   - printerInit()       → sends ESC @ (resets character size, line spacing, alignment, etc.)
   *   - printerLeftSpace(0) → zeroes left margin (GS L) — prevents stale non-zero margins
   *   - printerAlign(LEFT)  → ensures left justification (ESC a)
   *   - setWidth(dots)      → tells the SDK the paper width so column calculations match
   *
   * Matches web ESC/POS init (ESC @, left margin, print width). We do not send printerLineSpace(0)
   * (ESC 2 / ESC 3): cheap firmware that ignores ESC prints the ASCII digits "2" / "3" as text.
   *
   * Without this sequence the printer carries over stale state (e.g. center alignment
   * from a QR code, or doubled character width from a KOT ticket) which makes subsequent
   * receipt text appear tilted/shifted.
   */
  private async initPrinter(paperWidth: '58mm' | '80mm' = '58mm'): Promise<void> {
    // Outside the try below on purpose: a dead socket must abort the job with an actionable message,
    // not be swallowed as a non-fatal reset failure and then fail again deeper in the ESC/POS calls.
    await this.ensureConnected();

    try {
      // 1. ESC @ — full hardware reset to default state
      if (typeof NativeEscposPrinter.printerInit === 'function') {
        await NativeEscposPrinter.printerInit();
      }
      // 2. Set the SDK's internal deviceWidth so printColumn's maxLen math is correct
      if (typeof NativeEscposPrinter.setWidth === 'function') {
        NativeEscposPrinter.setWidth(paperWidth === '80mm' ? 576 : 384);
      }
      // 3. Zero left margin — a previous job may have set a non-zero left space
      if (typeof NativeEscposPrinter.printerLeftSpace === 'function') {
        await NativeEscposPrinter.printerLeftSpace(0);
      }
      // 4. Force left alignment
      if (typeof NativeEscposPrinter.printerAlign === 'function') {
        await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
      }
    } catch (e) {
      // Non-fatal — the print will still proceed with whatever state the printer is in
      console.warn('initPrinter reset failed (non-fatal):', e);
    }
  }

  /**
   * Re-assert left margin + left justification after a centered bitmap/QR. Without this,
   * space-padded body lines are hardware-re-centered and appear shifted to the right.
   */
  private async restoreLeftPrintMode(): Promise<void> {
    try {
      if (typeof NativeEscposPrinter.printerLeftSpace === 'function') {
        await NativeEscposPrinter.printerLeftSpace(0);
      }
      if (typeof NativeEscposPrinter.printerAlign === 'function') {
        await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
      }
    } catch (e) {
      console.warn('restoreLeftPrintMode failed (non-fatal):', e);
    }
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
      const isConnected = await this.withProbeTimeout<boolean>(NativeBluetoothManager.isDeviceConnected(), false);
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
          if (this.isUserDisconnecting) {
            this.activeDevice = null;
            this.lastConnectedDevice = null;
            this.warningText = '';
            this.notifyStatusChange('disconnected');
            return;
          }
          // Keep lastConnectedDevice — it's the target auto-reconnect will retry.
          this.lastConnectedDevice = this.activeDevice || this.lastConnectedDevice;
          this.activeDevice = null;
          this.warningText = 'Printer connection was lost. Reconnecting…';
          this.notifyStatusChange('disconnected');
          this.connectionLostListeners.forEach((cb) => {
            try {
              cb();
            } catch (cbErr) {
              console.warn('Connection-lost listener threw:', cbErr);
            }
          });
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
    if (this.connectionState === 'connected' && this.activeDevice) return '';
    return this.warningText;
  }

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.push(callback);
    callback(this.connectionState);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Subscribe to *unexpected* connection drops only. A user-initiated disconnect() deliberately does
   * not fire this, so an auto-reconnect driven off it won't immediately undo the user's own action.
   */
  public onConnectionLost(callback: () => void): () => void {
    this.connectionLostListeners.push(callback);
    return () => {
      this.connectionLostListeners = this.connectionLostListeners.filter((cb) => cb !== callback);
    };
  }

  public getLastConnectedDevice(): BluetoothPrinterDevice | null {
    return this.activeDevice || this.lastConnectedDevice;
  }

  public notifyStatusChange(state: 'connected' | 'disconnected' | 'connecting' | 'scanning', force = false) {
    if (!force && this.connectionState === state) return;
    this.connectionState = state;
    if (state === 'connected') {
      this.warningText = '';
    }
    this.statusListeners.forEach((cb) => {
      try {
        cb(state);
      } catch (e) {
        console.error('Status listener error:', e);
      }
    });
  }

  /** Maps raw native Bluetooth module codes (e.g. NOT_STARTED) to actionable copy. */
  private humanizeBluetoothWarning(raw: string | undefined | null): string {
    const msg = String(raw || '').trim();
    if (!msg) return 'Bluetooth scan failed.';

    const upper = msg.toUpperCase();
    if (upper === 'NOT_STARTED' || upper.includes('NOT_STARTED')) {
      return 'Could not start Bluetooth scan. Turn on Bluetooth and Location (GPS), grant Nearby Devices permission, then tap Scan Again.';
    }
    if (upper === 'DISCOVER' || upper.includes('DISCOVER')) {
      return 'Bluetooth device search failed. Ensure Bluetooth and Location are on, then scan again.';
    }
    // Drop opaque ALL_CAPS native error tokens — they read like crashes to cashiers.
    if (/^[A-Z0-9_]+$/.test(msg) && msg.length <= 32) {
      return 'Bluetooth scan failed. Check that Bluetooth is on and try again.';
    }
    return msg;
  }

  private setScanWarning(raw: string | undefined | null, discoveredCount = 0): void {
    if (this.connectionState === 'connected' && this.activeDevice) {
      this.warningText = '';
      return;
    }
    // Events may have populated the list even when the native scan promise rejects.
    if (discoveredCount > 0) {
      this.warningText = '';
      return;
    }
    this.warningText = this.humanizeBluetoothWarning(raw || 'Bluetooth scan failed.');
  }

  /**
   * Requests the runtime Bluetooth permissions that actually apply to this Android version.
   *
   * On API 31+ that's BLUETOOTH_SCAN/BLUETOOTH_CONNECT. On API 23–30 those constants don't exist and
   * discovery instead depends on ACCESS_FINE_LOCATION — without it `ACTION_FOUND` never fires and a
   * scan silently returns zero unpaired printers, which is what previously made scanning look broken
   * on the Android 9/10 handhelds these printers are usually paired with.
   */
  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      if (Number(Platform.Version) >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED
        );
      }

      const locationGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return locationGranted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Android Bluetooth permissions error:', err);
      return false;
    }
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

      // Published so connect() can wait this out — see connect()'s comment on radio contention.
      // Swallow rejections here so the shared handle never surfaces as an unhandled rejection;
      // the real error is still handled by the await below.
      this.scanInFlight = scanPromise.catch(() => undefined);

      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, SCAN_SAFETY_TIMEOUT_MS));
      await Promise.race([scanPromise, timeoutPromise]);

      this.warningText = '';
      return Array.from(deviceMap.values());
    } catch (err: any) {
      console.warn('Native Bluetooth scan error:', err);
      this.setScanWarning(err?.message, deviceMap.size);
      return Array.from(deviceMap.values());
    } finally {
      this.onDeviceDiscovered = null;
      this.scanInFlight = null;
      // A connect() started while this scan was running owns the status now — forcing the state
      // here would wipe out its 'connecting' (or freshly 'connected') state. Still re-notify in
      // that case so subscribers pick up the updated warningText.
      if (this.connectInFlight) {
        this.statusListeners.forEach((cb) => cb(this.connectionState));
      } else {
        this.notifyStatusChange(this.activeDevice ? 'connected' : 'disconnected');
      }
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

  /**
   * Connects to a printer, deduping overlapping calls. Rejects with a human-readable message on
   * failure — callers are expected to surface that, since a silently swallowed failure leaves the
   * rest of the app believing a printer is ready.
   */
  public async connect(deviceId: string, deviceName?: string, opts?: { auto?: boolean }): Promise<boolean> {
    const isAuto = !!opts?.auto;

    // Already connected to this exact printer — nothing to do.
    if (this.connectionState === 'connected' && this.activeDevice?.id === deviceId) {
      return true;
    }

    // A double-tap (or a screen reconnecting under the user) must not open two sockets. Join the
    // existing attempt when it targets the same device. When it targets ANOTHER device, who wins
    // depends on who is asking: a user's tap preempts a background auto-reconnect (this used to
    // throw "Another printer connection is already in progress", locking the user out for the
    // 60s+ the boot-time default-printer connect could take), while an auto attempt never
    // preempts anything — it just bows out.
    if (this.connectInFlight) {
      if (this.connectInFlightId === deviceId) return this.connectInFlight;

      if (isAuto) {
        throw new Error('Skipped automatic reconnect: another printer connection is in progress.');
      }

      if (this.connectInFlightIsAuto) {
        this.cancelAutoConnect();
        // Two concurrent RFCOMM handshakes reliably fail both, so wait for the
        // cancelled attempt to settle (bounded by its own per-attempt timeout)
        // before opening the user's connection.
        await this.connectInFlight.catch(() => {});
      } else {
        throw new Error('Another printer connection is already in progress. Please wait for it to finish.');
      }
    }

    const abortToken = { aborted: false };
    this.connectAbortToken = abortToken;
    this.connectInFlightId = deviceId;
    this.connectInFlightIsAuto = isAuto;
    this.connectInFlight = this.performConnect(deviceId, deviceName, abortToken).finally(() => {
      this.connectInFlight = null;
      this.connectInFlightId = null;
      this.connectInFlightIsAuto = false;
      if (this.connectAbortToken === abortToken) this.connectAbortToken = null;
    });

    return this.connectInFlight;
  }

  /**
   * Aborts an in-flight AUTOMATIC connect (no-op for a user-initiated one). Called when
   * the user starts a scan or taps a printer themselves — their action owns the radio.
   */
  public cancelAutoConnect(): void {
    if (this.connectInFlight && this.connectInFlightIsAuto && this.connectAbortToken) {
      this.connectAbortToken.aborted = true;
    }
  }

  private async performConnect(deviceId: string, deviceName?: string, abortToken?: { aborted: boolean }): Promise<boolean> {
    const throwIfAborted = () => {
      if (abortToken?.aborted) {
        // Deliberately does NOT notifyStatusChange: the manual connect that caused the
        // cancellation immediately asserts its own 'connecting' state, and flashing
        // 'disconnected' in between makes the status pill flicker.
        const err = new Error('Connection attempt cancelled.');
        err.name = 'ConnectCancelled';
        throw err;
      }
    };

    this.notifyStatusChange('connecting');

    if (this.isNativeModuleAvailable()) {
      // The startup sweep force-closes any socket left open by a previous JS session. Connecting
      // before it finishes means it can tear down the socket we're about to open.
      await this.startupCleanup.catch(() => {});

      // An Android inquiry hogs the radio, so a connect attempted mid-scan is slow and often fails
      // outright. Waiting for the scan to settle is far cheaper than the retries it would cost.
      if (this.scanInFlight) {
        await Promise.race([this.scanInFlight, this.delay(SCAN_SAFETY_TIMEOUT_MS)]);
      }

      let lastError: any = null;
      const totalAttempts = CONNECT_RETRY_DELAYS_MS.length + 1;

      for (let attempt = 0; attempt < totalAttempts; attempt++) {
        throwIfAborted();

        if (attempt > 0) {
          await this.delay(CONNECT_RETRY_DELAYS_MS[attempt - 1]);
          throwIfAborted();
          // Re-assert 'connecting' — an EVENT_UNABLE_CONNECT from the failed attempt may have
          // flipped listeners to 'disconnected' while we're still actively retrying.
          this.notifyStatusChange('connecting');
        }

        try {
          const connectedName = await this.connectWithTimeout(deviceId);
          this.activeDevice = {
            id: deviceId,
            name: deviceName || connectedName || `Bluetooth Printer (${deviceId.slice(-6)})`,
            macAddress: deviceId,
            type: 'receipt',
            connected: true,
          };
          this.lastConnectedDevice = this.activeDevice;
          this.warningText = '';
          this.notifyStatusChange('connected');
          return true;
        } catch (err: any) {
          lastError = err;
          console.warn(`Bluetooth connect attempt ${attempt + 1}/${totalAttempts} failed:`, err?.message || err);
        }
      }

      this.activeDevice = null;
      this.warningText = 'Unable to reach the printer. Check that it is switched on and in range.';
      this.notifyStatusChange('disconnected');
      throw new Error(
        `Failed to connect to ${deviceName || deviceId} after ${totalAttempts} attempts: ${lastError?.message || 'Printer unreachable'}`
      );
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
    this.lastConnectedDevice = this.activeDevice;
    this.warningText = '';
    this.notifyStatusChange('connected');
    return true;
  }

  /**
   * One native connect attempt, bounded. The native side only settles this promise from a Bluetooth
   * service state callback, so without the ceiling a callback that never arrives hangs the attempt
   * (and the UI) forever.
   */
  private connectWithTimeout(deviceId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Connection timed out'));
      }, CONNECT_ATTEMPT_TIMEOUT_MS);

      NativeBluetoothManager.connect(deviceId)
        .then((name: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(name);
        })
        .catch((err: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err?.message || err || 'Printer unreachable')));
        });
    });
  }

  /**
   * True when the native side still holds an open socket. Deliberately conservative: on anything
   * unexpected it reports connected so a probe failure can't block an otherwise working print.
   */
  public async isSocketConnected(): Promise<boolean> {
    if (!this.isNativeModuleAvailable() || typeof NativeBluetoothManager.isDeviceConnected !== 'function') {
      return this.connectionState === 'connected';
    }
    try {
      return await this.withProbeTimeout<boolean>(NativeBluetoothManager.isDeviceConnected(), true);
    } catch {
      return true;
    }
  }

  /**
   * Verifies the socket is really open right before a print job and silently reconnects if it isn't.
   *
   * Checking that the native module exists (which is all the print methods used to do) only proves
   * the build has Bluetooth compiled in — not that a printer is on the other end. Without this a
   * printer switched off mid-shift produces a raw native error instead of simply reconnecting.
   */
  public async ensureConnected(): Promise<void> {
    if (!this.isNativeModuleAvailable() || Platform.OS === 'web') return;

    if (await this.isSocketConnected()) return;

    // Read the target before clearing state below, since that clears activeDevice.
    const target = this.getLastConnectedDevice();

    // The socket is gone even though our own state may still say 'connected' — a drop while the app
    // was backgrounded doesn't reliably deliver EVENT_CONNECTION_LOST. Reset first, otherwise
    // connect() sees 'connected' and short-circuits straight back into the same dead socket.
    if (this.connectionState === 'connected') {
      this.activeDevice = null;
      this.notifyStatusChange('disconnected');
    }

    if (!target) {
      throw new Error('Bluetooth thermal printer is not connected. Please connect your printer in Printers settings.');
    }

    // A dedicated LPAPI label printer must not be connected via the ESC/POS socket if already handled by Josh
    const isDedicatedJosh = /^(LD|LP|JOSH)/i.test(target.name || '') && this.isJoshSupported();
    if (isDedicatedJosh && (await this.joshIsConnected())) {
      return;
    }

    try {
      await this.connect(target.id, target.name);
    } catch {
      throw new Error(
        `Lost connection to ${target.name || 'the printer'}. Check that it is switched on and in range, then try again.`
      );
    }
  }

  public async disconnect(): Promise<void> {
    this.isUserDisconnecting = true;
    this.cancelAutoConnect();
    const address = this.activeDevice?.macAddress || this.activeDevice?.id;
    try {
      if (this.isNativeModuleAvailable() && typeof NativeBluetoothManager.disconnect === 'function' && address) {
        try {
          await NativeBluetoothManager.disconnect(address);
        } catch (e) {
          console.warn('Native Bluetooth disconnect error:', e);
        }
      }
    } finally {
      this.activeDevice = null;
      // Deliberately forget the reconnect target: disconnecting is an explicit user action, and
      // auto-reconnect pulling the printer straight back would make the button look broken.
      this.lastConnectedDevice = null;
      // Not a warning — this is the expected outcome of the user tapping Disconnect, and putting text
      // here renders it as a red error banner in the connect modal.
      this.warningText = '';
      this.notifyStatusChange('disconnected');
      setTimeout(() => {
        this.isUserDisconnecting = false;
      }, 2500);
    }
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

  public resolveActiveCustomTemplate(options?: ReceiptPrintOptions): CustomReceiptTemplate | null {
    if (options && options.customTemplate !== undefined) return options.customTemplate;
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      const state = usePrinterStore.getState();
      const activeCustomId = state.activeCustomTemplateId;
      if (!activeCustomId) return null;
      return state.customTemplates?.find((t: any) => t.id === activeCustomId) || null;
    } catch {
      return null;
    }
  }

  private upiPayPayload(data: PrintSaleData, upiOverride?: string): string | null {
    const upi = (upiOverride || data.upiId || '').trim();
    if (!isValidUpiVpa(upi)) return null;
    return buildUpiPayString(upi, data.storeName || 'Store', data.grandTotal, data.invoiceNumber);
  }

  private upiQrHtml(data: PrintSaleData, paperWidth: '58mm' | '80mm' = '58mm', qrSizeChip?: ReceiptSizeChip): string {
    const payload = this.upiPayPayload(data);
    if (!payload) return '';
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&data=${encodeURIComponent(payload)}`;
    const qrDim = receiptStandardQrHtmlPxFromChip(qrSizeChip);
    return `<div class="center" style="margin-top:8px;">
      <div class="bold" style="font-size:11px;margin-bottom:4px;">SCAN TO PAY VIA UPI</div>
      <img src="${url}" alt="UPI payment QR" style="width:${qrDim}px;height:${qrDim}px;object-fit:contain;display:inline-block;background:#fff;padding:4px;border:1px solid #e2e8f0;border-radius:6px;margin:0 auto;" />
    </div>`;
  }

  public interpolateReceiptVariables(text: string, data: PrintSaleData): string {
    if (!text) return '';
    // Match web: normalize any "scan … pay" caption to the fixed UPI header (no ₹ amount).
    if (/scan/i.test(text) && /pay/i.test(text)) {
      return 'SCAN TO PAY VIA UPI';
    }
    const rawDate = (data.date || '').trim();
    let dateStr = rawDate;
    let timeStr = (data.time || '').trim();

    // If date contains both date and time (e.g. "10/09/2026, 05:05 PM", "10/09/2026 17:05", "2026-09-10 17:05:00")
    // extract them so {{date}} and {{time}} never duplicate the time component.
    const dtMatch = rawDate.match(/^(\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4})[,\sT]+(.+)$/);
    if (dtMatch) {
      dateStr = dtMatch[1];
      if (!timeStr) {
        timeStr = dtMatch[2];
      }
    }
    if (!dateStr) {
      dateStr = new Date().toLocaleDateString('en-GB');
    }
    if (!timeStr) {
      timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const billPdfUrl = buildBillPdfUrl(data);
    const upiStr = this.upiPayPayload(data) || '';

    const phoneVal = (data.storePhone || '').trim();
    const gstinVal = (data.storeGstin || '').trim();
    const rawCustName = (data.customerName || 'Walk-in Customer').trim();
    const isWalkIn = !data.customerName || /walk[- ]*in/i.test(data.customerName);
    const custNameVal = isWalkIn ? 'Walk-in Customer' : rawCustName;
    const custLabelVal = isWalkIn ? 'Walk-in' : rawCustName;
    const custPhoneVal = (data.customerPhone || '').trim();
    const tableVal = (data.tableNo || '').trim();
    const waiterVal = (data.waiterName || '').trim();
    const tokenVal = (data.tokenNo || '').trim();
    const storeNameVal = (data.storeName || '').trim();
    const storeAddrVal = (data.storeAddress || '').trim();
    const footerVal = (data.footerMessage || '').trim();
    const orderTypeVal = data.orderType === 'delivery' ? 'DELIVERY' : 'WALK-IN';
    const deliveryAddrVal = (data.deliveryAddress || '').trim();
    const deliveryPhoneVal = (data.deliveryPhone || '').trim();
    const deliveryNotesVal = (data.deliveryNotes || '').trim();
    const deliveryDateVal = data.scheduledDeliveryDate
      ? new Date(data.scheduledDeliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      : '';
    const paymentStatusVal = data.paymentStatus === 'pending' ? 'PENDING' : 'PAID';

    const replaced = text
      .replace(/(?:Phone|Ph|Tel)?:\s*\{\{store_phone\}\}/gi, phoneVal ? `Phone: ${phoneVal}` : '')
      .replace(/GST(?:IN)?:\s*\{\{store_gstin\}\}/gi, gstinVal ? `GSTIN: ${gstinVal}` : '')
      .replace(/(?:Customer|Cust)?:\s*\{\{customer_name\}\}/gi, `Customer: ${custLabelVal}`)
      .replace(/(?:Phone|Ph|Tel)?:\s*\{\{customer_phone\}\}/gi, custPhoneVal ? `Phone: ${custPhoneVal}` : '')
      .replace(/(?:Invoice|Bill|Inv)?:\s*\{\{invoice_no\}\}/gi, data.invoiceNumber ? `Inv: ${data.invoiceNumber}` : '')
      .replace(/(?:Table|Tbl)?:\s*\{\{table_no\}\}/gi, tableVal ? `Table: ${tableVal}` : '')
      .replace(/(?:Waiter)?:\s*\{\{waiter_name\}\}/gi, waiterVal ? `Waiter: ${waiterVal}` : '')
      .replace(/(?:Token)?:\s*\{\{token_no\}\}/gi, tokenVal ? `Token: ${tokenVal}` : '')
      .replace(/\{\{store_name\}\}/gi, storeNameVal)
      .replace(/\{\{store_address\}\}/gi, storeAddrVal)
      .replace(/\{\{store_phone\}\}/gi, phoneVal)
      .replace(/\{\{store_gstin\}\}/gi, gstinVal)
      .replace(/\{\{invoice_no\}\}/gi, data.invoiceNumber || 'INV-0000')
      .replace(/\{\{date\}\}/gi, dateStr)
      .replace(/\{\{time\}\}/gi, timeStr)
      .replace(/\{\{customer_name\}\}/gi, custNameVal)
      .replace(/\{\{customer_phone\}\}/gi, custPhoneVal)
      .replace(/\{\{order_type\}\}/gi, orderTypeVal)
      .replace(/\{\{delivery_address\}\}/gi, deliveryAddrVal)
      .replace(/\{\{delivery_phone\}\}/gi, deliveryPhoneVal)
      .replace(/\{\{delivery_notes\}\}/gi, deliveryNotesVal)
      .replace(/\{\{scheduled_delivery_date\}\}/gi, deliveryDateVal)
      .replace(/\{\{payment_status\}\}/gi, paymentStatusVal)
      .replace(/\{\{subtotal\}\}/gi, `₹${data.subtotal.toFixed(2)}`)
      .replace(/\{\{discount\}\}/gi, `₹${data.totalDiscount.toFixed(2)}`)
      .replace(/\{\{total_tax\}\}/gi, `₹${data.totalTax.toFixed(2)}`)
      .replace(/\{\{tax\}\}/gi, `₹${data.totalTax.toFixed(2)}`)
      .replace(/\{\{grand_total\}\}/gi, `₹${data.grandTotal.toFixed(2)}`)
      .replace(/\{\{paid_amount\}\}/gi, `₹${(data.amountPaid !== undefined ? data.amountPaid : data.grandTotal).toFixed(2)}`)
      .replace(/\{\{change_returned\}\}/gi, `₹${(data.changeReturned !== undefined ? data.changeReturned : 0).toFixed(2)}`)
      .replace(/\{\{payment_method\}\}/gi, data.paymentMethod || 'CASH')
      .replace(/\{\{upi_qr\}\}/gi, upiStr)
      .replace(/\{\{bill_pdf_url\}\}/gi, billPdfUrl)
      .replace(/\{\{footer_message\}\}/gi, footerVal)
      .replace(/\{\{token_no\}\}/gi, tokenVal)
      .replace(/\{\{table_no\}\}/gi, tableVal)
      .replace(/\{\{waiter_name\}\}/gi, waiterVal);

    return replaced
      .split('\n')
      .filter((line, idx, arr) => {
        if (!line.trim() && (idx === 0 || idx === arr.length - 1 || !arr[idx - 1]?.trim())) return false;
        return true;
      })
      .join('\n');
  }

  public formatCustomReceiptText(
    data: PrintSaleData,
    customTemplate: CustomReceiptTemplate,
    paperWidth: '58mm' | '80mm' = '58mm',
    options: ReceiptPrintOptions = {}
  ): string {
    const width = paperWidth === '58mm' ? 32 : 48;
    const lines: string[] = [];
    const showBreakdown =
      options.showTaxBreakdown !== undefined
        ? options.showTaxBreakdown
        : data.gstStyle === 'tax_invoice' || data.gstStyle === 'slab_wise';
    const showItemGst = effectiveShowItemGst(options, showBreakdown);
    const isRestaurant = resolvePrintIsRestaurant(options);

    // Top margin
    for (let i = 0; i < (options.topMargin || 0); i++) lines.push('');

    const padTwoColLines = (left: string, right: string): string[] => {
      const leftStr = String(left ?? '').trim();
      const rightStr = String(right ?? '').trim();
      if (!leftStr && !rightStr) return [];
      if (!leftStr) return [rightStr.padStart(width, ' ')];
      if (!rightStr) return wrapReceiptWords(leftStr, width);
      if (leftStr.length + rightStr.length + 1 <= width) {
        return [leftStr + ' '.repeat(width - leftStr.length - rightStr.length) + rightStr];
      }
      const leftLines = wrapReceiptWords(leftStr, width);
      return [...leftLines, rightStr.padStart(width, ' ')];
    };

    const padLine = (left: string, right: string) => {
      const res = padTwoColLines(left, right);
      return res[0] || '';
    };

    const alignText = (str: string, align: 'left' | 'center' | 'right' = 'left'): string[] => {
      return wrapReceiptAligned(str, width, align).filter((l) => l.trim().length > 0);
    };

    const receiptEntries = enrichCustomReceiptEntries(
      customTemplate.entries.filter((entry) => entry.enabled),
      data.totalDiscount || 0
    );

    receiptEntries.forEach((entry) => {
      switch (entry.type) {
        case 'text':
        case 'text_special': {
          const rawText = this.interpolateReceiptVariables(entry.text, data);
          alignText(rawText, entry.align || 'left').forEach((l) => lines.push(l));
          break;
        }

        case 'horizontal_line': {
          const char =
            entry.lineStyle === 'double' ? '=' : entry.lineStyle === 'dotted' ? '.' : '-';
          lines.push(char.repeat(width));
          break;
        }

        case 'left_right_text': {
          if (isDiscountReceiptEntry(entry) && (!data.totalDiscount || data.totalDiscount <= 0)) {
            break;
          }
          if (isTaxReceiptEntry(entry) && (!data.totalTax || data.totalTax <= 0)) {
            break;
          }
          let left = this.interpolateReceiptVariables(entry.left, data);
          let right = this.interpolateReceiptVariables(entry.right, data);
          if (/scan/i.test(String(entry.left || '') + String(entry.right || ''))) {
            left = 'SCAN TO PAY VIA UPI';
            right = '';
          }
          if (left || right) {
            padTwoColLines(left, right).forEach((l) => lines.push(l));
          }
          break;
        }

        case 'table': {
          const itemCol = entry.columnHeaders?.item || 'Item';
          const totalCol = entry.columnHeaders?.total || 'Total';
          lines.push(padLine(itemCol, totalCol));
          lines.push('-'.repeat(width));

          data.items.forEach((item, idx) => {
            const namePrefix = resolveShowItemNumbers(entry, isRestaurant) ? `${idx + 1}. ` : '';
            const rawName = String(item.productName || 'Item');
            const fullName = namePrefix + rawName;
            wrapReceiptWords(fullName, width).forEach((l) => lines.push(l));

            if ((showItemGst || entry.showTaxColumn) && item.gstRate) {
              const gstLabel = formatItemGstRate(item.gstRate);
              if (gstLabel) lines.push(`   ${gstLabel} GST`);
            }

            lines.push(
              padLine(
                `   ${item.quantity} ${item.unit || 'Pc'} x ${item.unitPrice.toFixed(2)}`,
                item.total.toFixed(2)
              )
            );

            if (shouldShowItemDiscount(item.discount)) {
              lines.push(`   Disc: -Rs.${item.discount!.toFixed(2)}`);
            }
          });
          break;
        }

        case 'multi_format': {
          const joined = entry.segments
            .map((seg) => this.interpolateReceiptVariables(seg.text, data))
            .filter(Boolean)
            .join(' ');
          alignText(joined, entry.align || 'left').forEach((l) => lines.push(l));
          break;
        }

        case 'barcode': {
          const val = this.interpolateReceiptVariables(entry.value, data);
          const isQr =
            entry.format === 'qr' ||
            entry.codeType === 'qr_code' ||
            entry.qrType === 'upi' ||
            entry.qrType === 'digital_bill' ||
            entry.qrType === 'custom' ||
            Boolean(entry.upiId) ||
            val.startsWith('http') ||
            val.startsWith('upi://');
          // In plain text compilation, do not print long link strings or raw text URLs for QR codes
          if (!isQr && (entry.format === 'code128' || entry.format === 'ean13' || entry.codeType === 'barcode_1d')) {
            alignText(`* ${val} *`, entry.align || 'center').forEach((l) => lines.push(l));
          }
          break;
        }

        case 'files_note': {
          if (entry.title) alignText(entry.title, entry.align || 'left').forEach((l) => lines.push(l));
          const text = this.interpolateReceiptVariables(entry.content, data);
          alignText(text, entry.align || 'left').forEach((l) => lines.push(l));
          break;
        }

        case 'image': {
          // Native print will handle image printing via printPic; for text feed keep spacing
          lines.push('');
          break;
        }
      }
    });

    lines.push('');
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Restaurant thermal layouts sized for 32-col / 48mm printable heads.
   * Compact and GST variants keep item names on a single qty/amt row.
   */
  private formatRestaurantBillText(
    data: PrintSaleData,
    paperWidth: '58mm' | '80mm',
    template: ReceiptTemplate,
    options: ReceiptPrintOptions = {},
  ): string {
    const layout = template.layout || 'restaurant_bill';
    const width = paperWidth === '58mm' ? 32 : 48;
    const divider = '-'.repeat(width);
    const doubleDivider = '='.repeat(width);
    const detailIndent = paperWidth === '58mm' ? 4 : 10;
    const compact = layout === 'restaurant_compact' || layout === 'restaurant_gst' || layout === 'restaurant_roomservice';
    const takeaway = layout === 'restaurant_takeaway';
    const gstInvoice = layout === 'restaurant_gst';
    const roomService = layout === 'restaurant_roomservice';
    const seatLabel = roomService ? 'Room' : 'TNo';

    const center = (str: string) => {
      const trimmed = String(str ?? '').trim();
      if (!trimmed) return;
      if (trimmed.length >= width) return trimmed.slice(0, width);
      const padLeft = Math.floor((width - trimmed.length) / 2);
      return ' '.repeat(padLeft) + trimmed;
    };

    const padRight = (str: string, len: number) => {
      const s = String(str ?? '');
      if (s.length >= len) return s.slice(0, len);
      return s + ' '.repeat(len - s.length);
    };

    const padLeft = (str: string, len: number) => {
      const s = String(str ?? '');
      if (s.length >= len) return s.slice(s.length - len);
      return ' '.repeat(len - s.length) + s;
    };

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

    const formatQty = (qty: number) => {
      const rounded = Math.round(qty * 1000) / 1000;
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3);
    };

    const wrapName = (name: string): string[] => {
      const upper = String(name || 'Item').toUpperCase();
      if (upper.length <= width) return [upper];
      const lines: string[] = [];
      let remaining = upper;
      while (remaining.length > width) {
        let breakAt = remaining.lastIndexOf(' ', width);
        if (breakAt <= 0) breakAt = width;
        lines.push(remaining.slice(0, breakAt).trim());
        remaining = remaining.slice(breakAt).trim();
      }
      if (remaining) lines.push(remaining);
      return lines.length ? lines : ['ITEM'];
    };

    const compactItemLine = (name: string, qty: string, amount: string) => {
      const amt = padLeft(amount, 8);
      const qtyCol = padLeft(qty, 4);
      const nameWidth = Math.max(8, width - amt.length - qtyCol.length - 2);
      return `${padRight(name.toUpperCase(), nameWidth)} ${qtyCol} ${amt}`.slice(0, width);
    };

    const lines: string[] = [];
    for (let i = 0; i < (options.topMargin || 0); i++) lines.push('');

    const storeName = (data.storeName || 'YOUR RESTAURANT').toUpperCase();
    lines.push(center(storeName) || storeName.slice(0, width));

    const addressLines = String(data.storeAddress || '')
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    addressLines.forEach((line) => lines.push(center(line.toUpperCase()) || line.slice(0, width)));

    if (data.storePhone) lines.push(center(`PH: ${data.storePhone}`) || `PH: ${data.storePhone}`.slice(0, width));
    const tin = data.storeGstin || '';
    if (tin) {
      const tinLabel = gstInvoice ? `GSTIN: ${tin}` : `TIN: ${tin}`;
      lines.push(center(tinLabel) || tinLabel.slice(0, width));
    }
    lines.push(center(template.tagline || 'CASH/BILL') || 'CASH/BILL');

    lines.push(divider);

    const dateParts = String(data.date || '').split(/[\s,]+/);
    const billDate = dateParts[0] || new Date().toLocaleDateString('en-GB');
    const billTime =
      dateParts.length > 1
        ? dateParts.slice(1).join(' ').slice(0, 5)
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    if (takeaway) {
      lines.push(padLine(`${template.billLabel}: ${data.invoiceNumber}`, billDate));
      lines.push(padLine((data.customerName || 'WALK-IN').toUpperCase(), billTime));
      if (data.customerPhone) lines.push(`PH: ${data.customerPhone}`.slice(0, width));
    } else if (compact) {
      const waiter = (data.waiterName || (roomService ? 'STEWARD' : 'WAITER')).toUpperCase();
      lines.push(padLine(`${template.billLabel}: ${data.invoiceNumber}`, billDate));
      lines.push(
        padLine(
          `${seatLabel} ${(data.tableNo || '—').toUpperCase()} ${waiter}`.slice(0, 22),
          billTime,
        ),
      );
    } else if (paperWidth === '80mm') {
      const metaHeader =
        padRight('Bill No', 8) +
        padRight('Waiter', 8) +
        padRight('TNo', 5) +
        padRight('Date', 11) +
        padRight('Time', 5);
      const metaValues =
        padRight(data.invoiceNumber || '—', 8) +
        padRight((data.waiterName || 'WAITER').toUpperCase().slice(0, 8), 8) +
        padRight((data.tableNo || '—').toUpperCase().slice(0, 5), 5) +
        padRight(billDate.slice(0, 11), 11) +
        padRight(billTime.slice(0, 5), 5);
      lines.push(metaHeader.slice(0, width));
      lines.push(metaValues.slice(0, width));
    } else {
      lines.push(padLine(`Bill: ${data.invoiceNumber}`, billDate));
      lines.push(padLine(`Waiter: ${(data.waiterName || 'WAITER').toUpperCase()}`, `TNo: ${data.tableNo || '—'}`));
      lines.push(center(`Time: ${billTime}`) || `Time: ${billTime}`.slice(0, width));
    }

    lines.push(divider);
    if (compact) {
      lines.push(compactItemLine('ITEM', 'QTY', 'AMT'));
    } else {
      lines.push(padLine('Item', 'Total'));
    }
    lines.push(divider);

    data.items.forEach((item) => {
      if (compact) {
        lines.push(compactItemLine(item.productName || 'ITEM', formatQty(item.quantity), item.total.toFixed(2)));
      } else {
        wrapName(item.productName).forEach((nameLine) => lines.push(nameLine.slice(0, width)));
        const detail = `${formatQty(item.quantity)} x ${item.unitPrice.toFixed(2)}`;
        lines.push(padLine(' '.repeat(detailIndent) + detail, item.total.toFixed(2)));
      }
    });

    lines.push(divider);

    const totalQty = data.items.reduce((sum, it) => sum + it.quantity, 0);
    const grossTotal = data.subtotal;
    const billCharges = data.billCharges || [];
    const extraChargesTotal = data.extraChargesTotal ?? billCharges.reduce((s, c) => s + c.amount, 0);
    const halfTax = Math.round((data.totalTax / 2) * 100) / 100;

    if (gstInvoice) {
      lines.push(padLine('Taxable', grossTotal.toFixed(2)));
      if (data.totalTax > 0) {
        lines.push(padLine('CGST 2.5%', halfTax.toFixed(2)));
        lines.push(padLine('SGST 2.5%', (data.totalTax - halfTax).toFixed(2)));
      }
    } else if (compact || takeaway) {
      lines.push(padLine(`Qty ${formatQty(totalQty)}`, grossTotal.toFixed(2)));
      if (data.totalTax > 0 && template.showTaxBreakdown) lines.push(padLine('GST 5%', data.totalTax.toFixed(2)));
      billCharges.forEach((charge) => {
        if (charge.amount > 0) lines.push(padLine(charge.label, charge.amount.toFixed(2)));
      });
    } else {
      lines.push(padLine('Total Qty', formatQty(totalQty)));
      lines.push(padLine('Gross Total', grossTotal.toFixed(2)));

      if (data.gstSlabs && data.gstSlabs.length > 0) {
        data.gstSlabs.forEach((slab) => {
          if (slab.gstRate > 0) {
            lines.push(padLine(`VAT ${slab.gstRate.toFixed(1)} %`, slab.totalGst.toFixed(2)));
          }
        });
      } else if (data.totalTax > 0) {
        lines.push(padLine('GST / Tax', data.totalTax.toFixed(2)));
      }

      billCharges.forEach((charge) => {
        if (charge.amount > 0) {
          lines.push(padLine(charge.label, charge.amount.toFixed(2)));
        }
      });

      if (extraChargesTotal > 0 && billCharges.length === 0) {
        lines.push(padLine('Extra Charges', extraChargesTotal.toFixed(2)));
      }
    }

    lines.push(doubleDivider);
    lines.push(padLine(gstInvoice ? 'Grand Total' : 'Net Amount', data.grandTotal.toFixed(2)));
    lines.push(divider);

    const footer = (data.footerMessage || options.footerMessage || template.footerMessage || 'Thank you!').trim();
    if (footer.length <= width) {
      const centered = center(footer);
      if (centered) lines.push(centered);
    } else {
      lines.push(footer.slice(0, width));
    }

    lines.push('');
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Plaintext formatted receipt representation
   */
  public formatReceiptText(data: PrintSaleData, paperWidth: '58mm' | '80mm' = '58mm', options: ReceiptPrintOptions = {}): string {
    const customTemplate = this.resolveActiveCustomTemplate(options);
    if (customTemplate) {
      return this.formatCustomReceiptText(data, customTemplate, paperWidth, options);
    }

    const template = this.resolveActiveTemplate(options);
    if (isRestaurantLayout(template.layout)) {
      return this.formatRestaurantBillText(data, paperWidth, template, options);
    }
    const showBreakdown = effectiveShowTaxBreakdown(template, options, data);
    const showItemGst = effectiveShowItemGst(options, showBreakdown);
    const COLS = receiptFontCols(paperWidth, options?.receiptFont);

    const wrapProse = (text: string, width: number, center = false): string[] => {
      const trimmed = (text || '').trim();
      if (!trimmed) return [];
      const words = trimmed.split(/\s+/);
      const res: string[] = [];
      let current = '';
      for (const w of words) {
        if (!current) {
          current = w;
        } else if (current.length + 1 + w.length <= width) {
          current += ' ' + w;
        } else {
          res.push(center ? centerText(current, width) : current.padEnd(width, ' '));
          current = w;
        }
      }
      if (current) {
        res.push(center ? centerText(current, width) : current.padEnd(width, ' '));
      }
      return res;
    };

    const centerText = (str: string, width: number): string => {
      const trimmed = str.trim();
      if (!trimmed) return '';
      if (trimmed.length >= width) return trimmed.slice(0, width);
      const pad = Math.floor((width - trimmed.length) / 2);
      return ' '.repeat(pad) + trimmed;
    };

    const divider = (char: string, width: number): string => char.repeat(width);

    const row = (left: string, right: string, width: number): string => {
      const l = left || '';
      const r = right || '';
      const available = width - l.length - r.length;
      if (available <= 0) {
        const maxL = Math.max(1, width - r.length - 1);
        return l.slice(0, maxL) + ' ' + r;
      }
      return l + ' '.repeat(available) + r;
    };

    const cols = (fields: { text: string; width: number; align: 'L' | 'R' }[], width: number): string => {
      let out = '';
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const t = f.text || '';
        if (f.align === 'R') {
          out += t.length >= f.width ? t.slice(0, f.width) : ' '.repeat(f.width - t.length) + t;
        } else {
          out += t.length >= f.width ? t.slice(0, f.width) : t + ' '.repeat(f.width - t.length);
        }
      }
      if (out.length < width) out = out.padEnd(width, ' ');
      return out.slice(0, width);
    };

    const lines: string[] = [];

    // Top margin: blank feed lines
    for (let i = 0; i < (options.topMargin || 0); i++) lines.push('');

    const storeName = (data.storeName || '').trim();
    const tagline = (template.tagline || '').trim();
    const address = (data.storeAddress || '').trim();
    const phone = (data.storePhone || '').trim();
    const gstin = (data.storeGstin || '').trim();
    const custName = (data.customerName || '').trim();
    const custPhone = (data.customerPhone || '').trim();

    // ── 1. HEADER ──
    let hasHeader = false;
    if (storeName) {
      lines.push(...wrapProse(storeName.toUpperCase(), COLS, true));
      hasHeader = true;
    }
    if (tagline) {
      lines.push(...wrapProse(tagline, COLS, true));
      hasHeader = true;
    }
    if (address) {
      lines.push(...wrapProse(address, COLS, true));
      hasHeader = true;
    }
    if (phone) {
      lines.push(centerText(`Phone: ${phone}`, COLS));
      hasHeader = true;
    }
    if (gstin) {
      lines.push(centerText(`GSTIN: ${gstin}`, COLS));
      hasHeader = true;
    }
    if (hasHeader) {
      lines.push(divider('=', COLS));
    }

    // ── Document Title ──
    const docTitle = gstin ? 'TAX INVOICE' : 'BILL OF SUPPLY';
    lines.push(centerText(docTitle, COLS));
    lines.push(divider('=', COLS));

    // ── 2. META DETAILS ──
    const billLabel = `${(template?.billLabel || 'Bill No').trim()} :`;
    const divChar = template?.dividerChar || '-';
    if (options.compactMode) {
      lines.push(row(`Inv:#${data.invoiceNumber}`, data.date, COLS));
    } else {
      lines.push(row(billLabel, data.invoiceNumber, COLS));
      lines.push(row('Date    :', data.date, COLS));
    }
    if (data.providerName) {
      lines.push(row('Provider:', data.providerName.slice(0, COLS - 11), COLS));
    }
    if (data.consumerNo) {
      lines.push(row('Consumer ID:', data.consumerNo, COLS));
    }
    if (data.dueDate) {
      lines.push(row('Due Date   :', data.dueDate, COLS));
    }
    if (data.billingPeriod) {
      lines.push(row('Bill Period:', data.billingPeriod, COLS));
    }
    if (data.unitsConsumed) {
      lines.push(row('Units      :', data.unitsConsumed, COLS));
    }
    if (template.showCustomerLine && custName) {
      lines.push(row('Customer:', custName, COLS));
      if (custPhone) {
        lines.push(row('Phone   :', custPhone, COLS));
      }
    }
    lines.push(divider(divChar, COLS));

    // ── 3. ITEMS TABLE ──
    const items = data.items || [];
    const itemColLeft = template?.itemColumnLeft || 'ITEM';
    const itemColRight = template?.itemColumnRight || 'AMOUNT';
    if (COLS >= 48) {
      // 48-Column One-Line Layout
      const headerFields: { text: string; width: number; align: 'L' | 'R' }[] = [
        { text: itemColLeft, width: showItemGst ? 22 : 27, align: 'L' },
        { text: 'QTY', width: 5, align: 'R' },
      ];
      if (showItemGst) headerFields.push({ text: 'GST', width: 5, align: 'R' });
      headerFields.push(
        { text: 'RATE', width: 8, align: 'R' },
        { text: itemColRight, width: 8, align: 'R' }
      );
      lines.push(cols(headerFields, COLS));
      lines.push(divider(divChar, COLS));

      items.forEach((item, index) => {
        const lineAmt = item.total;
        const gstStr = showItemGst && item.gstRate && item.gstRate > 0 ? formatItemGstRate(item.gstRate) : '';
        const nameWidth = showItemGst ? 22 : 27;
        const fullName = `${index + 1}. ${item.productName}`;
        const firstLineName = fullName.slice(0, nameWidth);

        const rowFields: { text: string; width: number; align: 'L' | 'R' }[] = [
          { text: firstLineName, width: nameWidth, align: 'L' },
          { text: item.quantity.toString(), width: 5, align: 'R' },
        ];
        if (showItemGst) rowFields.push({ text: gstStr, width: 5, align: 'R' });
        rowFields.push(
          { text: item.unitPrice.toFixed(2), width: 8, align: 'R' },
          { text: lineAmt.toFixed(2), width: 8, align: 'R' }
        );
        lines.push(cols(rowFields, COLS));

        let remainingName = fullName.slice(nameWidth);
        const padWidth = showItemGst ? 26 : 21;
        while (remainingName.length > 0) {
          const chunk = '  ' + remainingName.slice(0, nameWidth - 2);
          remainingName = remainingName.slice(nameWidth - 2);
          lines.push(cols([
            { text: chunk, width: nameWidth, align: 'L' },
            { text: '', width: padWidth, align: 'L' },
          ], COLS));
        }
      });
    } else {
      // 32-Column Two-Line Layout
      lines.push(row(itemColLeft, itemColRight, COLS));
      lines.push(divider(divChar, COLS));

      items.forEach((item, index) => {
        const lineAmt = item.total;
        const gstStr = showItemGst && item.gstRate && item.gstRate > 0 ? formatItemGstRate(item.gstRate) : '';
        const fullName = `${index + 1}. ${item.productName}`;
        lines.push(...wrapProse(fullName, COLS, false));

        const qtyRateStr = `${item.quantity} ${item.unit || 'Pc'} x ${item.unitPrice.toFixed(2)}`;
        if (showItemGst && gstStr) {
          lines.push(cols([
            { text: '  ', width: 2, align: 'L' },
            { text: qtyRateStr, width: 20, align: 'L' },
            { text: lineAmt.toFixed(2), width: 10, align: 'R' },
          ], COLS));
          lines.push(`   ${gstStr} GST`.padEnd(COLS, ' '));
        } else {
          lines.push(cols([
            { text: '  ', width: 2, align: 'L' },
            { text: qtyRateStr, width: 20, align: 'L' },
            { text: lineAmt.toFixed(2), width: 10, align: 'R' },
          ], COLS));
        }
      });
    }

    lines.push(divider('-', COLS));

    // ── 4. TOTALS BLOCK ──
    lines.push(row('Sub Total', data.subtotal.toFixed(2), COLS));
    if (data.totalDiscount > 0) {
      lines.push(row('Discount', `-${data.totalDiscount.toFixed(2)}`, COLS));
    }
    if (showBreakdown && data.totalTax > 0) {
      if (data.gstStyle === 'slab_wise' && data.gstSlabs && data.gstSlabs.length > 0) {
        data.gstSlabs.forEach((slab) => {
          if (slab.gstRate > 0) {
            lines.push(row(`Taxable @ ${slab.gstRate}%`, slab.taxableValue.toFixed(2), COLS));
            lines.push(row(`  CGST @ ${slab.cgstRate}%`, slab.cgstAmount.toFixed(2), COLS));
            lines.push(row(`  SGST @ ${slab.sgstRate}%`, slab.sgstAmount.toFixed(2), COLS));
          }
        });
      } else {
        const taxable = data.taxableAmt !== undefined ? data.taxableAmt : data.subtotal;
        const halfTax = data.totalTax / 2;
        const sgstVal = data.sgst !== undefined ? data.sgst : halfTax;
        const cgstVal = data.cgst !== undefined ? data.cgst : halfTax;
        lines.push(row('Taxable Value', taxable.toFixed(2), COLS));
        lines.push(row('  CGST', cgstVal.toFixed(2), COLS));
        lines.push(row('  SGST', sgstVal.toFixed(2), COLS));
      }
      lines.push(divider('-', COLS));
    }

    const extraCharges = data.billCharges?.filter((c) => c.amount > 0) || [];
    extraCharges.forEach((charge) => {
      lines.push(row(charge.label, charge.amount.toFixed(2), COLS));
    });

    lines.push(divider('=', COLS));
    lines.push(row('GRAND TOTAL', data.grandTotal.toFixed(2), COLS));
    lines.push(divider('=', COLS));

    // ── 5. SUMMARY STATS & PAYMENT ──
    const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
    lines.push(row(`Items: ${items.length}`, `Total Qty: ${totalQty}`, COLS));
    const payMethodStr = (data.paymentMethod || 'CASH').toUpperCase();
    lines.push(row('Payment:', payMethodStr, COLS));
    lines.push(divider('-', COLS));

    // ── 6. AMOUNT IN WORDS ──
    const wordsText = numberToIndianWords(data.grandTotal);
    lines.push(...wrapProse(wordsText, COLS, true));
    lines.push(divider('-', COLS));

    // ── 7. FOOTER & TERMS ──
    // Prefer the live sale / settings footer (what the on-screen preview shows) over the
    // static template default, so preview and thermal slip stay in sync.
    const footerText = (
      data.footerMessage ||
      options.footerMessage ||
      template.footerMessage ||
      ''
    ).trim();
    if (footerText) {
      lines.push(...wrapProse(footerText, COLS, true));
    }
    lines.push(...wrapProse(RECEIPT_DEFAULT_TERMS, COLS, true));

    // Trailing blank lines help cheap firmware flush the final prose line before cut/feed.
    lines.push('');
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Kitchen Order Ticket — plain text, no prices anywhere, printed extra-large (see printKotTicket's
   * widthtimes/heigthtimes) so it reads clearly from across a kitchen. Independent of ReceiptTemplate
   * (a KOT doesn't vary by business vertical the way a customer bill's layout does).
   */
  /**
   * Kitchen Order Ticket — plain text, NEVER any prices/totals/tax anywhere.
   * Formatted specifically for standard 58mm (32 cols) and 80mm (48 cols) kitchen printers.
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
    const copyLabel = data.copyType || 'KITCHEN COPY';
    if (paperWidth === '58mm') {
      lines.push(centerLine(`========${copyLabel}========`));
      lines.push(centerLine(`KOT #${String(data.orderNumber).padStart(4, '0')}   [${(data.orderType || 'DINE_IN').replace('_', '-').toUpperCase()}]`));
      if (data.orderType === 'dine_in') {
        const tbl = data.tableName || data.partyLabel || 'Table ?';
        const pax = data.guestCount ? `   Pax: ${data.guestCount}` : '';
        lines.push(`   Table: ${tbl}${pax}`);
      } else if (data.partyLabel) {
        lines.push(`   Party: ${data.partyLabel}`);
      }
      lines.push(`   Time: ${data.time}`);
      if (data.waiterName) {
        lines.push(`   Waiter: ${data.waiterName}`);
      }
      if (data.stationName) {
        lines.push(`   Station: ${data.stationName}`);
      }
      if (data.reprintCount && data.reprintCount > 0) {
        lines.push(centerLine(`[ REPRINT #${data.reprintCount} ]`));
      }
      if (data.priority === 'urgent') {
        lines.push(centerLine('!!! URGENT !!!'));
      }
    } else {
      // 80mm layout (48-column)
      lines.push(centerLine(`==================${copyLabel}==================`));
      const stationTag = data.stationName ? `Station: ${data.stationName}` : '';
      lines.push(`    KOT #${String(data.orderNumber).padStart(4, '0')}${' '.repeat(Math.max(4, 24 - String(data.orderNumber).length))}${stationTag}`);
      const typeLabel = (data.orderType || 'DINE_IN').replace('_', '-').toUpperCase();
      const tbl = data.tableName || data.partyLabel || 'Dine-In';
      const pax = data.guestCount ? `  |  Pax: ${data.guestCount}` : '';
      lines.push(`    Table: ${tbl}${pax}  |  ${typeLabel}`);
      lines.push(`    Fired: ${data.time}`);
      if (data.waiterName) {
        lines.push(`    Waiter: ${data.waiterName}`);
      }
      if (data.reprintCount && data.reprintCount > 0) {
        lines.push(centerLine(`[ REPRINT #${data.reprintCount} ]`));
      }
      if (data.priority === 'urgent') {
        lines.push(centerLine('!!! URGENT !!!'));
      }
    }

    lines.push(thinDivider);

    let totalQty = 0;
    const activeItems = data.items.filter((it) => it.status !== 'voided');

    if (paperWidth === '80mm') {
      lines.push('  QTY  ITEM                          NOTE');
    }

    activeItems.forEach((item) => {
      totalQty += item.quantity;
      if (paperWidth === '58mm') {
        lines.push(` ${item.quantity}x  ${item.productName}`);
        if (item.modifiers && item.modifiers.length > 0) {
          lines.push(`     * ${item.modifiers.join(', ')}`);
        }
        if (item.notes) {
          lines.push(`     - ${item.notes}`);
        }
      } else {
        const qtyCol = `  ${item.quantity}x`.padEnd(7, ' ');
        const nameCol = item.productName.slice(0, 26).padEnd(28, ' ');
        const noteCol = item.notes ? item.notes.slice(0, 12) : '';
        lines.push(`${qtyCol}${nameCol}${noteCol}`);
        if (item.productName.length > 26) {
          lines.push(`       ${item.productName.slice(26)}`);
        }
        if (item.modifiers && item.modifiers.length > 0) {
          lines.push(`       * ${item.modifiers.join(', ')}`);
        }
        if (item.notes && item.notes.length > 12) {
          lines.push(`       - ${item.notes}`);
        }
      }
    });

    lines.push(thinDivider);
    lines.push(` Items: ${activeItems.length}     Total Qty: ${totalQty}`);

    if (data.notes) {
      lines.push(` NOTE: ${data.notes}`);
    }

    lines.push(` Fired: ${data.time}`);
    lines.push(divider);
    lines.push('');
    return lines.join('\n');
  }

  /** HTML fallback for KOT tickets (system print dialog / no Bluetooth ESC/POS device paired). */
  public generateKotHtml(data: PrintKotData, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const widthPx = paperWidth === '58mm' ? '280px' : '380px';
    const copyLabel = data.copyType || 'KITCHEN COPY';
    const typeLabel = (data.orderType || 'DINE_IN').replace('_', '-').toUpperCase();
    const activeItems = data.items.filter((it) => it.status !== 'voided');
    const totalQty = activeItems.reduce((acc, it) => acc + it.quantity, 0);

    const itemsHtml = activeItems
      .map(
        (item) => `
        <div style="margin-bottom: 8px;">
          <div style="font-size: 1.1em; font-weight: bold;">${item.quantity}x ${item.productName}</div>
          ${item.modifiers && item.modifiers.length ? `<div style="font-size: 0.9em; padding-left: 12px;">* ${item.modifiers.join(', ')}</div>` : ''}
          ${item.notes ? `<div style="font-size: 0.9em; font-style: italic; padding-left: 12px;">- ${item.notes}</div>` : ''}
        </div>`
      )
      .join('<hr style="border: none; border-top: 1px dashed #000; margin: 4px 0;">');

    return `
      <html><body style="font-family: monospace; width: ${widthPx}; margin: 0 auto; padding: 8px; font-size: 14px;">
        <div style="text-align: center; font-weight: bold; font-size: 1.1em;">========${copyLabel}========</div>
        <div style="text-align: center; font-weight: bold; font-size: 1.25em; margin-top: 4px;">KOT #${String(data.orderNumber).padStart(4, '0')} [${typeLabel}]</div>
        <div style="text-align: center;">${data.orderType === 'dine_in' ? (data.tableName || data.partyLabel || 'Dine-In') : (data.partyLabel || '')}${data.guestCount ? ` | Pax: ${data.guestCount}` : ''}</div>
        ${data.waiterName ? `<div style="text-align: center;">Waiter: ${data.waiterName}</div>` : ''}
        ${data.stationName ? `<div style="text-align: center; font-weight: bold;">Station: ${data.stationName}</div>` : ''}
        <div style="text-align: center; font-size: 0.9em;">Time: ${data.time}</div>
        ${data.reprintCount ? `<div style="text-align: center; font-weight: bold; margin-top: 2px;">[ REPRINT #${data.reprintCount} ]</div>` : ''}
        ${data.priority === 'urgent' ? '<div style="text-align: center; font-weight: bold; color: #DC2626; margin-top: 2px;">!!! URGENT !!!</div>' : ''}
        <hr style="border: none; border-top: 1px solid #000; margin: 6px 0;">
        ${itemsHtml}
        <hr style="border: none; border-top: 1px solid #000; margin: 6px 0;">
        <div style="font-size: 0.95em;">Items: ${activeItems.length} &nbsp;&nbsp;&nbsp; Total Qty: ${totalQty}</div>
        ${data.notes ? `<div style="font-size: 0.9em; margin-top: 4px;"><b>NOTE:</b> ${data.notes}</div>` : ''}
        <div style="font-size: 0.85em; margin-top: 4px;">Fired: ${data.time}</div>
        <hr style="border: none; border-top: 2px solid #000; margin: 6px 0;">
      </body></html>
    `;
  }

  /**
   * Delta Kitchen Order Ticket — prints CHANGES ONLY (+ NEW, - VOID with reason, ~ QTY CHANGE)
   * when an active KOT order is edited after initial firing.
   */
  public formatKotDeltaText(data: PrintKotDeltaData, paperWidth: '58mm' | '80mm' = '58mm'): string {
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
    const versionTag = data.version ? ` v${data.version}` : '';
    lines.push(centerLine(`======MODIFIED KOT #${String(data.orderNumber).padStart(4, '0')}======`));
    if (data.tableName || data.partyLabel) {
      lines.push(`  Table: ${data.tableName || data.partyLabel}    Time: ${data.time}`);
    } else {
      lines.push(`  Time: ${data.time}`);
    }
    if (data.waiterName) {
      lines.push(`  Waiter: ${data.waiterName}`);
    }
    lines.push(centerLine(`[ MODIFIED${versionTag} ]`));
    lines.push(thinDivider);

    data.changes.forEach((c) => {
      if (c.type === 'new') {
        lines.push(`+ NEW   ${c.quantity}x  ${c.productName}`);
        if (c.notes) lines.push(`        - ${c.notes}`);
      } else if (c.type === 'void') {
        lines.push(`- VOID  ${c.quantity}x  ${c.productName}`);
        if (c.reason) lines.push(`        (${c.reason})`);
      } else if (c.type === 'qty_change') {
        lines.push(`~ CHG   ${c.oldQuantity || 1}x -> ${c.quantity}x  ${c.productName}`);
        if (c.notes) lines.push(`        - ${c.notes}`);
      }
    });

    lines.push(thinDivider);
    lines.push(centerLine('This ticket shows CHANGES ONLY'));
    lines.push(divider);
    lines.push('');
    return lines.join('\n');
  }

  /** HTML fallback for Delta KOT tickets (system print dialog) */
  public generateKotDeltaHtml(data: PrintKotDeltaData, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const widthPx = paperWidth === '58mm' ? '280px' : '380px';
    const versionTag = data.version ? ` v${data.version}` : '';

    const changesHtml = data.changes
      .map((c) => {
        if (c.type === 'new') {
          return `<div style="color: #15803D; font-weight: bold; margin-bottom: 6px;">+ NEW &nbsp; ${c.quantity}x ${c.productName}${c.notes ? `<div style="font-weight: normal; font-size: 0.9em; padding-left: 14px;">- ${c.notes}</div>` : ''}</div>`;
        }
        if (c.type === 'void') {
          return `<div style="color: #DC2626; font-weight: bold; margin-bottom: 6px;">- VOID &nbsp; ${c.quantity}x ${c.productName}${c.reason ? `<div style="font-weight: normal; font-size: 0.9em; padding-left: 14px; font-style: italic;">(${c.reason})</div>` : ''}</div>`;
        }
        return `<div style="color: #B45309; font-weight: bold; margin-bottom: 6px;">~ CHG &nbsp; ${c.oldQuantity || 1}x → ${c.quantity}x ${c.productName}${c.notes ? `<div style="font-weight: normal; font-size: 0.9em; padding-left: 14px;">- ${c.notes}</div>` : ''}</div>`;
      })
      .join('<hr style="border: none; border-top: 1px dashed #000; margin: 4px 0;">');

    return `
      <html><body style="font-family: monospace; width: ${widthPx}; margin: 0 auto; padding: 8px; font-size: 14px;">
        <div style="text-align: center; font-weight: bold; font-size: 1.1em;">======MODIFIED KOT #${String(data.orderNumber).padStart(4, '0')}======</div>
        <div style="text-align: center; margin-top: 2px;">Table: ${data.tableName || data.partyLabel || 'Table'} &nbsp; Time: ${data.time}</div>
        ${data.waiterName ? `<div style="text-align: center; font-size: 0.9em;">Waiter: ${data.waiterName}</div>` : ''}
        <div style="text-align: center; font-weight: bold; color: #B45309; margin-top: 2px;">[ MODIFIED${versionTag} ]</div>
        <hr style="border: none; border-top: 1px solid #000; margin: 6px 0;">
        ${changesHtml}
        <hr style="border: none; border-top: 1px solid #000; margin: 6px 0;">
        <div style="text-align: center; font-size: 0.85em; font-style: italic;">This ticket shows CHANGES ONLY</div>
        <hr style="border: none; border-top: 2px solid #000; margin: 6px 0;">
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
        // Reset printer state before token slip print
        await this.initPrinter(paperWidth);

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

  public generateCustomReceiptHtml(
    data: PrintSaleData,
    customTemplate: CustomReceiptTemplate,
    paperWidth: '58mm' | '80mm' = '58mm',
    options: ReceiptPrintOptions = {}
  ): string {
    const logoReadyTemplate = ensureTemplateHasLogoBlock(customTemplate, data.storeLogoUrl || options.storeLogoUrl);
    const widthPx = paperWidth === '58mm' ? '280px' : '380px';
    const fontSize = paperWidth === '58mm' ? '12px' : '14px';
    const topMarginPx = (options.topMargin || 0) * 10;
    const cssFont = receiptFontCssFamily(options.receiptFont);
    const billPdfUrl = buildBillPdfUrl(data);
    const showBreakdown =
      options.showTaxBreakdown !== undefined
        ? options.showTaxBreakdown
        : data.gstStyle === 'tax_invoice' || data.gstStyle === 'slab_wise';
    const showItemGst = effectiveShowItemGst(options, showBreakdown);
    const isRestaurant = resolvePrintIsRestaurant(options);

    const blocksHtml = enrichCustomReceiptEntries(
      logoReadyTemplate.entries.filter((e) => e.enabled),
      data.totalDiscount || 0
    )
      .map((entry) => {
        switch (entry.type) {
          case 'text': {
            const raw = this.interpolateReceiptVariables(entry.text, data);
            const lines = raw.split('\n').filter((l) => l.trim().length > 0);
            if (lines.length === 0) return '';
            const txt = lines.join('<br/>');
            const align = entry.align || 'left';
            const isBold = entry.bold ? 'font-weight: bold;' : '';
            const isUnderline = entry.underline ? 'text-decoration: underline;' : '';
            const sizeStyle =
              entry.size === 'large'
                ? 'font-size: 1.25em;'
                : entry.size === 'double_width'
                ? 'font-size: 1.15em; letter-spacing: 2px;'
                : entry.size === 'double_height'
                ? 'font-size: 1.35em; line-height: 1.3;'
                : entry.size === 'small'
                ? 'font-size: 0.85em;'
                : '';
            return `<div style="text-align: ${align}; ${isBold} ${isUnderline} ${sizeStyle} margin: 2px 0;">${txt}</div>`;
          }

          case 'image': {
            const uri = resolveReceiptImageSrc(entry, data.storeLogoUrl);
            if (!uri) return '';
            const align = entry.align || 'center';
            const widthPct = entry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT;
            const { maxHeight, maxWidth } = receiptLogoHtmlMaxPxFromChip(options?.receiptLogoSize);
            const maxW = Math.max(80, Math.round(maxWidth * Math.min(widthPct, 100) / 100));
            return `<div style="text-align: ${align}; margin: 6px 0;"><img src="${uri}" style="max-height: ${maxHeight}px; max-width: ${maxW}px; width: auto; height: auto; object-fit: contain; margin: 0 auto; display: block;" /></div>`;
          }

          case 'text_special': {
            const raw = this.interpolateReceiptVariables(entry.text, data);
            const lines = raw.split('\n').filter((l) => l.trim().length > 0);
            if (lines.length === 0) return '';
            const txt = lines.join('<br/>');
            const align = entry.align || 'left';
            const isBold = entry.bold ? 'font-weight: bold;' : '';
            const isItalic = entry.italic ? 'font-style: italic;' : '';
            const isUnderline = entry.underline ? 'text-decoration: underline;' : '';
            const fontSz = entry.fontSizePt ? `font-size: ${entry.fontSizePt}pt;` : '';
            const fontFam = entry.fontFamily ? `font-family: ${entry.fontFamily};` : '';
            return `<div style="text-align: ${align}; ${isBold} ${isItalic} ${isUnderline} ${fontSz} ${fontFam} margin: 3px 0;">${txt}</div>`;
          }

          case 'horizontal_line': {
            const borderStyle =
              entry.lineStyle === 'double'
                ? '3px double #000'
                : entry.lineStyle === 'dotted'
                ? '1px dotted #000'
                : entry.lineStyle === 'dashed'
                ? '1px dashed #000'
                : '1px solid #000';
            return `<div style="border-bottom: ${borderStyle}; margin: 6px 0;"></div>`;
          }

          case 'left_right_text': {
            if (isDiscountReceiptEntry(entry) && (!data.totalDiscount || data.totalDiscount <= 0)) {
              return '';
            }
            if (isTaxReceiptEntry(entry) && (!data.totalTax || data.totalTax <= 0)) {
              return '';
            }
            // Skip scan-to-pay rows — barcode block already renders "SCAN TO PAY VIA UPI" as a header
            if (/scan/i.test(String(entry.left || '') + String(entry.right || ''))) return '';
            const left = this.interpolateReceiptVariables(entry.left, data);
            const right = this.interpolateReceiptVariables(entry.right, data);
            if (!left && !right) return '';
            const isBold = entry.bold ? 'font-weight: bold;' : '';
            const sizeStyle = entry.size === 'large' ? 'font-size: 1.15em;' : entry.size === 'small' ? 'font-size: 0.9em;' : '';
            const discountStyle = isDiscountReceiptEntry(entry) ? 'color: #059669; font-weight: bold;' : '';
            return `<div style="display: flex; justify-content: space-between; ${isBold} ${sizeStyle} ${discountStyle} margin: 2px 0;"><span>${left}</span><span>${right}</span></div>`;
          }

          case 'table': {
            const itemHeader = entry.columnHeaders?.item || 'Item';
            const totalHeader = entry.columnHeaders?.total || 'Total';
            const itemsRows = data.items
              .map((item, idx) => {
                const namePrefix = resolveShowItemNumbers(entry, isRestaurant) ? `${idx + 1}. ` : '';
                return `
                <div style="margin-bottom: 5px;">
                  <div><b>${namePrefix}${item.productName}</b></div>
                  ${(showItemGst || entry.showTaxColumn) && item.gstRate ? `<div style="font-size: 0.85em; color: #555;">${formatItemGstRate(item.gstRate)} GST</div>` : ''}
                  <div style="display: flex; justify-content: space-between; font-size: 0.95em;">
                    <span>&nbsp;&nbsp;${item.quantity} ${item.unit || 'Pc'} x ${item.unitPrice.toFixed(2)}</span>
                    <span>${item.total.toFixed(2)}</span>
                  </div>
                  ${shouldShowItemDiscount(item.discount) ? `<div style="font-size: 0.85em; color: #059669; font-weight: bold; margin-left: 12px;">Discount: -₹${item.discount!.toFixed(2)}</div>` : ''}
                </div>`;
              })
              .join('');

            return `
              <div style="margin: 4px 0;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 4px;">
                  <span>${itemHeader}</span>
                  <span>${totalHeader}</span>
                </div>
                ${itemsRows}
              </div>`;
          }

          case 'multi_format': {
            const align = entry.align || 'left';
            const segmentsHtml = entry.segments
              .map((seg) => {
                const txt = this.interpolateReceiptVariables(seg.text, data);
                const isBold = seg.bold ? 'font-weight: bold;' : '';
                const isUnderline = seg.underline ? 'text-decoration: underline;' : '';
                const sz = seg.size === 'large' ? 'font-size: 1.15em;' : seg.size === 'small' ? 'font-size: 0.85em;' : '';
                return `<span style="${isBold} ${isUnderline} ${sz}">${txt}</span>`;
              })
              .join(' ');
            return `<div style="text-align: ${align}; margin: 3px 0;">${segmentsHtml}</div>`;
          }

          case 'barcode': {
            let rawVal = this.interpolateReceiptVariables(entry.value, data);
            if (entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || entry.upiId) {
              rawVal = this.upiPayPayload(data, entry.upiId) || rawVal;
            } else if (!rawVal || rawVal === '{{bill_pdf_url}}' || entry.qrType === 'digital_bill') {
              rawVal = billPdfUrl;
            } else if (rawVal === '{{invoice_no}}' || entry.qrType === 'invoice_barcode') {
              rawVal = data.invoiceNumber || 'INV-0000';
            }

            const align = entry.align || 'center';
            const isQr = entry.format === 'qr' || entry.codeType === 'qr_code';
            const isUpi = entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || Boolean(entry.upiId);
            const qrSize =
              isUpi || entry.qrType === 'digital_bill' || !entry.size
                ? receiptStandardQrHtmlPxFromChip(options?.receiptQrSize)
                : receiptQrHtmlPx(entry.size === 'large' || entry.size === 'small' ? entry.size : 'medium');

            if (isQr) {
              const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${Math.max(qrSize * 2, 240)}x${Math.max(qrSize * 2, 240)}&data=${encodeURIComponent(rawVal)}&margin=4`;
              return `
                <div style="text-align: ${align}; margin: 8px 0;">
                  ${isUpi ? `<div class="bold" style="font-size:11px;margin-bottom:4px;">SCAN TO PAY VIA UPI</div>` : ''}
                  <img src="${qrApiUrl}" width="${qrSize}" height="${qrSize}" alt="QR Code" style="display: inline-block; image-rendering: pixelated; background: #fff; padding: 4px; border: 1px solid #e2e8f0; border-radius: 6px;" />
                </div>`;
            } else {
              return `
                <div style="text-align: ${align}; margin: 6px 0;">
                  <div style="font-family: 'Courier New', monospace; font-size: 1.3em; letter-spacing: 3px; font-weight: bold; border-top: 1px dashed #999; border-bottom: 1px dashed #999; padding: 4px 0; display: inline-block;">* ${rawVal} *</div>
                  ${entry.showText ? `<div style="font-size: 0.8em; margin-top: 2px;">${rawVal}</div>` : ''}
                </div>`;
            }
          }

          case 'files_note': {
            const align = entry.align || 'left';
            const txt = this.interpolateReceiptVariables(entry.content, data).replace(/\n/g, '<br/>');
            return `
              <div style="text-align: ${align}; margin: 6px 0; font-size: 0.85em; color: #333;">
                ${entry.title ? `<div style="font-weight: bold; margin-bottom: 2px;">${entry.title}</div>` : ''}
                <div>${txt}</div>
              </div>`;
          }

          default:
            return '';
        }
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { margin: 0; size: auto; }
            * { box-sizing: border-box; }
            body {
              width: ${widthPx};
              margin: ${topMarginPx}px auto 0 auto;
              padding-left: 16px;
              padding-right: 16px;
              padding-top: 10px;
              padding-bottom: 10px;
              font-family: ${cssFont};
              font-size: ${fontSize};
              color: #000;
              background: #fff;
              box-sizing: border-box;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          ${blocksHtml}
        </body>
      </html>
    `;
  }

  /** HTML fallback for restaurant thermal layouts (48mm / 58mm printable head). */
  private generateRestaurantBillHtml(
    data: PrintSaleData,
    template: ReceiptTemplate,
    paperWidth: '58mm' | '80mm' = '58mm',
    options: ReceiptPrintOptions = {},
  ): string {
    const layout = template.layout || 'restaurant_bill';
    const compact = layout === 'restaurant_compact' || layout === 'restaurant_gst' || layout === 'restaurant_roomservice';
    const takeaway = layout === 'restaurant_takeaway';
    const gstInvoice = layout === 'restaurant_gst';
    const roomService = layout === 'restaurant_roomservice';
    const seatLabel = roomService ? 'Room' : 'TNo';
    const widthPx = paperWidth === '58mm' ? '248px' : '380px';
    const fontSize = paperWidth === '58mm' ? '11px' : '12px';
    const topMarginPx = (options.topMargin || 0) * 10;

    const dateParts = String(data.date || '').split(/[\s,]+/);
    const billDate = dateParts[0] || new Date().toLocaleDateString('en-GB');
    const billTime =
      dateParts.length > 1
        ? dateParts.slice(1).join(' ').slice(0, 5)
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const totalQty = data.items.reduce((sum, it) => sum + it.quantity, 0);
    const grossTotal = data.subtotal;
    const billCharges = data.billCharges || [];
    const halfTax = Math.round((data.totalTax / 2) * 100) / 100;

    const itemsHtml = compact
      ? data.items
          .map((item) => {
            const qtyLabel = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(3);
            return `<tr>
              <td>${String(item.productName || '').toUpperCase()}</td>
              <td class="r">${qtyLabel}</td>
              <td class="r">${item.total.toFixed(2)}</td>
            </tr>`;
          })
          .join('')
      : data.items
          .map((item) => {
            const qtyLabel = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(3);
            return `
        <div class="item-block">
          <div class="item-name">${String(item.productName || '').toUpperCase()}</div>
          <div class="item-detail">
            <span class="item-qty-rate">${qtyLabel} x ${item.unitPrice.toFixed(2)}</span>
            <span>${item.total.toFixed(2)}</span>
          </div>
        </div>`;
          })
          .join('');

    const vatHtml =
      data.gstSlabs && data.gstSlabs.length > 0
        ? data.gstSlabs
            .filter((slab) => slab.gstRate > 0)
            .map((slab) => `<tr><td>VAT ${slab.gstRate.toFixed(1)} %</td><td class="r">${slab.totalGst.toFixed(2)}</td></tr>`)
            .join('')
        : data.totalTax > 0
          ? `<tr><td>GST / Tax</td><td class="r">${data.totalTax.toFixed(2)}</td></tr>`
          : '';

    const chargesHtml = billCharges
      .filter((charge) => charge.amount > 0)
      .map((charge) => `<tr><td>${charge.label}</td><td class="r">${charge.amount.toFixed(2)}</td></tr>`)
      .join('');

    const totalsHtml = gstInvoice
      ? `<tr><td>Taxable</td><td class="r">${grossTotal.toFixed(2)}</td></tr>
         ${data.totalTax > 0 ? `<tr><td>CGST 2.5%</td><td class="r">${halfTax.toFixed(2)}</td></tr>
         <tr><td>SGST 2.5%</td><td class="r">${(data.totalTax - halfTax).toFixed(2)}</td></tr>` : ''}`
      : compact || takeaway
        ? `<tr><td>Qty ${Number.isInteger(totalQty) ? totalQty : totalQty.toFixed(3)}</td><td class="r">${grossTotal.toFixed(2)}</td></tr>
           ${data.totalTax > 0 && template.showTaxBreakdown ? `<tr><td>GST 5%</td><td class="r">${data.totalTax.toFixed(2)}</td></tr>` : ''}
           ${chargesHtml}`
        : `<tr><td>Total Qty</td><td class="r">${totalQty.toFixed(3)}</td></tr>
           <tr><td>Gross Total</td><td class="r">${grossTotal.toFixed(2)}</td></tr>
           ${vatHtml}
           ${chargesHtml}`;

    const metaHtml = takeaway
      ? `<table>
          <tr><td>${template.billLabel} ${data.invoiceNumber || '—'}</td><td class="r">${billDate}</td></tr>
          <tr><td>${(data.customerName || 'WALK-IN').toUpperCase()}</td><td class="r">${billTime}</td></tr>
          ${data.customerPhone ? `<tr><td colspan="2">PH: ${data.customerPhone}</td></tr>` : ''}
        </table>`
      : compact
        ? `<table>
          <tr><td>${template.billLabel} ${data.invoiceNumber || '—'}</td><td class="r">${billDate}</td></tr>
          <tr><td>${seatLabel} ${(data.tableNo || '—').toUpperCase()} ${(data.waiterName || (roomService ? 'STEWARD' : 'WAITER')).toUpperCase()}</td><td class="r">${billTime}</td></tr>
        </table>`
        : `<table class="meta-table">
            <tr>
              <td>Bill No</td><td>Waiter</td><td>TNo</td><td>Date</td><td class="r">Time</td>
            </tr>
            <tr class="bold">
              <td>${data.invoiceNumber || '—'}</td>
              <td>${(data.waiterName || 'WAITER').toUpperCase()}</td>
              <td>${(data.tableNo || '—').toUpperCase()}</td>
              <td>${billDate}</td>
              <td class="r">${billTime}</td>
            </tr>
          </table>`;

    const addressHtml = String(data.storeAddress || '')
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => `<div class="center">${line.toUpperCase()}</div>`)
      .join('');

    const tinLabel = gstInvoice ? 'GSTIN' : 'TIN';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { margin: 0; size: auto; }
            * { box-sizing: border-box; }
            body {
              width: ${widthPx};
              margin: ${topMarginPx}px auto 0 auto;
              padding: 10px 10px;
              font-family: 'Courier New', Courier, monospace;
              font-size: ${fontSize};
              color: #000;
              background: #fff;
              text-transform: uppercase;
            }
            .center { text-align: center; }
            .r { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-bottom: 2px double #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { vertical-align: top; padding: 1px 0; }
            .meta-table td { font-size: 0.9em; padding-right: 4px; }
            .item-block { margin-bottom: 6px; }
            .item-name { font-weight: bold; word-break: break-word; }
            .item-detail { display: flex; justify-content: space-between; padding-left: 24px; margin-top: 1px; }
            .item-qty-rate { color: #333; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 14px;">${(data.storeName || 'YOUR RESTAURANT').toUpperCase()}</div>
          ${addressHtml}
          ${data.storePhone ? `<div class="center">PH: ${data.storePhone}</div>` : ''}
          ${data.storeGstin ? `<div class="center">${tinLabel}: ${data.storeGstin}</div>` : ''}
          <div class="center bold">${template.tagline || 'CASH/BILL'}</div>

          <div class="divider"></div>
          ${metaHtml}
          <div class="divider"></div>

          ${
            compact
              ? `<table class="bold"><tr><td>Item</td><td class="r">Qty</td><td class="r">Amt</td></tr></table>
                 <div class="divider"></div>
                 <table>${itemsHtml}</table>`
              : `<div class="bold" style="display: flex; justify-content: space-between;">
                   <span>Item</span><span>Total</span>
                 </div>
                 <div class="divider"></div>
                 ${itemsHtml}`
          }

          <div class="divider"></div>

          <table>
            ${totalsHtml}
          </table>
          <div class="double-divider"></div>
          <table class="bold">
            <tr><td>${gstInvoice ? 'Grand Total' : 'Net Amount'}</td><td class="r">${data.grandTotal.toFixed(2)}</td></tr>
          </table>

          <div class="divider"></div>
          ${this.upiQrHtml(data, 'mm' as any, options?.receiptQrSize)}
          <div class="center">${(data.footerMessage || options?.footerMessage || template.footerMessage || '').trim()}</div>
        </body>
      </html>
    `;
  }

  /** HTML fallback for standard receipt printing (no active custom template). */
  public generateReceiptHtml(
    data: PrintSaleData,
    paperWidth: '58mm' | '80mm' = '58mm',
    options: ReceiptPrintOptions = {}
  ): string {
    const customTemplate = options.customTemplate !== undefined ? options.customTemplate : this.resolveActiveCustomTemplate(options);
    if (customTemplate) {
      return this.generateCustomReceiptHtml(data, customTemplate, paperWidth, options);
    }

    const template = this.resolveActiveTemplate(options);
    if (isRestaurantLayout(template.layout)) {
      return this.generateRestaurantBillHtml(data, template, paperWidth, options);
    }

    const widthPx = paperWidth === '80mm' ? '380px' : '280px';
    const effectivePaperWidth = paperWidth === '80mm' ? '80mm' : '58mm';
    const effectiveLogoSize = options.receiptLogoSize;
    const effectiveQrSize = options.receiptQrSize;
    const widthStyle = `max-width: ${widthPx};`;
    const fontSize = paperWidth === '58mm' ? '12px' : '14px';
    const cssFont = receiptFontCssFamily(options.receiptFont);

    const text = this.formatReceiptText(data, paperWidth, options);
    const textLines = text.split('\n');
    const logo = receiptLogoHtmlMaxPxFromChip(effectiveLogoSize);
    const qrDimension = receiptStandardQrHtmlPxFromChip(effectiveQrSize);
    const upiQrImg = data.upiId ? this.upiPayPayload(data) : '';
    const upiImgUrl = upiQrImg ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&data=${encodeURIComponent(upiQrImg)}` : '';
    const { usePrinterStore } = require('../store/usePrinterStore');
    const shouldPrintBillQr = options.includeBillQr ?? usePrinterStore.getState().enableBillQrCode;
    const billPdfUrl = buildBillPdfUrl(data);
    const billQrImg = shouldPrintBillQr && billPdfUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&data=${encodeURIComponent(billPdfUrl)}`
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { size: ${effectivePaperWidth} auto; margin: 2mm 1mm 8mm 1mm; }
            * { box-sizing: border-box; }
            body {
              font-family: ${cssFont};
              font-size: ${fontSize};
              line-height: 1.25;
              margin: 0 auto;
              padding: 6px;
              width: 100%;
              ${widthStyle}
              color: #000;
              background: #fff;
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          ${data.storeLogoUrl ? `
          <div style="text-align: center; margin-bottom: 6px;">
            <img src="${data.storeLogoUrl}" style="max-height: ${logo.maxHeight}px; max-width: ${logo.maxWidth}px; width: auto; height: auto; object-fit: contain; margin: 0 auto; display: block;" />
          </div>` : ''}
          ${textLines.map((l) => `<div style="white-space: pre; overflow: hidden; width: 100%; font-family: ${cssFont};">${l.replace(/ /g, '&nbsp;')}</div>`).join('')}
          ${upiImgUrl ? `
          <div style="text-align: center; margin-top: 10px; padding: 6px 0; border-top: 1px dashed #000; display: block;">
            <div style="font-size: 10px; font-weight: 900; margin-bottom: 4px; letter-spacing: 0.5px;">SCAN TO PAY VIA UPI</div>
            <img src="${upiImgUrl}" alt="Payment QR" style="width: ${qrDimension}px; height: ${qrDimension}px; object-fit: contain; margin: 0 auto; display: block;" />
          </div>` : ''}
          ${billQrImg ? `
          <div style="text-align: center; margin-top: 8px; padding: 4px 0; display: block;">
            <div style="font-size: 9px; font-weight: 700; margin-bottom: 4px;">Scan QR to View &amp; Download Bill PDF</div>
            <img src="${billQrImg}" alt="Digital Bill QR" style="width: ${qrDimension}px; height: ${qrDimension}px; object-fit: contain; margin: 0 auto; display: block;" />
          </div>` : ''}
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
    const showBreakdown = effectiveShowTaxBreakdown(template, options, data);
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
          <td class="c">${item.gstRate != null ? formatItemGstRate(item.gstRate) : '-'}</td>
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
            .logo { max-height: 55px; max-width: 180px; width: auto; height: auto; object-fit: contain; margin-bottom: 8px; }
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
                showBreakdown
                  ? gstTotalsHtml(data).replace(/class="right"/g, 'class="r"')
                  : data.totalTax > 0
                    ? `<tr><td>Tax</td><td class="r">Rs.${data.totalTax.toFixed(2)}</td></tr>`
                    : ''
              }
              ${billChargesHtml(data).replace(/class="right"/g, 'class="r"')}
              <tr class="grand"><td>Grand Total</td><td class="r">Rs.${data.grandTotal.toFixed(2)}</td></tr>
              <tr><td>Paid Amount</td><td class="r">Rs.${paid.toFixed(2)}</td></tr>
              ${balance > 0 ? `<tr><td>Balance Due</td><td class="r">Rs.${balance.toFixed(2)}</td></tr>` : ''}
            </table>
          </div>

          ${this.upiQrHtml(data, 'mm' as any, options?.receiptQrSize)}

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
    const LABEL_W_DOTS = Math.max(160, labelWidthMm * DOTS_PER_MM);
    const LABEL_H_DOTS = Math.max(160, labelHeightMm * DOTS_PER_MM);
    const MARGIN_2MM = 16; // Standard 2mm minimum margin = 16 dots at 203 DPI

    const isLargeLabel = labelHeightMm >= 45 || labelWidthMm >= 60;
    const fontMul = isLargeLabel && labelWidthMm >= 50 ? 1 : 1;
    const fontHeightDots = 24 * fontMul;
    const FONT3_CHAR_W = 16 * fontMul;

    const rawCode = product.barcode || product.sku || `PROD-${product.id?.slice(-6) || '1234'}`;

    // Max characters that can fit on top line with 2mm side margins
    const maxNameChars = Math.max(4, Math.floor((LABEL_W_DOTS - MARGIN_2MM * 2) / FONT3_CHAR_W));
    const displayName = product.name.length > maxNameChars ? `${product.name.slice(0, maxNameChars - 1)}…` : product.name;
    const priceText = `Rs.${product.sellingPrice.toFixed(2)}`;

    // Estimate total content height to center vertically
    const barHeight = Math.min(130, Math.max(54, Math.round(LABEL_H_DOTS * (isLargeLabel ? 0.36 : 0.28))));
    const codeEstimateH = format === 'qr' ? Math.min(LABEL_W_DOTS * 0.5, LABEL_H_DOTS * 0.5) : barHeight + 20;
    const totalEstimatedH = fontHeightDots * 2 + 16 + codeEstimateH;

    const startY = Math.max(MARGIN_2MM, Math.round((LABEL_H_DOTS - totalEstimatedH) / 2));

    // 1. Name Text — Centered Horizontally
    const nameWidthDots = displayName.length * FONT3_CHAR_W;
    const nameX = Math.max(MARGIN_2MM, Math.round((LABEL_W_DOTS - nameWidthDots) / 2));
    const nameY = startY;

    // 2. Price Text — Centered Horizontally below Name
    const priceWidthDots = priceText.length * FONT3_CHAR_W;
    const priceX = Math.max(MARGIN_2MM, Math.round((LABEL_W_DOTS - priceWidthDots) / 2));
    const priceY = nameY + fontHeightDots + (isLargeLabel ? 8 : 4);

    const text = [
      {
        text: displayName,
        x: nameX,
        y: nameY,
        fonttype: NativeTscPrinter.FONTTYPE?.FONT_3 ?? '3',
        rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
        xscal: fontMul,
        yscal: fontMul,
      },
      {
        text: priceText,
        x: priceX,
        y: priceY,
        fonttype: NativeTscPrinter.FONTTYPE?.FONT_3 ?? '3',
        rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
        xscal: fontMul,
        yscal: fontMul,
        bold: true,
      },
    ];

    // 3. Code Zone (QR Code or Barcode) — Positioned below price
    const codeZoneY = priceY + fontHeightDots + (isLargeLabel ? 12 : 6);
    const maxBottomY = Math.round(LABEL_H_DOTS - MARGIN_2MM);
    const maxCodeH = Math.max(40, maxBottomY - codeZoneY);

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

      const targetQrDots = isLargeLabel
        ? Math.min(240, Math.round(LABEL_H_DOTS * 0.48))
        : Math.min(160, Math.max(120, Math.round(LABEL_H_DOTS * 0.45)));

      let cellWidth = Math.max(2, Math.floor(targetQrDots / qrModules));
      let qrSize = qrModules * cellWidth;

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
      const barY = codeZoneY + 4;
      const targetMinW = Math.min(LABEL_W_DOTS - MARGIN_2MM * 2, isLargeLabel ? 320 : 280);
      const targetMaxW = Math.min(LABEL_W_DOTS - MARGIN_2MM * 2, isLargeLabel ? 360 : 320);

      if (effectiveFormat === 'ean13') {
        const digits = rawCode.replace(/\D/g, '');
        const EAN13_MODULES = 95;
        const narrow = LABEL_W_DOTS >= 480 ? 4 : 3;
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
        let narrow = Math.min(3, Math.max(2, Math.floor(targetMaxW / estModules)));
        let barWidth = estModules * narrow;

        if (barWidth < targetMinW && narrow < 4) {
          narrow = Math.min(4, Math.ceil(targetMinW / estModules));
          barWidth = estModules * narrow;
        }

        const barX = Math.max(MARGIN_2MM, Math.round((LABEL_W_DOTS - Math.min(targetMaxW, barWidth)) / 2));

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

  // ---------------------------------------------------------------------------
  // DothanTech / Josh LPAPI label printers
  //
  // These are a separate transport, not another ESC/POS device: LPAPI owns its own
  // Bluetooth connection and takes drawing calls in millimetres instead of raw TSPL
  // bytes. LabelTemplate already stores geometry in mm, so it maps across directly
  // without the dots conversion the TSPL path needs.
  // ---------------------------------------------------------------------------

  /**
   * Coerces a value to a finite integer for the TSPL bridge.
   *
   * The native printLabel reads most numbers with ReadableMap.getInt(), which throws
   * on null, undefined or NaN instead of defaulting — and one throw aborts the whole
   * label. A template that reaches us without widthMm/heightMm (older saved layouts,
   * or a backend JSON round-trip that dropped them) turns straight into NaN here, so
   * every number handed to the bridge goes through this first. The hardcoded test
   * label never hit this, which is why it printed while designed labels did not.
   */
  private safeInt(value: unknown, fallback: number): number {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * Same guard for the LPAPI path, which works in fractional millimetres rather than
   * integer dots. LPAPI accepts NaN coordinates without complaint and then produces a
   * blank or failed job — exactly the "test label prints but my designed label doesn't"
   * failure — so every mm value handed to the Josh bridge goes through this first.
   */
  private safeMm(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * Resolves a Label Studio image URI into something the native LPAPI bridge can open:
   * file paths and content:// URIs pass straight through (the bridge handles both),
   * while remote http(s) and data: URIs are materialised into the cache directory.
   * Returns null when the image can't be resolved — the caller skips that element
   * rather than failing the whole label.
   */
  private async resolveJoshImageUri(uri: string): Promise<string | null> {
    const trimmed = String(uri || '').trim();
    if (!trimmed) return null;

    if (
      trimmed.startsWith('file://') ||
      trimmed.startsWith('content://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('/')
    ) {
      return trimmed;
    }

    try {
      const FileSystem = require('expo-file-system');

      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        let hash = 0;
        for (let i = 0; i < trimmed.length; i++) hash = ((hash << 5) - hash + trimmed.charCodeAt(i)) | 0;
        const target = `${FileSystem.cacheDirectory || ''}josh_label_img_${Math.abs(hash)}.img`;
        const existing = await FileSystem.getInfoAsync(target);
        if (existing.exists) return target;
        const result = await FileSystem.downloadAsync(trimmed, target);
        return result?.status === 200 ? target : null;
      }
    } catch (e) {
      console.warn('[PrinterService] could not resolve remote image for LPAPI printing:', e);
    }
    return trimmed;
  }

  /** True only on a native build where the vendored LPAPI SDK actually linked. */
  public isJoshLabelPrinterAvailable(): boolean {
    return isJoshPrinterSupported();
  }

  // ---------------------------------------------------------------------------------
  // YX label printers (modules/yx-label-printer) — the second non-ESC/POS vendor.
  //
  // Deliberately funnelled through the same label pipeline as Josh rather than given a
  // parallel one: both consume the identical element spec, so everything upstream
  // (Label Studio, the products barcode dialog, POS) builds one label and stays unaware
  // of which vendor is on the other end. Only the final hand-off differs.
  // ---------------------------------------------------------------------------------

  /** True only on a native build where the YX SDK actually linked. */
  public isYxLabelPrinterAvailable(): boolean {
    return isYxPrinterSupported();
  }

  private tejReconnectInFlight: Promise<boolean> | null = null;
  private tejReconnectFailedAt = 0;
  private static readonly TEJ_RECONNECT_COOLDOWN_MS = 30000;

  public isTejSupported(): boolean {
    return true;
  }

  public async tejIsConnected(): Promise<boolean> {
    if (YxLabelPrinter) {
      try {
        if (await YxLabelPrinter.isConnected()) return true;
      } catch {}
    }
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      const model = usePrinterStore.getState().connectedPrinterModel;
      if (model === 'tej') {
        if (await this.isSocketConnected()) return true;
      }
    } catch {}
    return false;
  }

  public async tejStartDiscovery(): Promise<boolean> {
    if (!YxLabelPrinter) return false;
    return YxLabelPrinter.startDiscovery();
  }

  public async tejStopDiscovery(): Promise<boolean> {
    if (!YxLabelPrinter) return false;
    return YxLabelPrinter.stopDiscovery();
  }

  public async tejGetPairedPrinters(): Promise<{ address: string; name: string }[]> {
    const list: { address: string; name: string }[] = [];
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      const store = usePrinterStore.getState();
      const storeDevices = [...(store.pairedPrinters || []), ...(store.scannedDevices || [])];
      for (const d of storeDevices) {
        if (d.id && !list.some((x) => x.address === d.id)) {
          list.push({ address: d.id, name: d.name || d.id });
        }
      }
    } catch {}
    if (YxLabelPrinter) {
      try {
        const yxList = await YxLabelPrinter.getPairedPrinters();
        for (const d of yxList) {
          if (d.address && !list.some((x) => x.address === d.address)) {
            list.push(d);
          }
        }
      } catch {}
    }
    return list;
  }

  public async tejConnect(address: string, name?: string): Promise<boolean> {
    // If Josh is connected, disconnect it cleanly
    try {
      if (JoshLabelPrinter && typeof JoshLabelPrinter.disconnect === 'function') {
        await JoshLabelPrinter.disconnect();
      }
    } catch {}
    // If YX was connected, disconnect it cleanly
    if (YxLabelPrinter) {
      try {
        await YxLabelPrinter.disconnect();
      } catch {}
    }

    let ok = false;
    // Primary bridge for TEJ: YX native SDK (dedicated label printer SDK with gap sensing)
    if (this.isYxLabelPrinterAvailable() && YxLabelPrinter) {
      try {
        ok = await YxLabelPrinter.connect(address);
      } catch (yxErr) {
        console.warn('[PrinterService] tejConnect via YX native SDK failed:', yxErr);
      }
    }

    // Secondary fallback: standard Bluetooth socket if YX native SDK fails
    if (!ok) {
      try {
        ok = await this.connect(address, name);
      } catch (err) {
        console.warn('[PrinterService] tejConnect fallback via standard Bluetooth failed:', err);
        ok = false;
      }
    }

    if (ok) {
      const printerName = name || 'SEZNIK TEJ';
      setStoredTejPrinter({ address, name: printerName }).catch(() => {});
      this.tejReconnectFailedAt = 0;
      this.activeDevice = {
        id: address,
        name: printerName,
        macAddress: address,
        type: 'dual',
        connected: true,
      };
      this.warningText = '';
      this.connectionState = 'connected';
      try {
        const { usePrinterStore } = require('../store/usePrinterStore');
        usePrinterStore.getState().setConnectedPrinterModel('tej');
      } catch {}
      this.notifyStatusChange('connected', true);
      playPrinterConnectFeedback();
      logPrinterConnection({
        printerName,
        deviceAddress: address || null,
        platform: 'mobile',
        connectionType: 'bluetooth',
      });
    }
    return ok;
  }

  public async tejDisconnect(): Promise<boolean> {
    setStoredTejPrinter(null).catch(() => {});
    let ok = false;
    if (YxLabelPrinter) {
      try {
        ok = await YxLabelPrinter.disconnect();
      } catch {}
    }
    try {
      await this.disconnect();
      ok = true;
    } catch {}

    if (
      this.activeDevice?.type === 'dual' ||
      this.activeDevice?.name?.toUpperCase().includes('TEJ') ||
      this.activeDevice?.name?.toUpperCase().includes('YX')
    ) {
      this.activeDevice = null;
      this.connectionState = 'disconnected';
      this.notifyStatusChange('disconnected', true);
    }
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      if (usePrinterStore.getState().connectedPrinterModel === 'tej') {
        usePrinterStore.getState().setConnectedPrinterModel(null as any);
      }
    } catch {}
    return ok;
  }

  public async tejGetPrinterInfo(): Promise<{ name: string; address: string } | null> {
    if (this.activeDevice && (await this.isSocketConnected())) {
      return {
        name: this.activeDevice.name || 'SEZNIK TEJ',
        address: this.activeDevice.id || this.activeDevice.macAddress || '',
      };
    }
    if (!YxLabelPrinter) return null;
    try {
      return await YxLabelPrinter.getPrinterInfo();
    } catch {
      return null;
    }
  }

  public async tejEnsureConnected(): Promise<boolean> {
    if (await this.tejIsConnected()) {
      if (!this.activeDevice || this.connectionState !== 'connected') {
        const info = await this.tejGetPrinterInfo();
        const saved = await getStoredTejPrinter();
        const printerName = info?.name || saved?.name || 'SEZNIK TEJ';
        const address = info?.address || saved?.address || 'tej_printer';
        this.activeDevice = {
          id: address,
          name: printerName,
          macAddress: address,
          type: 'dual',
          connected: true,
        };
        this.connectionState = 'connected';
        this.notifyStatusChange('connected', true);
      }
      return true;
    }

    if (this.tejReconnectInFlight) return this.tejReconnectInFlight;

    this.tejReconnectInFlight = (async () => {
      try {
        const saved = await getStoredTejPrinter();
        if (!saved) return false;
        const ok = await this.tejConnect(saved.address, saved.name);
        return ok;
      } catch {
        return false;
      } finally {
        this.tejReconnectInFlight = null;
      }
    })();

    return this.tejReconnectInFlight;
  }

  // Aliases for backwards compatibility
  public async yxIsConnected(): Promise<boolean> {
    return this.tejIsConnected();
  }

  public async yxStartDiscovery(): Promise<boolean> {
    return this.tejStartDiscovery();
  }

  public async yxStopDiscovery(): Promise<boolean> {
    return this.tejStopDiscovery();
  }

  public async yxGetPairedPrinters(): Promise<{ address: string; name: string }[]> {
    return this.tejGetPairedPrinters();
  }

  public async yxConnect(address: string, name?: string): Promise<boolean> {
    return this.tejConnect(address, name);
  }

  public async yxDisconnect(): Promise<boolean> {
    return this.tejDisconnect();
  }

  public async yxGetPrinterInfo(): Promise<{ name: string; address: string } | null> {
    return this.tejGetPrinterInfo();
  }

  /**
   * Which non-ESC/POS label printer is live right now, if any.
   *
   * DEV, VEER, and TEJ connected via standard Bluetooth are ESC/POS + TSPL printers
   * and should never be routed to LPAPI/YX SDK.
   * When standalone JOSH or YX is active, returns 'josh' or 'yx' respectively.
   */
  public async getConnectedLabelPrinterKind(): Promise<'josh' | 'yx' | 'td404' | null> {
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      const model = usePrinterStore.getState().connectedPrinterModel;
      if (model === 'rudra' || model === 'tejas') {
        if (this.isTd404Supported() && (await this.td404IsConnected())) return 'td404';
      }
      if (model === 'tej') {
        if (this.isYxLabelPrinterAvailable() && (await YxLabelPrinter?.isConnected())) return 'yx';
      }
      if (model === 'dev' || model === 'veer') {
        if (await this.isSocketConnected()) return null;
      }
      if (model === 'josh' && this.isJoshLabelPrinterAvailable() && (await this.joshIsConnected())) return 'josh';
    } catch {}

    if (this.isTd404Supported() && (await this.td404IsConnected())) return 'td404';
    if (this.isYxLabelPrinterAvailable() && (await YxLabelPrinter?.isConnected())) return 'yx';
    if (await this.isSocketConnected()) return null;
    if (this.isJoshLabelPrinterAvailable() && (await this.joshIsConnected())) return 'josh';
    return null;
  }

  /**
   * Adapts a label spec for the YX/TEJ printer.
   *
   * This used to carry a "~6.5mm print-head offset" compensation that shrank the
   * rendered bitmap to (heightMm - 6.5) and scaled every element's y-coordinate into
   * that shorter canvas. It could not have worked: shrinking an image never moves its
   * content up the page — an element authored at y=0 is still the first thing the head
   * prints, whatever height the bitmap is. All that pass actually did was squash every
   * label's layout vertically, which is why prints stopped matching the Label Studio
   * preview. Removed for that reason, not merely simplified.
   *
   * What is left is deliberately as close to a no-op as this printer allows — mirroring
   * JoshLabelPrinter, which receives its spec with NO adaptation at all and positions
   * correctly purely on its own firmware's gap sensor (LPAPI's GAP_TYPE). YX/TEJ's
   * fixedPoint() is the equivalent native call (see nextPrint() in the Kotlin module),
   * so the same should hold here: the spec passes through unchanged, and the only field
   * added is the user's own explicit Vertical Trim, applied as a plain translation by
   * the native rasterizer — never a hidden, printer-specific size or coordinate rewrite.
   */
  public adaptSpecForYxPrinter(spec: JoshLabelSpec): JoshLabelSpec {
    if (spec.offsetAdjusted) {
      return spec;
    }
    return {
      ...spec,
      offsetAdjusted: true,
      offsetMm: this.getLabelOffsetMm(),
    };
  }

  /**
   * Sends an already-built label spec to whichever label printer is connected.
   *
   * This is the single hand-off point where the vendors diverge: LPAPI turns the
   * elements into draw commands, YX rasterizes them, and TD-404 uses pixel-perfect TSPL canvas.
   */
  private async printSpecOnLabelPrinter(spec: JoshLabelSpec): Promise<boolean> {
    const kind = await this.getConnectedLabelPrinterKind();
    if (kind === 'td404' && Td404LabelPrinter) {
      return await Td404LabelPrinter.printLabel(spec);
    }
    if (kind === 'yx' && YxLabelPrinter) {
      const adaptedSpec = this.adaptSpecForYxPrinter(spec);
      return await YxLabelPrinter.printLabel(adaptedSpec);
    }
    if (!JoshLabelPrinter) return false;
    return await JoshLabelPrinter.printLabel(spec);
  }

  /**
   * Reconnect-or-confirm for either vendor. Josh keeps its saved-printer reconnect;
   * YX is treated as connected-or-not, since it has no stored-reconnect flow yet.
   */
  public getLabelPaperMode(): 'gap' | 'continuous' {
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      return usePrinterStore.getState().labelPaperMode || 'gap';
    } catch {
      return 'gap';
    }
  }

  /**
   * Residual vertical alignment trim in mm for the blind ESC/POS raster path.
   * Deliberately NOT applied to Josh/YX/TSPL: those hand the label size to firmware,
   * which re-positions at the sensed gap on every label, so they have no standing
   * phase error to trim and adding one would actively misalign them.
   */
  public getLabelOffsetMm(): number {
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      const v = usePrinterStore.getState().labelOffsetMm;
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Whether die-cut labels on the shared ESC/POS socket should go out as TSPL rather than
   * as a rendered bitmap.
   *
   * TSPL is the only path that reaches the printer's own gap sensor: addSize(w,h) +
   * addGap(gap) hand the geometry to firmware, which re-positions at the sensed gap before
   * every label. The WYSIWYG raster path added later prints a plain bitmap and feeds a
   * computed distance, which bypasses the sensor entirely — so any mismatch between the
   * configured label pitch and the physical stock accumulates until content straddles the
   * die-cut. Labels printed correctly on this hardware at 309c03a precisely because TSPL
   * was the only route; this restores that for gap stock while leaving the raster to
   * continuous rolls (no gap to sense) and to printers that really do render bitmaps.
   */
  private preferTsplForLabels(): boolean {
    if (!NativeTscPrinter || typeof NativeTscPrinter.printLabel !== 'function') return false;
    if (this.getLabelPaperMode() === 'continuous') return false;
    // TEJ must NEVER go through TSPL. This was tried directly and the result was not
    // misalignment — it was the literal TSPL command text (SIZE/GAP/DIRECTION/TEXT/
    // PRINT) printed as plain readable characters on the label, confirmed from a device
    // photo. That means this printer's firmware does not parse TSPL as commands at all;
    // it just echoes whatever bytes it receives as text, the same as its ESC/POS receipt
    // mode does. TSPL is provably not an option for this hardware, not merely unreliable.
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      const model = usePrinterStore.getState().connectedPrinterModel;
      if (model === 'tej') return false;
    } catch {}
    const activeName = (this.activeDevice?.name || '').toUpperCase();
    if (activeName.includes('TEJ')) return false;
    return true;
  }

  public getLabelEngine(): 'graphic' | 'tspl' {
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      return usePrinterStore.getState().labelEngine || 'graphic';
    } catch {
      return 'graphic';
    }
  }

  public getEscPosPaperWidth(): '58mm' | '80mm' {
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      return usePrinterStore.getState().paperWidth || '58mm';
    } catch {
      return '58mm';
    }
  }

  public async yxCalibrate(gapType?: number): Promise<boolean> {
    if (!YxLabelPrinter || typeof (YxLabelPrinter as any).calibrate !== 'function') return false;
    try {
      const gType = typeof gapType === 'number' ? gapType : (this.getLabelPaperMode() === 'continuous' ? 0 : 2);
      // The printer needs its real physical label size (CreatePage, sent inside the
      // native calibrate implementation) before positioning against it means anything —
      // pulling the configured roll size here rather than leaving it to a hardcoded
      // default is the same fix as nextPrint()'s CreatePage call, applied to the
      // standalone Calibrate button.
      let widthMm = 50;
      let heightMm = 30;
      try {
        const { usePrinterStore } = require('../store/usePrinterStore');
        const s = usePrinterStore.getState();
        widthMm = s.labelWidthMm || 50;
        heightMm = s.labelHeightMm || 30;
      } catch {
        // Fall through to the defaults above.
      }
      return await (YxLabelPrinter as any).calibrate(gType, widthMm, heightMm);
    } catch (e) {
      console.warn('[PrinterService] yxCalibrate failed:', e);
      return false;
    }
  }

  /**
   * Converts any JoshLabelSpec (custom template or auto-layout) into a high-res (203 DPI)
   * monochrome PNG base64 string via the phone's native Android Canvas rasterizer.
   */
  public async rasterizeLabelSpec(spec: JoshLabelSpec, headMm: number = 48): Promise<string | null> {
    try {
      if (YxLabelPrinter && typeof (YxLabelPrinter as any).rasterizeLabelBase64 === 'function') {
        return await (YxLabelPrinter as any).rasterizeLabelBase64({ ...spec, headMm });
      }
      if (JoshLabelPrinter && typeof (JoshLabelPrinter as any).rasterizeLabelBase64 === 'function') {
        return await (JoshLabelPrinter as any).rasterizeLabelBase64({ ...spec, headMm });
      }
    } catch (e) {
      console.warn('[PrinterService] rasterizeLabelSpec failed:', e);
    }
    return null;
  }

  /**
   * Prints any JoshLabelSpec onto a standard Bluetooth ESC/POS thermal printer (DEV / VEER) as a pixel-perfect
   * graphic. Solves alignment, custom templates, and cross-gap splitting on normal receipt/label printers.
   */
  public async printSpecViaEscposGraphic(
    spec: JoshLabelSpec,
    paperWidth: '58mm' | '80mm' = '58mm',
    copies: number = 1,
    labelGapMm: number = 2
  ): Promise<boolean> {
    if (!NativeEscposPrinter || typeof NativeEscposPrinter.printPic !== 'function') return false;

    const paperSizeDots = paperWidth === '80mm' ? 576 : 384;
    const headMm = paperWidth === '80mm' ? 72 : 48;

    // Attach user-calibrated offsetMm to spec for Android Canvas translation
    const userOffsetMm = this.getLabelOffsetMm();
    const effectiveSpec: JoshLabelSpec & { offsetMm?: number } = {
      ...spec,
      offsetMm: (spec as any).offsetMm ?? userOffsetMm,
    };

    const base64 = await this.rasterizeLabelSpec(effectiveSpec, headMm);
    if (!base64) {
      console.warn('[PrinterService] printSpecViaEscposGraphic: could not rasterize label spec');
      return false;
    }

    await this.initPrinter(paperWidth);

    const labelWidthDots = Math.min(paperSizeDots, Math.round(spec.widthMm * 8));
    // Gap feed dots: ensures the printer head advances across the die-cut gap to the top of the
    // next label. The 16-dot (2mm) floor only makes sense for die-cut mode, where SOME gap must
    // physically exist for the label to be a separate sticker at all — a continuous roll has no
    // die-cut, so forcing that same floor there inserted an unwanted ~2mm of blank paper between
    // every print regardless of what was actually configured, which is its own kind of
    // misalignment on a roll meant to print flush.
    const isContinuous = spec.gapType === 0 || this.getLabelPaperMode() === 'continuous';
    const feedDots = isContinuous
      ? Math.max(0, Math.min(48, Math.round((labelGapMm || 0) * 8)))
      : Math.max(16, Math.min(48, Math.round((labelGapMm || 2) * 8)));

    for (let i = 0; i < Math.max(1, copies); i++) {
      await this.printEscPosBitmap(base64, {
        width: labelWidthDots,
        center: true,
        autoCut: false,
        paperSize: paperSizeDots,
        feed: feedDots,
      });

      if (this.getLabelPaperMode() !== 'continuous') {
        // Small settle delay between copies to avoid head buffer congestion
        if (i < copies - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }

    return true;
  }

  /**
   * Builds an auto-layout JoshLabelSpec for a product (name, price, barcode/QR)
   * cleanly proportioned to the specified label dimensions with safe margins,
   * matching DEV printer's tested geometry across 50x25, 50x30, 50x50, 50x75, and 50x100mm.
   */
  public buildAutoLabelSpec(
    product: { name: string; sellingPrice: number; barcode?: string | null; sku?: string | null; id?: string },
    rawCode: string,
    format: 'qr' | 'code128' | 'ean13',
    widthMmRaw: number,
    heightMmRaw: number,
    gapMm: number = 2,
    copies: number = 1,
    gapType?: number
  ): JoshLabelSpec {
    const sizeConfig = getLabelSizeConfig(widthMmRaw, heightMmRaw, gapMm);
    const widthMm = sizeConfig.widthMm;
    const heightMm = sizeConfig.heightMm;

    // Standard 1mm side margins (50mm roll has 48mm active printhead)
    const pad = 1.0;
    const innerWidth = Math.max(10, Math.min(widthMm - pad * 2, sizeConfig.printableWidthMm));

    // Dynamic vertical sizing proportionally tuned for label dimensions
    const isTiny = heightMm <= 18; // 50x15, 30x15
    const isCompact = heightMm <= 25; // 50x25, 38x25
    const isStandard = heightMm <= 35; // 50x30, 40x30, 38x28
    const isTall = heightMm >= 45; // 50x50, 60x60, 50x75, 80mm

    const nameY = isTiny ? 0.4 : isCompact ? 0.8 : isStandard ? 1.0 : isTall ? 2.0 : 1.4;
    const nameHeight = isTiny ? 1.8 : isCompact ? 2.4 : isStandard ? 3.0 : isTall ? 4.2 : 3.4;

    const priceY = nameY + nameHeight + (isTiny ? 0.2 : isCompact ? 0.4 : isTall ? 0.8 : 0.5);
    const priceHeight = isTiny ? 1.8 : isCompact ? 2.4 : isStandard ? 2.8 : isTall ? 3.8 : 3.2;

    const codeZoneY = priceY + priceHeight + (isTiny ? 0.2 : isCompact ? 0.5 : isTall ? 1.0 : 0.6);
    const bottomSafePad = isTiny ? 0.8 : isCompact ? 1.2 : isTall ? 2.0 : 1.4;
    const availableCodeH = Math.max(5.0, heightMm - codeZoneY - bottomSafePad);

    const elements: JoshLabelElement[] = [
      {
        type: 'text',
        value: this.sanitizeForThermalPrint(product.name || 'Product').slice(0, 36),
        x: pad,
        y: nameY,
        width: innerWidth,
        height: nameHeight,
        fontHeight: nameHeight,
        bold: true,
        align: 1, // center
      },
      {
        type: 'text',
        value: `Rs. ${(product.sellingPrice ?? 0).toFixed(2)}`,
        x: pad,
        y: priceY,
        width: innerWidth,
        height: priceHeight,
        fontHeight: priceHeight,
        bold: true,
        align: 1, // center
      },
    ];

    if (format === 'qr') {
      const qrCap = isTiny ? 9.0 : isCompact ? 16.0 : isStandard ? 24.0 : 42.0;
      const qrSize = Math.min(availableCodeH * 0.95, innerWidth * 0.9, qrCap);
      const qrX = Math.max(pad, (widthMm - qrSize) / 2);
      const qrY = codeZoneY + Math.max(0, (availableCodeH - qrSize) / 2);
      elements.push({
        type: 'qrcode',
        value: rawCode,
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
        size: qrSize,
      });
    } else {
      const digits = rawCode.replace(/\D/g, '');
      const useEan13 = format === 'ean13' && (digits.length === 12 || digits.length === 13);
      const barCap = isTiny ? 7.0 : isCompact ? 14.0 : isStandard ? 20.0 : 32.0;
      const totalBoxH = Math.min(availableCodeH * 0.9, barCap);
      const textHeight = Math.min(2.8, Math.max(1.4, totalBoxH * 0.22));

      const barWidth = useEan13 ? Math.min(innerWidth * 0.92, 42.0) : Math.min(innerWidth * 0.92, 45.0);
      const barX = Math.max(pad, (widthMm - barWidth) / 2);
      const barY = codeZoneY + Math.max(0, (availableCodeH - totalBoxH) / 2);

      elements.push({
        type: 'barcode',
        value: useEan13 ? digits : rawCode.replace(/[^\x20-\x7E]/g, ''),
        x: barX,
        y: barY,
        width: barWidth,
        height: totalBoxH,
        textHeight,
        barcodeType: useEan13 ? JOSH_BARCODE_TYPE_EAN13 : JOSH_BARCODE_TYPE_CODE128,
        align: 1, // center
      });
    }

    const resolvedGapType = typeof gapType === 'number' ? gapType : (this.getLabelPaperMode() === 'continuous' ? 0 : 2);

    return {
      widthMm,
      heightMm,
      rotation: 0,
      copies: Math.max(1, copies),
      gapMm: sizeConfig.gapMm,
      gapType: resolvedGapType,
      speed: 5,
      darkness: 7,
      elements,
    };
  }

  /**
   * Reconnect-or-confirm for either vendor. Josh keeps its saved-printer reconnect;
   * TEJ uses tejEnsureConnected. DEV/VEER are ESC/POS printers and never hijack this.
   */
  public async labelPrinterEnsureConnected(): Promise<boolean> {
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      const model = usePrinterStore.getState().connectedPrinterModel;
      if (model === 'dev' || model === 'veer') {
        return false;
      }
      if (model === 'tej') return await this.tejEnsureConnected();
      if (model === 'josh') return await this.joshEnsureConnected();
    } catch {}

    if (await this.tejEnsureConnected()) return true;
    if (await this.joshEnsureConnected()) return true;
    return false;
  }

  /**
   * The no-saved-template layout (name / price / code) drawn on the label printer.
   * Proportional to the label so it holds up across every stock size rather than
   * assuming the 50x30mm default.
   */
  private async printAutoLabelViaJosh(
    product: { name: string; sellingPrice: number; barcode?: string | null; sku?: string | null; id?: string },
    rawCode: string,
    format: 'qr' | 'code128' | 'ean13',
    widthMmRaw: number,
    heightMmRaw: number,
    gapMm: number,
    copies: number = 1
  ): Promise<boolean> {
    if (!JoshLabelPrinter && !YxLabelPrinter) return false;

    const gapType = this.getLabelPaperMode() === 'continuous' ? 0 : 2;
    const spec = this.buildAutoLabelSpec(
      product,
      rawCode,
      format,
      widthMmRaw,
      heightMmRaw,
      gapMm,
      copies,
      gapType
    );

    return this.printSpecOnLabelPrinter(spec);
  }

  public isJoshSupported(): boolean {
    return Boolean(JoshLabelPrinter);
  }

  public isYxSupported(): boolean {
    return this.isYxLabelPrinterAvailable();
  }

  public async joshStartDiscovery(): Promise<boolean> {
    if (!JoshLabelPrinter) return false;
    return JoshLabelPrinter.startDiscovery();
  }

  public async joshStopDiscovery(): Promise<boolean> {
    if (!JoshLabelPrinter) return false;
    return JoshLabelPrinter.stopDiscovery();
  }

  public async joshGetPairedPrinters(): Promise<{ address: string; name: string }[]> {
    if (!JoshLabelPrinter) return [];
    return JoshLabelPrinter.getPairedPrinters();
  }

  public async joshConnect(address: string, name?: string): Promise<boolean> {
    if (!JoshLabelPrinter) return false;
    // Release ESC/POS Bluetooth socket if holding the device so LPAPI RFCOMM channel is free
    try {
      if (NativeBluetoothManager && typeof NativeBluetoothManager.disconnect === 'function') {
        await NativeBluetoothManager.disconnect(address);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } catch {}
    const ok = await JoshLabelPrinter.connect(address, name);
    if (ok) {
      const printerName = name || 'JOSH Printer';
      setStoredJoshPrinter({ address, name: printerName }).catch(() => {});
      this.joshReconnectFailedAt = 0;
      this.activeDevice = {
        id: address,
        name: printerName,
        macAddress: address,
        type: 'dual',
        connected: true,
      };
      this.warningText = '';
      this.connectionState = 'connected';
      this.notifyStatusChange('connected', true);
      playPrinterConnectFeedback();
      logPrinterConnection({
        printerName,
        deviceAddress: address || null,
        platform: 'mobile',
        connectionType: 'bluetooth',
      });
    }
    return ok;
  }

  public async joshDisconnect(): Promise<boolean> {
    if (!JoshLabelPrinter) return false;
    // A user-initiated disconnect means "stop using the label printer" — forget it,
    // otherwise the next label print would silently re-link the device they just removed.
    setStoredJoshPrinter(null).catch(() => {});
    const ok = await JoshLabelPrinter.disconnect();
    if (
      this.activeDevice?.type === 'dual' ||
      this.activeDevice?.name?.toUpperCase().includes('JOSH') ||
      this.activeDevice?.name?.toUpperCase().startsWith('LD') ||
      this.activeDevice?.name?.toUpperCase().startsWith('LP')
    ) {
      this.activeDevice = null;
      this.connectionState = 'disconnected';
      this.notifyStatusChange('disconnected', true);
    }
    return ok;
  }

  /** Name/address of the connected label printer, for showing which one is live. */
  public async joshGetPrinterInfo(): Promise<{ name: string; address: string } | null> {
    if (!JoshLabelPrinter) return null;
    try {
      return await JoshLabelPrinter.getPrinterInfo();
    } catch {
      return null;
    }
  }

  public async joshIsConnected(): Promise<boolean> {
    if (!JoshLabelPrinter) return false;
    try {
      return await JoshLabelPrinter.isConnected();
    } catch {
      return false;
    }
  }

  /**
   * The connected label printer's physical printable width in mm (LD0801: 48mm),
   * reported by the printer itself. 0 when unknown/not connected.
   */
  private async getJoshHeadWidthMm(): Promise<number> {
    if (!JoshLabelPrinter) return 0;
    try {
      const info = await JoshLabelPrinter.getPrinterInfo();
      const w = Number(info?.widthMm);
      return Number.isFinite(w) && w > 0 ? w : 0;
    } catch {
      return 0;
    }
  }

  // -------------------------------------------------------------------------
  // TD-404 / Ninestar SDK (SEZNIK RUDRA & SEZNIK TEJAS)
  // -------------------------------------------------------------------------

  public isTd404Supported(): boolean {
    return isTd404PrinterSupported();
  }

  public async td404GetBondedDevices(): Promise<{ address: string; name: string }[]> {
    if (!Td404LabelPrinter) return [];
    try {
      return await Td404LabelPrinter.getBondedDevices();
    } catch {
      return [];
    }
  }

  public async td404Connect(address: string, name?: string): Promise<boolean> {
    if (!Td404LabelPrinter) return false;
    try {
      if (NativeBluetoothManager && typeof NativeBluetoothManager.disconnect === 'function') {
        await NativeBluetoothManager.disconnect(address).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } catch {}

    try {
      const connectPromise = Td404LabelPrinter.connect(address, name);
      const timeoutPromise = new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Printer did not respond.')), 12000)
      );
      const ok = await Promise.race([connectPromise, timeoutPromise]);
      if (ok) {
        const printerName = name || 'TD-404 Printer';
        this.activeDevice = {
          id: address,
          name: printerName,
          macAddress: address,
          type: 'dual',
          connected: true,
        };
        this.warningText = '';
        this.connectionState = 'connected';
        this.notifyStatusChange('connected', true);
        try {
          playPrinterConnectFeedback();
        } catch {}
        try {
          logPrinterConnection({
            printerName,
            deviceAddress: address || null,
            platform: 'mobile',
            connectionType: 'bluetooth',
          }).catch(() => {});
        } catch {}
      }
      return Boolean(ok);
    } catch (err: any) {
      console.warn('[PrinterService] td404Connect error:', err);
      return false;
    }
  }

  public async td404Disconnect(): Promise<boolean> {
    if (!Td404LabelPrinter) return false;
    const ok = await Td404LabelPrinter.disconnect();
    if (this.activeDevice?.macAddress) {
      this.activeDevice = null;
      this.connectionState = 'disconnected';
      this.notifyStatusChange('disconnected', true);
    }
    return ok;
  }

  public async td404IsConnected(): Promise<boolean> {
    if (!Td404LabelPrinter) return false;
    try {
      return Td404LabelPrinter.isConnected();
    } catch {
      return false;
    }
  }

  public async td404PrintLabel(
    base64Png: string,
    widthMm: number = 50,
    heightMm: number = 30,
    gapMm: number = 2,
    copies: number = 1
  ): Promise<boolean> {
    if (!Td404LabelPrinter) return false;
    return await Td404LabelPrinter.printLabelBitmap(base64Png, widthMm, heightMm, gapMm, copies);
  }

  public async td404PrintReceipt(base64Png: string, paperWidthMm: number = 80): Promise<boolean> {
    if (!Td404LabelPrinter) return false;
    return await Td404LabelPrinter.printReceiptBitmap(base64Png, paperWidthMm);
  }

  public async td404PrintReceiptText(text: string, is80mm: boolean = true): Promise<boolean> {
    if (!Td404LabelPrinter) return false;
    return await Td404LabelPrinter.printReceiptText(text, is80mm);
  }

  public async td404Calibrate(): Promise<boolean> {
    if (!Td404LabelPrinter) return false;
    return await Td404LabelPrinter.calibrate();
  }

  /**
   * Prints a formatted thermal sale receipt on a connected TD-404 printer (SEZNIK RUDRA / TEJAS)
   * in continuous roll mode (gapType: 0), supporting 80mm (48-col / 576 dots) & 58mm (32-col / 384 dots) widths.
   */
  public async printReceiptViaTd404(
    data: PrintSaleData,
    paperWidth: '58mm' | '80mm' = '80mm',
    options: ReceiptPrintOptions = {}
  ): Promise<boolean> {
    if (!Td404LabelPrinter) return false;

    const is80 = paperWidth === '80mm';
    const printableWidth = is80 ? 72 : 48; // 72mm active head (576 dots) for 80mm, 48mm active head (384 dots) for 58mm
    const elements: JoshLabelElement[] = [];
    let y = is80 ? 4 : 3;

    // 1. Store Logo
    const logoUrl = data.storeLogoUrl || options.storeLogoUrl;
    if (logoUrl) {
      const logoW = Math.min(printableWidth * 0.65, is80 ? 48 : 32);
      const logoH = logoW * 0.6;
      elements.push({
        type: 'image',
        uri: logoUrl,
        x: (printableWidth - logoW) / 2,
        y,
        width: logoW,
        height: logoH,
      });
      y += logoH + (is80 ? 2.5 : 2.0);
    }

    // 2. Generate formatted receipt text
    const receiptText = this.sanitizeForThermalPrint(this.formatReceiptText(data, paperWidth, options));
    const lines = receiptText.split(/\r?\n/);
    // Must match the width formatReceiptText actually padded to, which depends on the chosen
    // receipt font (Font B is 64 cols at 80mm, not 48). Hardcoding 48 here made every line of a
    // compact-font receipt render against the wrong grid.
    const colsTarget = receiptFontCols(paperWidth, options?.receiptFont);
    const dividerDouble = '='.repeat(colsTarget);
    const dividerSingle = '-'.repeat(colsTarget);
    // Height is a hint only — `monospaceCols` below is what actually pins the grid to the full
    // print-head width (see drawElementOnCanvas in the native module).
    const baseFontH = 2.5;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        y += is80 ? 2.0 : 1.8;
        continue;
      }
      if (/^[=-]{8,}$/.test(trimmed)) {
        const isDouble = trimmed.startsWith('=');
        elements.push({
          type: 'text',
          value: isDouble ? dividerDouble : dividerSingle,
          x: 0,
          y,
          width: printableWidth,
          fontHeight: baseFontH,
          bold: false,
          align: 0,
          fontFamily: 'monospace',
          monospace: true,
          monospaceCols: colsTarget,
        });
        y += is80 ? 3.0 : 2.8;
        continue;
      }

      const colMatch = rawLine.match(/^(\s*\S(?:.*?\S)?)\s{2,}(\S.*)$/);
      if (colMatch) {
        const leftPart = colMatch[1];
        const rightPart = colMatch[2];
        const isTotalLine = /^(total|grand\s*total|net\s*payable|amount\s*paid|balance)/i.test(leftPart.trim());
        const fontH = isTotalLine ? (is80 ? 3.6 : 3.2) : baseFontH;

        // Both halves are laid out against the SAME full-width grid so the left label and the
        // right-hand amount come out at identical character size. Totals keep their deliberately
        // larger font, so they are not pinned to the grid.
        const gridCols = isTotalLine ? undefined : colsTarget;
        elements.push({
          type: 'text',
          value: leftPart.trim(),
          x: 0,
          y,
          width: printableWidth,
          fontHeight: fontH,
          bold: isTotalLine,
          align: 0,
          fontFamily: 'monospace',
          monospace: true,
          ...(gridCols ? { monospaceCols: gridCols } : {}),
        });
        elements.push({
          type: 'text',
          value: rightPart.trim(),
          x: 0,
          y,
          width: printableWidth,
          fontHeight: fontH,
          bold: isTotalLine,
          align: 2,
          fontFamily: 'monospace',
          monospace: true,
          ...(gridCols ? { monospaceCols: gridCols } : {}),
        });
        y += fontH + (is80 ? 1.2 : 1.0);
        continue;
      }

      const isCentered = rawLine.startsWith('    ') || rawLine.startsWith('\t');
      const isHeader = y < 35 && /^[A-Z0-9\s.,&-]{4,}$/.test(trimmed);
      const fontH = isHeader ? (is80 ? 3.8 : 3.4) : (options.fontSize === 'large' ? 3.2 : baseFontH);

      elements.push({
        type: 'text',
        value: trimmed,
        x: 0,
        y,
        width: printableWidth,
        fontHeight: fontH,
        bold: isHeader,
        align: isCentered || isHeader ? 1 : 0,
        fontFamily: 'monospace',
        monospace: true,
        // Headers are intentionally larger than the grid, so only body lines get pinned to it.
        ...(isHeader ? {} : { monospaceCols: colsTarget }),
      });
      y += fontH + (is80 ? 1.1 : 0.9);
    }

    // 3. Payment QR Code (UPI)
    const upiPayload = this.upiPayPayload(data);
    if (upiPayload && (options as any).enableBillQrCode !== false) {
      const qrSide = Math.min(is80 ? 32 : 24, printableWidth * 0.52);
      y += 2;
      elements.push({
        type: 'qrcode',
        value: upiPayload,
        x: (printableWidth - qrSide) / 2,
        y,
        width: qrSide,
        height: qrSide,
        size: qrSide,
      });
      y += qrSide + 2;
      elements.push({
        type: 'text',
        value: 'SCAN TO PAY VIA UPI',
        x: 0,
        y,
        width: printableWidth,
        fontHeight: is80 ? 2.5 : 2.2,
        bold: true,
        align: 1,
        fontFamily: 'monospace',
        monospace: true,
      });
      y += 4;
    }

    const totalHeightMm = Math.max(30, Math.ceil(y + 8));

    // Send to TD-404 in Continuous Mode (gapType: 0)
    return await Td404LabelPrinter.printLabel({
      widthMm: is80 ? 80 : 58,
      heightMm: totalHeightMm,
      rotation: 0,
      copies: Math.max(1, options.copies || 1),
      gapMm: 0,
      gapType: 0, // 0 = continuous roll
      speed: 5,
      darkness: 15,
      elements,
    });
  }

  /**
   * Universal Receipt Alignment Self-Test Pattern for Rudra / 80mm & 58mm Thermal Printers.
   * Prints full outer boundary, millimeter ruler, 32/48-col grid alignment, and UPI QR verification.
   */
  public async printCalibrationReceiptTest(paperWidth: '58mm' | '80mm' = '80mm'): Promise<boolean> {
    const is80 = paperWidth === '80mm';
    const printableWidth = is80 ? 72 : 48;
    const cols = is80 ? 48 : 32;

    const dummyData: PrintSaleData = {
      invoiceNumber: 'CALIB-80MM-001',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      storeName: 'SEZNIK RUDRA CALIBRATION',
      storeAddress: 'Standard 80mm & 58mm Thermal Receipt Test',
      storePhone: '+91 98765 43210',
      storeGstin: '27AAAAA0000A1Z5',
      customerName: 'Self-Test Pass',
      items: [
        { productName: 'Printhead Width Full Span', quantity: 1, unit: 'Pc', unitPrice: 100.0, total: 100.0, gstRate: 18 },
        { productName: '48-Column Monospace Grid', quantity: 1, unit: 'Pc', unitPrice: 250.0, total: 250.0, gstRate: 18 },
      ],
      subtotal: 350.0,
      totalDiscount: 0,
      totalTax: 63.0,
      grandTotal: 413.0,
      amountPaid: 413.0,
      changeReturned: 0,
      paymentMethod: 'CASH',
      footerMessage: 'Alignment Verified: Edge-to-Edge Grid OK',
    };

    return await this.printReceipt(dummyData, paperWidth, { copies: 1, includeBillQr: true });
  }

  /**
   * Checks if a Josh printer was linked. Non-blocking: logs if unreachable,
   * never throws an exception so standard ESC/POS and TSPL printers can proceed.
   */
  /**
   * Prints a formatted thermal sale receipt on a connected Josh (LPAPI) printer
   * using continuous roll mode (gapType: 0).
   */
  /**
   * Prints a formatted thermal sale receipt on a connected Josh (LPAPI) printer
   * using continuous roll mode (gapType: 0), faithfully matching the standard
   * ESC/POS receipt printing template and layout.
   */
  public async printReceiptViaJosh(
    data: PrintSaleData,
    paperWidth: '58mm' | '80mm' = '58mm',
    options: ReceiptPrintOptions = {}
  ): Promise<boolean> {
    if (!JoshLabelPrinter) return false;

    const headWidth = (await this.getJoshHeadWidthMm()) || (paperWidth === '80mm' ? 72 : 48);
    const printableWidth = Math.min(headWidth, paperWidth === '80mm' ? 72 : 48);
    const elements: JoshLabelElement[] = [];
    let y = 4; // top margin in mm

    // 1. Store Logo (if configured)
    const logoUrl = data.storeLogoUrl || options.storeLogoUrl;
    if (logoUrl) {
      const logoW = Math.min(printableWidth * 0.55, 28);
      const logoH = logoW * 0.65;
      elements.push({
        type: 'image',
        uri: logoUrl,
        x: (printableWidth - logoW) / 2,
        y,
        width: logoW,
        height: logoH,
      });
      y += logoH + 2;
    }

    // 2. Generate the exact ESC/POS receipt text from the active template/config
    const receiptText = this.sanitizeForThermalPrint(this.formatReceiptText(data, paperWidth, options));
    const lines = receiptText.split(/\r?\n/);

    const colsTarget = paperWidth === '80mm' ? 48 : 32;
    const dividerDouble = '='.repeat(colsTarget);
    const dividerSingle = '-'.repeat(colsTarget);

    // Parse and render lines into Josh elements with crisp monospace alignment
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        y += 1.8;
        continue;
      }

      // Check for divider lines (clean text dashes/equals, no thick black bars)
      if (/^[=-]{8,}$/.test(trimmed)) {
        const isDouble = trimmed.startsWith('=');
        elements.push({
          type: 'text',
          value: isDouble ? dividerDouble : dividerSingle,
          x: 0,
          y,
          width: printableWidth,
          fontHeight: 2.1,
          bold: false,
          align: 1, // Center
          fontFamily: 'monospace',
          monospace: true,
        });
        y += 2.8;
        continue;
      }

      // Check for two-column rows (e.g. "ITEM          AMOUNT", "Bill No :   INV-123", "Sub Total    400.00")
      const colMatch = rawLine.match(/^(\s*\S(?:.*?\S)?)\s{2,}(\S.*)$/);
      if (colMatch) {
        const leftPart = colMatch[1];
        const rightPart = colMatch[2].trim();
        const isGrandTotal = /GRAND TOTAL/i.test(leftPart);
        const isTableHeader = /ITEM/i.test(leftPart) && /AMOUNT|QTY/i.test(rightPart);
        const isBold = isGrandTotal || isTableHeader;
        const fontH = isGrandTotal ? 2.9 : 2.4;

        const indentMm = leftPart.startsWith('   ') ? 2.5 : leftPart.startsWith(' ') ? 1.5 : 0.5;

        // Left column
        elements.push({
          type: 'text',
          value: leftPart.trim(),
          x: indentMm,
          y,
          width: printableWidth * 0.65,
          fontHeight: fontH,
          bold: isBold,
          align: 0, // Left
          fontFamily: 'monospace',
          monospace: true,
        });

        // Right column (ends precisely at printableWidth - 0.5mm)
        elements.push({
          type: 'text',
          value: rightPart,
          x: 0.5,
          y,
          width: printableWidth - 1.0,
          fontHeight: fontH,
          bold: isBold,
          align: 2, // Right
          fontFamily: 'monospace',
          monospace: true,
        });

        y += fontH + (isGrandTotal ? 1.5 : 0.9);
        continue;
      }

      // Check if line is centered (store header, title, amount in words, footer)
      const leadingSpaces = rawLine.length - rawLine.trimStart().length;
      const isCentered = leadingSpaces >= 3 || rawLine.startsWith('   ') || trimmed === data.storeName || /BILL OF SUPPLY|TAX INVOICE/i.test(trimmed);
      const isMainHeader = trimmed.toUpperCase() === (data.storeName || options.storeName || '').trim().toUpperCase();
      const isDocTitle = /BILL OF SUPPLY|TAX INVOICE/i.test(trimmed);
      const isBold = isMainHeader || isDocTitle;
      const fontH = isMainHeader ? 3.2 : isDocTitle ? 2.8 : 2.4;

      if (isCentered) {
        elements.push({
          type: 'text',
          value: trimmed,
          x: 0,
          y,
          width: printableWidth,
          fontHeight: fontH,
          bold: isBold,
          align: 1, // Center
          fontFamily: 'monospace',
          monospace: true,
        });
      } else {
        const indentMm = rawLine.startsWith('   ') ? 2.5 : rawLine.startsWith(' ') ? 1.5 : 0.5;
        elements.push({
          type: 'text',
          value: trimmed,
          x: indentMm,
          y,
          width: printableWidth - indentMm,
          fontHeight: fontH,
          bold: isBold,
          align: 0, // Left
          fontFamily: 'monospace',
          monospace: true,
        });
      }

      y += fontH + (isMainHeader ? 1.4 : 0.9);
    }

    // 3. Dynamic UPI QR Code (if available and enabled)
    const upiPayload = this.upiPayPayload(data);
    if (upiPayload && options.includeBillQr !== false) {
      y += 1.5;
      const qrSize = Math.min(24, Math.round(printableWidth * 0.52));
      const qrX = Math.max(1, (printableWidth - qrSize) / 2);
      elements.push({
        type: 'qrcode',
        value: upiPayload,
        x: qrX,
        y,
        size: qrSize,
        align: 1,
      });
      y += qrSize + 2.0;
      elements.push({
        type: 'text',
        value: 'SCAN TO PAY VIA UPI',
        x: 0,
        y,
        width: printableWidth,
        fontHeight: 2.6,
        bold: true,
        align: 1,
        fontFamily: 'monospace',
        monospace: true,
      });
      y += 4.2;
    }

    // 4. Digital Bill PDF QR Code (if enabled)
    try {
      const { usePrinterStore } = require('../store/usePrinterStore');
      const shouldPrintBillQr = options.includeBillQr ?? usePrinterStore.getState().enableBillQrCode;
      const billPdfUrl = buildBillPdfUrl(data);
      if (shouldPrintBillQr && billPdfUrl) {
        y += 1.5;
        const qrSize = Math.min(20, Math.round(printableWidth * 0.45));
        const qrX = Math.max(1, (printableWidth - qrSize) / 2);
        elements.push({
          type: 'qrcode',
          value: billPdfUrl,
          x: qrX,
          y,
          size: qrSize,
          align: 1,
        });
        y += qrSize + 2.0;
        elements.push({
          type: 'text',
          value: 'Digital Bill Receipt',
          x: 0,
          y,
          width: printableWidth,
          fontHeight: 2.4,
          bold: false,
          align: 1,
          fontFamily: 'monospace',
          monospace: true,
        });
        y += 4.0;
      }
    } catch (qrErr) {
      console.warn('Digital Bill QR generation error (non-fatal):', qrErr);
    }

    // 5. Generous bottom feed padding for clean tearing above the cutter bar
    y += 12;
    const totalHeightMm = Math.max(45, Math.ceil(y));
    const copies = Math.max(1, options.copies || 1);

    try {
      return await this.printSpecOnLabelPrinter({
        widthMm: printableWidth,
        heightMm: totalHeightMm,
        gapType: 0, // Continuous roll!
        copies,
        speed: 5,
        darkness: 7,
        elements,
      });
    } catch (err) {
      console.error('Josh receipt print error:', err);
      return false;
    }
  }

  /**
   * Prints a Kitchen Order Ticket (KOT) on a connected Josh (LPAPI) printer
   * using continuous roll mode (gapType: 0).
   */
  public async printKotViaJosh(
    data: PrintKotData,
    paperWidth: '58mm' | '80mm' = '58mm'
  ): Promise<boolean> {
    if (!JoshLabelPrinter) return false;

    const headWidth = (await this.getJoshHeadWidthMm()) || (paperWidth === '80mm' ? 72 : 48);
    const printableWidth = Math.min(headWidth, paperWidth === '80mm' ? 72 : 48);
    const elements: JoshLabelElement[] = [];
    let y = 4;

    elements.push({
      type: 'text',
      value: 'KITCHEN ORDER TICKET',
      x: 0,
      y,
      width: printableWidth,
      fontHeight: 4.0,
      bold: true,
      align: 1,
    });
    y += 6;

    if (data.storeName) {
      elements.push({
        type: 'text',
        value: data.storeName,
        x: 0,
        y,
        width: printableWidth,
        fontHeight: 2.8,
        bold: false,
        align: 1,
      });
      y += 4.5;
    }

    const kotDivider = '-'.repeat(paperWidth === '80mm' ? 48 : 32);

    elements.push({
      type: 'text',
      value: kotDivider,
      x: 0,
      y,
      width: printableWidth,
      fontHeight: 2.2,
      align: 1,
      fontFamily: 'monospace',
      monospace: true,
    });
    y += 3.2;

    const orderNo = String(data.orderNumber || (data as any).tokenNumber || '1');
    const typeStr = (data.orderType || 'takeaway').toUpperCase();
    elements.push({ type: 'text', value: `Order #${orderNo} (${typeStr})`, x: 1, y, fontHeight: 3.2, bold: true, align: 0 });
    y += 4.5;

    if (data.tableName) {
      elements.push({ type: 'text', value: `Table: ${data.tableName}`, x: 1, y, fontHeight: 3.0, bold: true, align: 0 });
      y += 4.0;
    }

    const timeStr = data.time || ((data as any).createdAt ? new Date((data as any).createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString());
    elements.push({ type: 'text', value: `Time: ${timeStr}`, x: 1, y, fontHeight: 2.8, bold: false, align: 0 });
    if (data.waiterName) {
      elements.push({
        type: 'text',
        value: `Server: ${data.waiterName}`,
        x: 1,
        y,
        width: printableWidth - 2,
        fontHeight: 2.8,
        bold: false,
        align: 2,
      });
    }
    y += 4.5;

    elements.push({
      type: 'text',
      value: kotDivider,
      x: 0,
      y,
      width: printableWidth,
      fontHeight: 2.2,
      align: 1,
      fontFamily: 'monospace',
      monospace: true,
    });
    y += 3.2;

    elements.push({ type: 'text', value: 'ITEM', x: 1, y, fontHeight: 3.0, bold: true, align: 0 });
    elements.push({
      type: 'text',
      value: 'QTY',
      x: 1,
      y,
      width: printableWidth - 2,
      fontHeight: 3.0,
      bold: true,
      align: 2,
    });
    y += 4.5;
    elements.push({
      type: 'text',
      value: kotDivider,
      x: 0,
      y,
      width: printableWidth,
      fontHeight: 2.2,
      align: 1,
      fontFamily: 'monospace',
      monospace: true,
    });
    y += 3.2;

    for (const item of (data.items || [])) {
      const name = (item.productName || (item as any).name || 'Item').trim();
      const qty = item.quantity ?? 1;

      elements.push({
        type: 'text',
        value: name,
        x: 1,
        y,
        width: printableWidth * 0.75,
        fontHeight: 3.4,
        bold: true,
        align: 0,
      });
      elements.push({
        type: 'text',
        value: `x ${qty}`,
        x: 1,
        y,
        width: printableWidth - 2,
        fontHeight: 3.6,
        bold: true,
        align: 2,
      });
      y += 5.0;

      if (item.notes) {
        elements.push({
          type: 'text',
          value: `* Note: ${item.notes}`,
          x: 4,
          y,
          width: printableWidth - 5,
          fontHeight: 2.7,
          bold: false,
          align: 0,
        });
        y += 4.0;
      }
    }

    const kotNote = data.notes || (data as any).orderNotes;
    if (kotNote) {
      y += 1;
      elements.push({
        type: 'text',
        value: kotDivider,
        x: 0,
        y,
        width: printableWidth,
        fontHeight: 2.2,
        align: 1,
        fontFamily: 'monospace',
        monospace: true,
      });
      y += 3.2;
      elements.push({
        type: 'text',
        value: `Note: ${kotNote}`,
        x: 1,
        y,
        width: printableWidth - 2,
        fontHeight: 2.8,
        bold: false,
        align: 0,
      });
      y += 5.0;
    }

    y += 10;
    const totalHeightMm = Math.max(35, Math.ceil(y));

    try {
      return await this.printSpecOnLabelPrinter({
        widthMm: printableWidth,
        heightMm: totalHeightMm,
        gapType: 0,
        speed: 5,
        darkness: 7,
        elements,
      });
    } catch (err) {
      console.error('Josh KOT print error:', err);
      return false;
    }
  }

  /**
   * Prints a KOT Delta Ticket (modifications/voids) on a connected Josh (LPAPI) printer.
   */
  public async printKotDeltaViaJosh(
    data: PrintKotDeltaData,
    paperWidth: '58mm' | '80mm' = '58mm'
  ): Promise<boolean> {
    if (!JoshLabelPrinter) return false;

    const headWidth = (await this.getJoshHeadWidthMm()) || (paperWidth === '80mm' ? 72 : 48);
    const printableWidth = Math.min(headWidth, paperWidth === '80mm' ? 72 : 48);
    const elements: JoshLabelElement[] = [];
    let y = 4;

    elements.push({
      type: 'text',
      value: 'KOT UPDATE / DELTA',
      x: 0,
      y,
      width: printableWidth,
      fontHeight: 4.0,
      bold: true,
      align: 1,
    });
    y += 6;

    const orderNo = String(data.orderNumber || (data as any).tokenNumber || '1');
    elements.push({ type: 'text', value: `Order #${orderNo}`, x: 1, y, fontHeight: 3.2, bold: true, align: 0 });
    y += 4.5;
    if (data.tableName) {
      elements.push({ type: 'text', value: `Table: ${data.tableName}`, x: 1, y, fontHeight: 3.0, bold: true, align: 0 });
      y += 4.0;
    }

    elements.push({ type: 'line', x: 1, y, x2: printableWidth - 1, y2: y, thickness: 1 });
    y += 3.0;

    const changes = data.changes || (data as any).items || [];
    for (const item of changes) {
      const name = (item.productName || (item as any).name || 'Item').trim();
      let statusPrefix = '+ NEW: ';
      if (item.type === 'void' || (item as any).status === 'voided') statusPrefix = '- VOID: ';
      else if (item.type === 'qty_change' || (item as any).status === 'modified') statusPrefix = '~ MOD: ';

      elements.push({
        type: 'text',
        value: `${statusPrefix}${name}`,
        x: 1,
        y,
        width: printableWidth * 0.75,
        fontHeight: 3.2,
        bold: true,
        align: 0,
      });
      elements.push({
        type: 'text',
        value: `x ${item.quantity}`,
        x: printableWidth - 1,
        y,
        fontHeight: 3.4,
        bold: true,
        align: 2,
      });
      y += 4.8;
      const r = item.reason || (item as any).reason;
      if (r) {
        elements.push({
          type: 'text',
          value: `Reason: ${r}`,
          x: 4,
          y,
          fontHeight: 2.7,
          bold: false,
          align: 0,
        });
        y += 4.0;
      }
    }

    y += 10;
    const totalHeightMm = Math.max(30, Math.ceil(y));

    try {
      return await this.printSpecOnLabelPrinter({
        widthMm: printableWidth,
        heightMm: totalHeightMm,
        gapType: 0,
        elements,
      });
    } catch (err) {
      console.error('Josh KOT delta print error:', err);
      return false;
    }
  }

  /** Dedupes concurrent silent reconnects (e.g. a sequence print firing per label). */
  private joshReconnectInFlight: Promise<boolean> | null = null;
  /** When the saved printer was last unreachable — skip retrying for a cooldown window. */
  private joshReconnectFailedAt = 0;
  private static readonly JOSH_RECONNECT_COOLDOWN_MS = 30000;

  public async joshEnsureConnected(): Promise<boolean> {
    if (!this.isJoshLabelPrinterAvailable()) return false;
    if (await this.joshIsConnected()) {
      if (!this.activeDevice || this.connectionState !== 'connected') {
        const info = await this.joshGetPrinterInfo();
        const saved = await getStoredJoshPrinter();
        const printerName = info?.name || saved?.name || 'JOSH Printer';
        const address = info?.address || saved?.address || 'josh_printer';
        this.activeDevice = {
          id: address,
          name: printerName,
          macAddress: address,
          type: 'dual',
          connected: true,
        };
        this.connectionState = 'connected';
        this.notifyStatusChange('connected', true);
      }
      return true;
    }

    if (this.joshReconnectInFlight) return this.joshReconnectInFlight;

    this.joshReconnectInFlight = (async () => {
      try {
        const saved = await getStoredJoshPrinter();
        if (!saved) return false;
        const ok = await this.joshConnect(saved.address, saved.name);
        return ok;
      } catch {
        return false;
      } finally {
        this.joshReconnectInFlight = null;
      }
    })();

    return this.joshReconnectInFlight;
  }

  /**
   * Converts a designed LabelTemplate into LPAPI draw calls and prints it.
   *
   * Text sizing: fontSizePt is stored as a mm cap height (the same convention the
   * TSPL path decodes via `fontSizePt / 3`), so it is passed straight through as
   * LPAPI's fontHeight rather than being reinterpreted as points.
   *
   * Alignment is handed to LPAPI rather than pre-computed the way the TSPL path has
   * to do it, because LPAPI aligns text inside the element box itself.
   */
  public async printLabelViaJosh(
    product: Product,
    template: LabelTemplate,
    copies: number = 1,
    labelGapMm: number = 2
  ): Promise<boolean> {
    if (!JoshLabelPrinter && !YxLabelPrinter) return false;

    if (!(await this.labelPrinterEnsureConnected())) {
      console.warn('[PrinterService] no label printer reachable for this job');
      return false;
    }

    const alignToCode = (align?: 'left' | 'center' | 'right'): 0 | 1 | 2 =>
      align === 'center' ? 1 : align === 'right' ? 2 : 0;

    const rawWidthMm = this.safeMm(template.widthMm, 0);
    const rawHeightMm = this.safeMm(template.heightMm, 0);
    if (rawWidthMm <= 0 || rawHeightMm <= 0) {
      throw new Error('This label template has an invalid size. Open it in Label Studio and re-save it.');
    }

    const headMm = await this.getJoshHeadWidthMm();
    const fit = headMm > 0 && rawWidthMm > headMm ? headMm / rawWidthMm : 1;
    const widthMm = rawWidthMm * fit;
    const heightMm = rawHeightMm * fit;
    console.log(
      `[PrinterService] printLabelViaJosh: kind=${await this.getConnectedLabelPrinterKind()} ` +
      `rawW=${rawWidthMm} rawH=${rawHeightMm} headMm=${headMm} fit=${fit} -> sentW=${widthMm} sentH=${heightMm}`
    );

    const elements = await this.buildJoshElementsForTemplate(product, template, fit);

    if (elements.length === 0) {
      console.warn(
        `Label template "${template.name}" has no printable elements; printing the standard auto-layout instead.`
      );
      const rawCode = product.barcode || product.sku || `PROD-${product.id.slice(-6)}`;
      const digits = rawCode.replace(/\D/g, '');
      return await this.printAutoLabelViaJosh(
        product,
        rawCode,
        digits.length === 12 || digits.length === 13 ? 'ean13' : 'code128',
        rawWidthMm,
        rawHeightMm,
        this.safeMm(labelGapMm, 2),
        Math.max(1, copies)
      );
    }

    const gapType = this.getLabelPaperMode() === 'continuous' ? 0 : 2;
    return await this.printSpecOnLabelPrinter({
      widthMm,
      heightMm,
      rotation: 0,
      copies: Math.max(1, copies),
      gapMm: this.safeMm(labelGapMm, 3),
      gapType,
      speed: 5,
      darkness: 7,
      elements,
    });
  }

  public async buildJoshElementsForTemplate(
    product: Product,
    template: LabelTemplate,
    fit: number = 1
  ): Promise<JoshLabelElement[]> {
    const alignToCode = (align?: 'left' | 'center' | 'right'): 0 | 1 | 2 =>
      align === 'center' ? 1 : align === 'right' ? 2 : 0;

    const elements: JoshLabelElement[] = [];

    // QR+barcode combo layouts pack both codes into one label; the barcode's human-readable
    // digits have nowhere to go there and land on the price/MRP text underneath, so drop them.
    const hasQrElement = template.elements.some((e) => e.type === 'qrcode');

    for (const el of template.elements) {
      const x = this.safeMm(el.xMm, 0) * fit;
      const y = this.safeMm(el.yMm, 0) * fit;
      const w = this.safeMm(el.widthMm, 0) * fit;
      const h = this.safeMm(el.heightMm, 0) * fit;
      const rot = el.rotation || 0;

      if (el.type === 'text') {
        const value = this.sanitizeForThermalPrint(this.resolveLabelTextValue(product, el));
        if (!value) continue;
        elements.push({
          type: 'text',
          value,
          x,
          y,
          width: w,
          height: h,
          rotation: rot,
          fontHeight: this.safeMm(el.fontSizePt, 3) * fit,
          bold: !!el.bold,
          align: alignToCode(el.align),
        });
      } else if (el.type === 'barcode') {
        const raw = this.resolveLabelCodeValue(product, el);
        if (!raw || w <= 0 || h <= 0) continue;
        const digits = raw.replace(/\D/g, '');
        const isEan13 = el.format === 'ean13' && (digits.length === 12 || digits.length === 13);
        const barcodeType = isEan13
          ? JOSH_BARCODE_TYPE_EAN13
          : el.format === 'code128'
          ? JOSH_BARCODE_TYPE_CODE128
          : JOSH_BARCODE_TYPE_AUTO;

        const hideDigits = el.showText === false || hasQrElement;
        elements.push({
          type: 'barcode',
          value: isEan13 ? digits : raw.replace(/[^\x20-\x7E]/g, ''),
          x,
          y,
          width: w,
          height: h,
          rotation: rot,
          textHeight: hideDigits ? 0 : Math.max(0, Math.min(3, h * 0.2)),
          barcodeType,
        });
      } else if (el.type === 'qrcode') {
        const content = this.resolveLabelCodeValue(product, el);
        if (!content || w <= 0 || h <= 0) continue;
        elements.push({
          type: 'qrcode',
          value: content,
          x,
          y,
          rotation: rot,
          size: Math.min(w, h),
        });
      } else if (el.type === 'rect' || el.type === 'curveRect') {
        if (w <= 0 || h <= 0) continue;
        elements.push({
          type: 'rectangle',
          x,
          y,
          width: w,
          height: h,
          rotation: rot,
          thickness: Math.max(0.1, this.safeMm(el.strokeWidth, 0.3)),
          filled: !!el.fill && el.fill !== 'transparent',
          cornerRadius: el.type === 'curveRect' ? Math.max(0.5, this.safeMm(el.cornerRadiusMm, 1.5)) : 0,
        });
      } else if (el.type === 'circle') {
        if (w <= 0 || h <= 0) continue;
        elements.push({
          type: 'ellipse',
          x,
          y,
          width: w,
          height: h,
          rotation: rot,
          thickness: Math.max(0.1, this.safeMm(el.strokeWidth, 0.3)),
          filled: !!el.fill && el.fill !== 'transparent',
        });
      } else if (el.type === 'line') {
        const thickness = Math.max(0.1, this.safeMm(el.strokeWidth, Math.min(w, h) || 0.3));
        if (w >= h) {
          elements.push({ type: 'line', x, y: y + h / 2, x2: x + w, y2: y + h / 2, thickness, rotation: rot });
        } else {
          elements.push({ type: 'line', x: x + w / 2, y, x2: x + w / 2, y2: y + h, thickness, rotation: rot });
        }
      } else if (el.type === 'table') {
        if (w <= 0 || h <= 0) continue;
        const rows = Math.max(1, this.safeInt(el.rows, 1));
        const cols = Math.max(1, this.safeInt(el.cols, 1));
        const thickness = 0.2;
        elements.push({ type: 'rectangle', x, y, width: w, height: h, thickness, rotation: rot });
        for (let r = 1; r < rows; r++) {
          const yy = y + (h / rows) * r;
          elements.push({ type: 'line', x, y: yy, x2: x + w, y2: yy, thickness, rotation: rot });
        }
        for (let c = 1; c < cols; c++) {
          const xx = x + (w / cols) * c;
          elements.push({ type: 'line', x: xx, y, x2: xx, y2: y + h, thickness, rotation: rot });
        }
      } else if (el.type === 'image') {
        if (!el.uri || w <= 0 || h <= 0) continue;
        const resolvedUri = await this.resolveJoshImageUri(el.uri);
        if (!resolvedUri) {
          console.warn('[PrinterService] label image missing/unreadable, skipping element:', el.uri);
          continue;
        }
        elements.push({
          type: 'image',
          uri: resolvedUri,
          x,
          y,
          width: w,
          height: h,
          rotation: rot,
          invert: !!el.invert,
        });
      }
    }
    return elements;
  }

  /**
   * Prints a user-designed Label Studio template with the REAL product's data substituted for each
   * bound element (see src/types/labelTemplate.ts's `binding` field).
   */
  private resolveLabelTextValue(product: Product, el: LabelTextElement): string {
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
      case 'sequence':
      default:
        return el.customText || '';
    }
  }

  private resolveLabelCodeValue(product: Product, el: LabelBarcodeElement | LabelQrElement): string {
    switch (el.binding) {
      case 'barcode':
        return product.barcode || product.sku || `PROD-${product.id.slice(-6)}`;
      case 'sku':
        return product.sku || product.barcode || `PROD-${product.id.slice(-6)}`;
      case 'custom':
      default:
        return el.customValue || '';
    }
  }

  public async printLabelFromTemplate(product: Product, template: LabelTemplate, copies: number = 1, labelGapMm: number = 2): Promise<boolean> {
    const labelKind = await this.getConnectedLabelPrinterKind();
    console.log(`[PATH] printLabelFromTemplate: labelKind=${labelKind}`);
    if (labelKind === 'td404') {
      console.log('[PATH] -> printSpecOnLabelPrinter (TD404 TSPL bridge)');
      const elements = await this.buildJoshElementsForTemplate(product, template, 1);
      const spec: JoshLabelSpec = {
        widthMm: this.safeMm(template.widthMm, 50),
        heightMm: this.safeMm(template.heightMm, 30),
        rotation: 0,
        copies,
        gapMm: this.safeMm(labelGapMm, 2),
        gapType: this.getLabelPaperMode() === 'continuous' ? 0 : 2,
        elements,
      };
      return await this.printSpecOnLabelPrinter(spec);
    }
    if (labelKind === 'josh') {
      console.log('[PATH] -> printLabelViaJosh (LPAPI)');
      return await this.printLabelViaJosh(product, template, copies, labelGapMm);
    }
    if (labelKind === 'yx') {
      console.log('[PATH] -> printSpecOnLabelPrinter (YX SDK / TEJ TSPL bridge)');
      const elements = await this.buildJoshElementsForTemplate(product, template, 1);
      const spec: JoshLabelSpec = {
        widthMm: this.safeMm(template.widthMm, 50),
        heightMm: this.safeMm(template.heightMm, 30),
        rotation: 0,
        copies,
        gapMm: this.safeMm(labelGapMm, 2),
        gapType: this.getLabelPaperMode() === 'continuous' ? 0 : 2,
        elements,
      };
      return await this.printSpecOnLabelPrinter(spec);
    }

    // Ensure ESC/POS / TSPL socket is ready before printing
    await this.ensureConnected();

    const preferTspl = this.preferTsplForLabels();
    console.log(`[PATH] labelKind=null, preferTsplForLabels=${preferTspl}`);
    // Prioritize hardware TSPL with native gap sensing for connected 2-in-1 printers in die-cut label mode
    if (!preferTspl) {
      console.log('[PATH] -> ESC/POS graphic raster (printSpecViaEscposGraphic) or receipt-paper fallback');
      // Try high-resolution graphic raster for connected Bluetooth thermal ESC/POS printer (DEV / VEER)
      try {
        if (await this.isSocketConnected()) {
          const elements = await this.buildJoshElementsForTemplate(product, template, 1);
          if (elements.length > 0) {
            const spec: JoshLabelSpec = {
              widthMm: this.safeMm(template.widthMm, 50),
              heightMm: this.safeMm(template.heightMm, 30),
              rotation: 0,
              copies: 1,
              gapMm: this.safeMm(labelGapMm, 2),
              gapType: this.getLabelPaperMode() === 'continuous' ? 0 : 2,
              elements,
            };
            const ok = await this.printSpecViaEscposGraphic(
              spec,
              this.getEscPosPaperWidth(),
              copies,
              labelGapMm
            );
            if (ok) return true;
          }
        }
      } catch (graphicErr) {
        console.warn('[PrinterService] printSpecViaEscposGraphic for template failed:', graphicErr);
      }

      // Automatic hardware fallback for ESC/POS printers: use sequential ESC/POS template print
      return await this.printLabelTemplateOnReceiptPaper(
        product,
        template,
        this.getEscPosPaperWidth(),
        copies
      );
    }

    if (!NativeTscPrinter || typeof NativeTscPrinter.printLabel !== 'function') return false;

    // TSPL label jobs never go through initPrinter(), so they need their own socket check.
    await this.ensureConnected();

    const DOTS_PER_MM = 8;
    const FONT3_CHAR_W = 16;
    // Guarded: a missing/non-finite mm value becomes NaN, and the native bridge
    // throws on NaN rather than skipping that one field, which fails the label.
    const toDots = (mm: number) => this.safeInt(Number(mm) * DOTS_PER_MM, 0);

    const userOffsetMm = this.getLabelOffsetMm();
    const toYDots = (mm: number) => Math.max(0, toDots(mm + userOffsetMm));

    const textFields: any[] = [];
    const barcodeFields: any[] = [];
    const qrFields: any[] = [];
    const imageFields: any[] = [];

    const hasQrElement = (template.elements || []).some((el: any) => el.type === 'qrcode');

    // Always rasterize to one bitmap and send it via TSPL's own hardware image command,
    // rather than TSPL's raw TEXT/BARCODE/QRCODE field commands (still kept a few lines
    // below, but now only as the last-resort fallback if rasterization itself fails).
    // This used to be conditional on the template having "complex" shape elements
    // (rect/line/circle/table) — a plain text+barcode label would skip the bitmap and go
    // straight to TSPL's TEXT command, which sends raw strings through a GB2312 encode
    // step (see RNBluetoothTscPrinterModule.printLabel) and a device-chosen FONTTYPE. On
    // this printer that produced literal on-label gibberish — confirmed by device logs:
    // preferTsplForLabels() correctly resolved true, so this really was TSPL's own text
    // path at fault, not a routing mistake. The bitmap path sends only pixels; there is no
    // font or encoding step for the firmware to get wrong.
    console.log('[PATH] -> TSPL rasterize-to-bitmap branch (always, not just for complex elements)');
    try {
      const rawElements = await this.buildJoshElementsForTemplate(product, template, 1);
      const elements = userOffsetMm !== 0
        ? rawElements.map((el) => ({ ...el, y: Math.max(0, el.y + userOffsetMm) }))
        : rawElements;
      const spec: JoshLabelSpec = {
        widthMm: this.safeMm(template.widthMm, 50),
        heightMm: this.safeMm(template.heightMm, 30),
        rotation: 0,
        copies: 1,
        gapMm: this.safeMm(labelGapMm, 2),
        gapType: this.getLabelPaperMode() === 'continuous' ? 0 : 2,
        elements,
      };
      // 48mm = this printer's actual printable head width (384 dots at 8 dots/mm), the
      // same constant used everywhere else a label gets rasterized for this hardware.
      // The previous call here passed the template's own width as headMm, which meant
      // no clamping ever happened — a 50mm-wide template rasterized at full 50mm/400
      // dots, wider than the head can physically mark, then got resized a second time
      // inside TSPL's own addBitmap. Passing 48 here and the SAME clamped width below
      // makes that second resize a no-op instead of a mismatched double-scale.
      const tsplHeadMm = 48;
      const base64 = await this.rasterizeLabelSpec(spec, tsplHeadMm);
      if (base64) {
        imageFields.push({
          x: 0,
          y: 0,
          width: toDots(Math.min(this.safeMm(template.widthMm, 50), tsplHeadMm)),
          mode: 0,
          image: base64,
        });
      }
    } catch (rastErr) {
      console.warn('[PrinterService] TSPL rasterization failed, falling back to field extraction:', rastErr);
    }

    if (!imageFields.length) {
      for (const el of template.elements) {
        if (el.type === 'text') {
          const value = this.sanitizeForThermalPrint(this.resolveLabelTextValue(product, el));
          if (!value) continue;
          // fontSizePt is stored in mm (24 dots = 3mm at FONT_3's native 1x cell height) — derive the
          // nearest whole TSPL FONTMUL scale from it, same convention buildTsplLabelFields assumes.
          const scale = Math.min(10, Math.max(1, this.safeInt(Number(el.fontSizePt) / 3, 1)));
          const boxWidthDots = toDots(el.widthMm);
          const textWidthDots = value.length * FONT3_CHAR_W * scale;
          let xDots = toDots(el.xMm);
          if (el.align === 'center') xDots += Math.max(0, Math.round((boxWidthDots - textWidthDots) / 2));
          else if (el.align === 'right') xDots += Math.max(0, boxWidthDots - textWidthDots);

          textFields.push({
            text: value,
            x: xDots,
            y: toYDots(el.yMm),
            fonttype: NativeTscPrinter.FONTTYPE?.FONT_3 ?? '3',
            rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
            xscal: scale,
            yscal: scale,
            bold: !!el.bold,
          });
        } else if (el.type === 'barcode') {
          const raw = this.resolveLabelCodeValue(product, el);
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
          const narrow = Math.min(4, Math.max(1, this.safeInt(toDots(el.widthMm) / moduleCount, 1)));
          const shouldShowBarcodeText = el.showText !== false && !hasQrElement;
          barcodeFields.push({
            x: toDots(el.xMm),
            y: toYDots(el.yMm),
            type,
            height: toDots(el.heightMm),
            wide: narrow + 1,
            narrow,
            readable: shouldShowBarcodeText ? (NativeTscPrinter.READABLE?.EANBLE ?? 1) : (NativeTscPrinter.READABLE?.DISABLE ?? 0),
            rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
            code: content,
          });
        } else if (el.type === 'qrcode') {
          const content = this.resolveLabelCodeValue(product, el);
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
          const cellWidth = Math.max(2, Math.min(10, this.safeInt(boxDots / qrModules, 2)));
          qrFields.push({
            x: toDots(el.xMm),
            y: toYDots(el.yMm),
            level: NativeTscPrinter.EEC?.LEVEL_M ?? 'M',
            width: cellWidth,
            rotation: NativeTscPrinter.ROTATION?.ROTATION_0 ?? 0,
            code: content,
          });
        } else if (el.type === 'image' && el.uri) {
          try {
            const base64Pic = await this.uriToBase64(el.uri);
            if (base64Pic) {
              imageFields.push({
                x: toDots(el.xMm),
                y: toYDots(el.yMm),
                width: toDots(el.widthMm),
                mode: 0,
                image: base64Pic,
              });
            }
          } catch (imgErr) {
            console.warn('TSPL image element conversion failed:', imgErr);
          }
        }
      }
    }

    // An empty template would otherwise go out as a valid TSPL job with no content:
    // the printer feeds one blank label and reports success, which is exactly what
    // "it prints nothing" looked like. Rather than fail, fall back to the same
    // auto-layout the Test Label button uses (printCustomLabel -> buildTsplLabelFields),
    // which is the path already proven to print on this hardware.
    if (!textFields.length && !barcodeFields.length && !qrFields.length && !imageFields.length) {
      console.warn(
        `Label template "${template.name}" has no printable elements; using the built-in auto-layout instead.`
      );
      const digits = (product.barcode || product.sku || '').replace(/\D/g, '');
      return this.printCustomLabel(
        product,
        digits.length === 12 || digits.length === 13 ? 'ean13' : 'code128',
        undefined,
        this.safeInt(template.widthMm, 50),
        this.safeInt(template.heightMm, 30),
        this.safeInt(labelGapMm, 2)
      );
    }

    try {
      if (NativeTscPrinter && typeof NativeTscPrinter.printLabel === 'function') {
        try {
          for (let i = 0; i < Math.max(1, copies); i++) {
            await NativeTscPrinter.printLabel({
              // Fall back to standard 50x30mm stock rather than sending NaN, which
              // the bridge rejects — failing the entire label, not just one field.
              width: this.safeInt(template.widthMm, 50),
              height: this.safeInt(template.heightMm, 30),
              gap: this.safeInt(labelGapMm, 2),
              direction: NativeTscPrinter.DIRECTION?.FORWARD ?? 0,
              reference: [0, 0],
              tear: NativeTscPrinter.TEAR?.ON ?? 'ON',
              sound: 0,
              // home is omitted: TSPL hardware gap sensor positions paper accurately at (0, 0)
              text: textFields.length ? textFields : undefined,
              barcode: barcodeFields.length ? barcodeFields : undefined,
              qrcode: qrFields.length ? qrFields : undefined,
              image: imageFields.length ? imageFields : undefined,
            });
          }
          return true;
        } catch (tscErr) {
          // Only fall back when there is no thermal printer to fall back FROM.
          // Silently diverting to the system print dialog while a printer was
          // connected is what made a failed label look like a successful one:
          // the fallback returns true, so the app reported "sent" while nothing
          // ever came out of the label printer.
          if (await this.isSocketConnected()) {
            throw new Error(
              `The printer did not accept this label. ${
                tscErr instanceof Error ? tscErr.message : String(tscErr)
              }`
            );
          }
          console.warn('TSPL Bluetooth print failed, falling back to System Print framework:', tscErr);
        }
      }

      // Fallback: System Print framework (PDF / Laser / System Print dialog).
      // Reached only when no thermal printer is connected at all.
      const html = this.generateLabelFromTemplateHtml(product, template);
      await Print.printAsync({ html });
      return true;
    } catch (error) {
      console.error('printLabelFromTemplate error:', error);
      return false;
    }
  }

  /**
   * Prints a run of labels where any text element bound to `'sequence'` gets an auto-incrementing
   * value each copy — e.g. "0001","0002",... or "A01","A02",... (see parseSequencePattern). This is
   * the one shared implementation every entry point (Label Studio's own screen, BarcodePrintModal,
   * and the Printers page's Label test-print button) calls into, generalizing what used to be an
   * ad-hoc "override one hand-picked element with a raw integer suffix" loop specific to Label Studio.
   */
  public async printLabelSequence(
    product: Product,
    template: LabelTemplate,
    opts: { startPattern: string; count: number; mode: 'gap' | 'continuous'; paperWidth?: '58mm' | '80mm'; labelGapMm?: number },
    onProgress?: (done: number, total: number) => void
  ): Promise<{ ok: boolean; printedCount: number }> {
    const parsed = parseSequencePattern(opts.startPattern);
    if (!parsed) return { ok: false, printedCount: 0 };

    const count = Math.min(MAX_SEQUENCE_COUNT, Math.max(1, Math.floor(opts.count) || 1));

    // High-Speed Continuous Batch Streaming for Josh Dual-Mode Printer:
    // Submits all sequence labels as ONE multi-page print job, streaming continuously with 0 pauses!
    if ((await this.joshIsConnected()) && JoshLabelPrinter?.printLabelBatch) {
      try {
        const rawWidthMm = this.safeMm(template.widthMm, 50);
        const rawHeightMm = this.safeMm(template.heightMm, 30);
        const headMm = (await this.getJoshHeadWidthMm()) || 48;
        const fit = headMm > 0 && rawWidthMm > headMm ? headMm / rawWidthMm : 1;
        const widthMm = rawWidthMm * fit;
        const heightMm = rawHeightMm * fit;

        const batchLabels: JoshLabelSpec[] = [];
        for (let i = 0; i < count; i++) {
          const value = formatSequenceValue(parsed, i);
          const iterTemplate: LabelTemplate = {
            ...template,
            elements: template.elements.map((el) =>
              el.type === 'text' && el.binding === 'sequence'
                ? ({ ...el, binding: 'custom', customText: value } as LabelTextElement)
                : el
            ),
          };
          const elements = await this.buildJoshElementsForTemplate(product, iterTemplate, fit);
          batchLabels.push({
            widthMm,
            heightMm,
            rotation: 0,
            copies: 1,
            gapMm: this.safeMm(opts.labelGapMm ?? 3, 3),
            gapType: opts.mode === 'continuous' ? 0 : 2,
            speed: 5,
            darkness: 7,
            elements,
          });
        }

        const ok = await JoshLabelPrinter.printLabelBatch({
          widthMm,
          heightMm,
          speed: 5,
          darkness: 7,
          gapMm: this.safeMm(opts.labelGapMm ?? 3, 3),
          gapType: opts.mode === 'continuous' ? 0 : 2,
          labels: batchLabels,
        });

        if (ok) {
          onProgress?.(count, count);
          return { ok: true, printedCount: count };
        }
      } catch (batchErr) {
        console.warn('[PrinterService] Josh batch sequence print fallback to standard loop:', batchErr);
      }
    }

    for (let i = 0; i < count; i++) {
      const value = formatSequenceValue(parsed, i);
      const iterTemplate: LabelTemplate = {
        ...template,
        elements: template.elements.map((el) =>
          el.type === 'text' && el.binding === 'sequence'
            ? ({ ...el, binding: 'custom', customText: value } as LabelTextElement)
            : el
        ),
      };

      const ok =
        opts.mode === 'continuous'
          ? await this.printLabelTemplateOnReceiptPaper(product, iterTemplate, opts.paperWidth ?? '58mm')
          : await this.printLabelFromTemplate(product, iterTemplate, 1, opts.labelGapMm ?? 2);

      if (!ok) return { ok: false, printedCount: i };
      onProgress?.(i + 1, count);
    }

    return { ok: true, printedCount: count };
  }

  public generateLabelFromTemplateHtml(product: Product, template: LabelTemplate): string {


    const elementsHtml = template.elements
      .map((el) => {
        if (el.type === 'text') {
          const val = this.resolveLabelTextValue(product, el);
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
          const val = this.resolveLabelCodeValue(product, el);
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
    labelGapMm: number = 2,
    copies: number = 1
  ): Promise<boolean> {
    const rawCode = product.barcode || product.sku || `PROD-${product.id?.slice(-6) || '1234'}`;
    const safeCopies = Math.max(1, copies);

    // Check for dedicated label printers
    const labelKind = await this.getConnectedLabelPrinterKind();
    if (labelKind === 'td404') {
      const spec = this.buildAutoLabelSpec(
        product,
        rawCode,
        format,
        labelWidthMm,
        labelHeightMm,
        labelGapMm,
        safeCopies,
        this.getLabelPaperMode() === 'continuous' ? 0 : 2
      );
      return await this.printSpecOnLabelPrinter(spec);
    }
    if (labelKind === 'josh') {
      return await this.printAutoLabelViaJosh(
        product,
        rawCode,
        format,
        labelWidthMm,
        labelHeightMm,
        labelGapMm,
        safeCopies
      );
    }
    if (labelKind === 'yx') {
      const spec = this.buildAutoLabelSpec(
        product,
        rawCode,
        format,
        labelWidthMm,
        labelHeightMm,
        labelGapMm,
        safeCopies,
        this.getLabelPaperMode() === 'continuous' ? 0 : 2
      );
      return await this.printSpecOnLabelPrinter(spec);
    }

    // Ensure ESC/POS / TSPL socket is ready before printing
    await this.ensureConnected();

    // Prioritize hardware TSPL with native gap sensing for connected 2-in-1 printers in die-cut label mode
    if (!this.preferTsplForLabels()) {
      // Try high-resolution graphic raster for connected Bluetooth thermal ESC/POS printer (DEV / VEER)
      try {
        if (await this.isSocketConnected()) {
          const spec = this.buildAutoLabelSpec(
            product,
            rawCode,
            format,
            labelWidthMm,
            labelHeightMm,
            labelGapMm,
            1,
            this.getLabelPaperMode() === 'continuous' ? 0 : 2
          );
          const ok = await this.printSpecViaEscposGraphic(
            spec,
            this.getEscPosPaperWidth(),
            safeCopies,
            labelGapMm
          );
          if (ok) return true;
        }
      } catch (graphicErr) {
        console.warn('[PrinterService] printSpecViaEscposGraphic for auto label failed:', graphicErr);
      }

      // Automatic hardware fallback for ESC/POS printers: use hardware ESC/POS label print
      return await this.printLabelOnReceiptPaper(
        product,
        format,
        this.getEscPosPaperWidth(),
        safeCopies
      );
    }

    try {
      if (NativeTscPrinter && typeof NativeTscPrinter.printLabel === 'function') {
        // TSPL label jobs never go through initPrinter(), so they need their own socket check.
        await this.ensureConnected();
        try {
          const fields = this.buildTsplLabelFields(product, format, labelWidthMm, labelHeightMm);

          for (let i = 0; i < safeCopies; i++) {
            await NativeTscPrinter.printLabel({
              width: fields.labelWidthMm,
              height: fields.labelHeightMm,
              gap: labelGapMm,
              direction: NativeTscPrinter.DIRECTION?.FORWARD ?? 0,
              reference: [0, 0],
              tear: NativeTscPrinter.TEAR?.ON ?? 'ON',
              sound: 0,
              // home is omitted: TSPL hardware gap sensor positions paper accurately at (0, 0)
              // TSC DENSITY is a real native heat-intensity knob (0-15) — unlike ESC/POS receipts,
              // which have no density command in this SDK. Omitted entirely when not provided,
              // so the printer just uses its own default.
              density: density != null ? NativeTscPrinter.DENSITY?.[`DNESITY${Math.min(15, Math.max(0, Math.round(density)))}`] : undefined,
              text: fields.text,
              qrcode: fields.qrcode,
              barcode: fields.barcode,
            });
          }
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
    const rawCode = product.barcode || product.sku || `PROD-${product.id?.slice(-6) || '1234'}`;

    // A linked label printer beats the receipt roll even in 'continuous' mode.
    // This path has no template and no label calibration handy, so the stock
    // 50x30mm auto-layout applies (same default as the calibration screen).
    const labelKind = await this.getConnectedLabelPrinterKind();
    if (labelKind === 'josh' && (await this.joshEnsureConnected())) {
      return await this.printAutoLabelViaJosh(
        product,
        rawCode,
        format,
        50,
        30,
        2,
        Math.max(1, copies)
      );
    }

    // Try high-resolution graphic raster for clean barcode/QR label formatting
    try {
      const spec = this.buildAutoLabelSpec(
        product,
        rawCode,
        format,
        50,
        30,
        2,
        1,
        0
      );
      const ok = await this.printSpecViaEscposGraphic(spec, paperWidth, copies, 2);
      if (ok) return true;
    } catch (gErr) {
      console.warn('[PrinterService] Graphic label on receipt paper failed, using text fallback:', gErr);
    }

    if (!NativeEscposPrinter || typeof NativeEscposPrinter.printText !== 'function') return false;
    // Cap the product name length so it stays on one line instead of wrapping mid-word and
    // throwing off the compact label look — purely a truncation guard now, NOT used for padding
    // (padding text with spaces AND setting hardware printerAlign(CENTER) was the actual bug: the
    // printer re-centers an already left-padded string, visibly shifting it off true center).
    const maxNameLen = paperWidth === '80mm' ? 36 : 24;
    const truncatedName = product.name.trim().length > maxNameLen ? `${product.name.trim().slice(0, maxNameLen - 1)}…` : product.name.trim();

    try {
      // Reset printer state before label print
      await this.initPrinter(paperWidth);

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
            await NativeEscposPrinter.printText('\n', { widthtimes: 0, heigthtimes: 0, cut: false });
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
    // 'continuous' mode exists for stores whose ONLY printer is a receipt printer.
    // When a dedicated label printer is linked, it always wins — otherwise Label
    // Studio and the products page print to the receipt roll while the label
    // printer the user just connected sits idle. Covers printLabelSequence's
    // continuous branch too, since it lands here.
    const labelKind = await this.getConnectedLabelPrinterKind();
    if (labelKind === 'josh' && (await this.joshEnsureConnected())) {
      return this.printLabelViaJosh(product, template, copies);
    }

    // Try high-resolution graphic raster for ESC/POS receipt & label printer
    try {
      const elements = await this.buildJoshElementsForTemplate(product, template, 1);
      if (elements.length > 0) {
        const spec: JoshLabelSpec = {
          widthMm: this.safeMm(template.widthMm, 50),
          heightMm: this.safeMm(template.heightMm, 30),
          rotation: 0,
          copies: 1,
          gapMm: 2,
          gapType: 0,
          elements,
        };
        const ok = await this.printSpecViaEscposGraphic(spec, paperWidth, copies, 2);
        if (ok) return true;
      }
    } catch (gErr) {
      console.warn('[PrinterService] Graphic template print on receipt paper failed, using text fallback:', gErr);
    }

    if (!NativeEscposPrinter || typeof NativeEscposPrinter.printText !== 'function') return false;

    const DOTS_PER_MM = 8;
    // Guarded: a missing/non-finite mm value becomes NaN, and the native bridge
    // throws on NaN rather than skipping that one field, which fails the label.
    const toDots = (mm: number) => this.safeInt(Number(mm) * DOTS_PER_MM, 0);
    const ALIGN = { left: NativeEscposPrinter.ALIGN?.LEFT ?? 0, center: NativeEscposPrinter.ALIGN?.CENTER ?? 1, right: NativeEscposPrinter.ALIGN?.RIGHT ?? 2 };



    // Elements print in a linear top-to-bottom stream on this hardware, so the design's Y order is
    // the only positional information that carries over — X position doesn't apply beyond alignment.
    const orderedElements = [...template.elements].sort((a, b) => a.yMm - b.yMm);
    // Same truncation convention as printLabelOnReceiptPaper — keeps each text element on one
    // printed line instead of wrapping mid-word on the narrower 58mm roll.
    const maxLineLen = paperWidth === '80mm' ? 36 : 24;

    try {
      for (let i = 0; i < Math.max(1, copies); i++) {
        // Reset printer state at start of each label copy
        await this.initPrinter(paperWidth);

        for (const el of orderedElements) {
          if (el.type === 'text') {
            let value = this.sanitizeForThermalPrint(this.resolveLabelTextValue(product, el));
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
            const raw = this.resolveLabelCodeValue(product, el);
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
              await NativeEscposPrinter.printText('\n', { widthtimes: 0, heigthtimes: 0, cut: false });
            }
          } else if (el.type === 'qrcode') {
            const content = this.resolveLabelCodeValue(product, el);
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
          <div class="store-title">${product.storeName || resolveStoreProfile(getCachedSettings(), useAuthStore.getState().user).storeName || 'SEZNIK POS'}</div>
          <div class="product-name">${product.name}</div>
          <div class="price">₹${product.sellingPrice.toFixed(2)}</div>
          <div class="code-text">*${product.barcode || '8901234567890'}*</div>
        </body>
      </html>
    `;
  }

  private async prepareLogoForEscPos(
    uri: string | undefined,
    paperWidth: '58mm' | '80mm',
    widthPercent: number,
    chip: ReceiptSizeChip = 'medium'
  ): Promise<{ base64: string; widthDots: number } | null> {
    const prepared = await rasterizeReceiptLogoForPrint(uri, paperWidth, widthPercent, chip);
    if (!prepared) return null;
    return { base64: prepared.base64, widthDots: prepared.widthDots };
  }

  /**
   * printPic is fire-and-forget on some native builds. Await when it returns a Promise,
   * otherwise give the printer a moment to finish the bitmap before the next ESC/POS command.
   */
  private async printEscPosBitmap(
    base64: string,
    opts: { width: number; center?: boolean; autoCut?: boolean; paperSize?: number; feed?: number }
  ): Promise<void> {
    if (typeof NativeEscposPrinter.printPic !== 'function') return;
    const result = NativeEscposPrinter.printPic(base64, { autoCut: false, ...opts });
    if (result && typeof result.then === 'function') {
      await result;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  private receiptQrDots(paperWidth: '58mm' | '80mm', size?: ReceiptQrSize): number {
    return receiptQrBitmapDots(paperWidth, size)
  }

  /**
   * Picks the paper width a receipt is actually rendered for.
   *
   * Order matters, and getting it wrong is visible on paper:
   *  1. What the caller explicitly asked for. A 58mm receipt has to stay 58mm even on a printer
   *     whose paper is normally 80mm — previously an 80mm-capable model overrode this, so 2-inch
   *     receipts were impossible on Rudra/Tejas.
   *  2. A width the merchant actually chose (saved calibration / synced settings).
   *  3. The printer's own hardware default. Rudra/Tejas are 80mm machines; falling through to the
   *     store's generic '58mm' starting value made them render 48mm-wide content centred on 80mm
   *     paper, which reads as "the print came out small and off to one side".
   */
  private resolvePaperWidth(
    requested: '58mm' | '80mm' | undefined,
    model: string | null | undefined,
    savedWidth: '58mm' | '80mm',
    savedWidthSource: 'default' | 'user'
  ): '58mm' | '80mm' {
    if (requested === '58mm' || requested === '80mm') return requested;
    if (savedWidthSource === 'user') return savedWidth;
    if (model === 'rudra' || model === 'tejas') return '80mm';
    return savedWidth;
  }

  /**
   * Helper alias for printReceipt accepting options object with optional paperWidth
   */
  public async printSaleReceipt(
    data: PrintSaleData,
    options: ReceiptPrintOptions & { paperWidth?: '58mm' | '80mm' } = {}
  ): Promise<boolean> {
    // No default here on purpose — "caller said nothing" has to stay distinguishable from
    // "caller asked for 58mm", otherwise resolvePaperWidth can never apply the printer's own default.
    const { paperWidth, ...restOptions } = options;
    return this.printReceipt(data, paperWidth, restOptions);
  }

  /**
   * Direct in-app thermal printing via Native Bluetooth ESC/POS module or system fallback.
   * Prints `options.copies` times sequentially (default 1) — e.g. customer + merchant copy.
   */
  public async printReceipt(data: PrintSaleData, paperWidth?: '58mm' | '80mm', options: ReceiptPrintOptions = {}): Promise<boolean> {
    const printerState = require('../store/usePrinterStore').usePrinterStore.getState();
    const effectiveLogoSize: ReceiptSizeChip =
      options.receiptLogoSize || printerState.receiptLogoSize || 'medium';
    const effectiveQrSize: ReceiptSizeChip =
      options.receiptQrSize || printerState.receiptQrSize || 'medium';
    const effectiveFontSize =
      options.fontSize || printerState.fontSize || 'medium';
    const effectiveReceiptFont = resolveReceiptFontId(
      options.receiptFont || printerState.receiptFont
    );
    const effectiveCompactMode =
      options.compactMode !== undefined ? options.compactMode : !!printerState.compactMode;
    const effectiveTopMargin =
      options.topMargin !== undefined ? options.topMargin : printerState.topMargin || 0;
    const effectiveAutoCut =
      options.autoCut !== undefined ? options.autoCut : printerState.autoCut;
    const effectiveCopies = Math.max(1, options.copies || printerState.printCopies || 1);
    const currentModel = printerState.connectedPrinterModel;
    const effectivePaperWidth = this.resolvePaperWidth(
      paperWidth,
      currentModel,
      printerState.paperWidth,
      printerState.paperWidthSource
    );

    const effectiveOptions: ReceiptPrintOptions = {
      ...options,
      receiptLogoSize: effectiveLogoSize,
      receiptQrSize: effectiveQrSize,
      fontSize: effectiveFontSize,
      receiptFont: effectiveReceiptFont,
      compactMode: effectiveCompactMode,
      topMargin: effectiveTopMargin,
      autoCut: effectiveAutoCut,
      copies: effectiveCopies,
    };

    const fallbackProfile = resolveStoreProfile(getCachedSettings(), useAuthStore.getState().user);
    const copies = effectiveCopies;
    const saleData: PrintSaleData = {
      ...data,
      customerName: (data.customerName || '').trim() || 'Walk-in Customer',
      storeLogoUrl: data.storeLogoUrl || effectiveOptions.storeLogoUrl || fallbackProfile.storeLogoUrl,
      footerMessage: data.footerMessage || effectiveOptions.footerMessage || fallbackProfile.footerMessage,
      upiId: data.upiId || effectiveOptions.upiId || fallbackProfile.upiId,
      storeName: data.storeName || effectiveOptions.storeName || fallbackProfile.storeName,
      storeAddress: data.storeAddress || effectiveOptions.storeAddress || fallbackProfile.storeAddress,
      storePhone: data.storePhone || effectiveOptions.storePhone || fallbackProfile.storePhone,
      storeGstin: data.storeGstin || effectiveOptions.storeGstin || fallbackProfile.storeGstin,
    };

    try {
      // 1. Direct TD-404 (SEZNIK RUDRA / TEJAS) continuous roll printing
      const isTd404Active = currentModel === 'rudra' || currentModel === 'tejas' || (await this.td404IsConnected());
      if (isTd404Active) {
        try {
          const ok = await this.printReceiptViaTd404(saleData, effectivePaperWidth, {
            ...effectiveOptions,
            copies,
          });
          if (ok) return true;
        } catch (td404Err: any) {
          console.error('TD-404 receipt print error:', td404Err);
          throw td404Err;
        }
        return false;
      }

      // 2. Direct Josh Printer support (LPAPI / continuous roll)
      if (currentModel === 'josh' || (currentModel !== 'dev' && currentModel !== 'veer' && currentModel !== 'other' && (await this.joshIsConnected()))) {
        if (await this.joshEnsureConnected()) {
          try {
            const ok = await this.printReceiptViaJosh(saleData, effectivePaperWidth, {
              ...effectiveOptions,
              copies,
            });
            if (!ok) throw new Error('Josh printer rejected receipt data');
            return true;
          } catch (joshErr: any) {
            console.error('Josh receipt print error:', joshErr);
            if (currentModel === 'josh') {
              throw joshErr;
            }
          }
        }
      }

      if (NativeEscposPrinter && typeof NativeEscposPrinter.printText === 'function') {
        // Outside the inner try so a connection problem surfaces with its own actionable wording
        // instead of being re-wrapped as a generic "Thermal printer error".
        await this.ensureConnected();

        try {
          // Reset printer state before every job to prevent tilted/shifted output
          await this.initPrinter(effectivePaperWidth);

          const customTemplate = this.resolveActiveCustomTemplate(effectiveOptions);
          if (customTemplate) {
            for (let i = 0; i < copies; i++) {
              await this.printCustomReceiptEscpos(saleData, customTemplate, effectivePaperWidth, effectiveOptions);
            }
            return true;
          }

          // sanitizeForThermalPrint strips/normalizes anything the GBK-default native printText()
          // can't render (emoji, em/en dashes, curly quotes, ...) — without this, free-text fields
          // like footerMessage (e.g. "...stopping by — see you tomorrow!") print as garbled bytes.
          const textContent = this.sanitizeForThermalPrint(this.formatReceiptText(saleData, effectivePaperWidth, effectiveOptions));
          // Height-only bump for "large" — doubling width blows past 32/48 cols and shoves
          // space-padded lines toward the right edge of 58mm paper.
          const scaleH = effectiveOptions.fontSize === 'large' ? 1 : 0;
          const printOptions = {
            widthtimes: 0,
            heigthtimes: scaleH,
            cut: false,
            fonttype: receiptFontEscPosType(effectiveOptions.receiptFont),
          };

          const logoPrepared = saleData.storeLogoUrl
            ? await this.prepareLogoForEscPos(
                saleData.storeLogoUrl,
                effectivePaperWidth,
                RECEIPT_LOGO_STANDARD_WIDTH_PERCENT,
                effectiveLogoSize
              )
            : null;
          const paperSizeDots = effectivePaperWidth === '80mm' ? 80 : 58;
          const upiString = this.upiPayPayload(saleData);

          for (let i = 0; i < copies; i++) {
            // printPic defaults autoCut:true internally — must pass autoCut:false explicitly.
            if (logoPrepared && typeof NativeEscposPrinter.printPic === 'function') {
              await this.printEscPosBitmap(logoPrepared.base64, {
                width: logoPrepared.widthDots,
                center: true,
                autoCut: false,
                paperSize: paperSizeDots,
              });
              // printPic(center) leaves hardware CENTER align; space-padded receipt lines then
              // get re-centered and visually shift to the right. Restore left before body text.
              await this.restoreLeftPrintMode();
            }

            await NativeEscposPrinter.printText(textContent, printOptions);

            // A scannable UPI payment QR, placed after the totals — matches where real receipts
            // (e.g. utility bills) place their payment QR.
            if (upiString && typeof NativeEscposPrinter.printQRCode === 'function') {
              try {
                if (typeof NativeEscposPrinter.printerAlign === 'function') {
                  await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.CENTER ?? 1);
                }
                await NativeEscposPrinter.printText('SCAN TO PAY VIA UPI\n', printOptions);
                await NativeEscposPrinter.printQRCode(upiString, this.receiptQrDots(effectivePaperWidth, effectiveQrSize), NativeEscposPrinter.ERROR_CORRECTION?.M ?? 0);
                if (typeof NativeEscposPrinter.printerAlign === 'function') {
                  await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
                }
              } catch (qrErr) {
                console.warn('UPI QR print failed (non-fatal):', qrErr);
              }
            }

            // A scannable Digital Bill PDF QR code if enabled
            try {
              const { usePrinterStore } = require('../store/usePrinterStore');
              const shouldPrintBillQr = options.includeBillQr ?? usePrinterStore.getState().enableBillQrCode;
              const billPdfUrl = buildBillPdfUrl(saleData);
              if (shouldPrintBillQr && billPdfUrl && typeof NativeEscposPrinter.printQRCode === 'function') {
                if (typeof NativeEscposPrinter.printerAlign === 'function') {
                  await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.CENTER ?? 1);
                }
                await NativeEscposPrinter.printQRCode(billPdfUrl, this.receiptQrDots(effectivePaperWidth, effectiveQrSize), NativeEscposPrinter.ERROR_CORRECTION?.M ?? 0);
                if (typeof NativeEscposPrinter.printerAlign === 'function') {
                  await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
                }
              }
            } catch (billQrErr) {
              console.warn('Digital Bill QR print error (non-fatal):', billQrErr);
            }

            // Force extra physical paper feed (ESC J) beyond the text's own line breaks, so the
            // receipt tail clears the tear bar — line-feed height alone is unreliable across
            // printers. Then cut this copy if requested, so multi-copy prints (e.g. customer +
            // merchant) come out as separate torn receipts rather than one long strip.
            if (typeof NativeEscposPrinter.printAndFeed === 'function') {
              try {
                await NativeEscposPrinter.printAndFeed(RECEIPT_BOTTOM_FEED);
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
        const html = this.generateReceiptHtml(saleData, paperWidth, options);
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

  private async printStoreLogoBitmap(
    storeLogoUrl: string | undefined,
    paperWidth: '58mm' | '80mm',
    widthPercent = RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT,
    chip: ReceiptSizeChip = 'medium'
  ): Promise<boolean> {
    if (!storeLogoUrl || typeof NativeEscposPrinter.printPic !== 'function') return false;
    try {
      const prepared = await this.prepareLogoForEscPos(storeLogoUrl, paperWidth, widthPercent, chip);
      if (!prepared) return false;
      const paperSizeDots = paperWidth === '80mm' ? 80 : 58;
      await this.printEscPosBitmap(prepared.base64, {
        width: prepared.widthDots,
        center: true,
        autoCut: false,
        paperSize: paperSizeDots,
      });
      await this.restoreLeftPrintMode();
      return true;
    } catch (err) {
      console.warn('Store logo print failed:', err);
      return false;
    }
  }

  private async printCustomReceiptEscpos(
    data: PrintSaleData,
    customTemplate: CustomReceiptTemplate,
    paperWidth: '58mm' | '80mm' = '58mm',
    options: ReceiptPrintOptions = {}
  ): Promise<void> {
    // Reset printer state before custom template print
    await this.initPrinter(paperWidth);

    const paperSizeDots = paperWidth === '80mm' ? 80 : 58;
    const widthCols = receiptFontCols(paperWidth, options.receiptFont);
    const escPosFontType = receiptFontEscPosType(options.receiptFont);
    const logoReadyTemplate = ensureTemplateHasLogoBlock(customTemplate, data.storeLogoUrl);
    const fontBump = options.fontSize === 'large' ? 1 : 0;
    const baseTextOpts = { widthtimes: 0, heigthtimes: 0, cut: false, fonttype: escPosFontType };

    const topMargin = Math.max(0, options.topMargin || 0);
    if (topMargin > 0) {
      await NativeEscposPrinter.printText('\n'.repeat(topMargin), baseTextOpts);
    }

    const padTwoColLines = (left: string, right: string): string[] => {
      const leftStr = String(left ?? '').trim();
      const rightStr = String(right ?? '').trim();
      if (!leftStr && !rightStr) return [];
      if (!leftStr) return [rightStr.padStart(widthCols, ' ')];
      if (!rightStr) return [leftStr];
      if (leftStr.length + rightStr.length + 1 <= widthCols) {
        return [leftStr + ' '.repeat(widthCols - leftStr.length - rightStr.length) + rightStr];
      }
      const res: string[] = [];
      if (leftStr.length <= widthCols) {
        res.push(leftStr);
      } else {
        let rem = leftStr;
        while (rem.length > widthCols) {
          res.push(rem.slice(0, widthCols));
          rem = rem.slice(widthCols);
        }
        if (rem.length > 0) res.push(rem);
      }
      res.push(rightStr.padStart(widthCols, ' '));
      return res;
    };

    const padLine = (left: string, right: string) => {
      const res = padTwoColLines(left, right);
      return res[0] || '';
    };

    const alignCode = (align?: 'left' | 'center' | 'right') => {
      if (align === 'center') return NativeEscposPrinter.ALIGN?.CENTER ?? 1;
      if (align === 'right') return NativeEscposPrinter.ALIGN?.RIGHT ?? 2;
      return NativeEscposPrinter.ALIGN?.LEFT ?? 0;
    };
    const showBreakdown =
      options.showTaxBreakdown !== undefined
        ? options.showTaxBreakdown
        : data.gstStyle === 'tax_invoice' || data.gstStyle === 'slab_wise';
    const showItemGst = effectiveShowItemGst(options, showBreakdown);
    const isRestaurant = resolvePrintIsRestaurant(options);

    const receiptEntries = enrichCustomReceiptEntries(
      logoReadyTemplate.entries.filter((entry) => entry.enabled),
      data.totalDiscount || 0
    );

    const hasEnabledImageEntry = receiptEntries.some((entry) => entry.type === 'image');
    if (!hasEnabledImageEntry && data.storeLogoUrl) {
      await this.printStoreLogoBitmap(data.storeLogoUrl, paperWidth, RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT, options.receiptLogoSize || 'medium');
      await this.restoreLeftPrintMode();
    }

    for (const entry of receiptEntries) {
      switch (entry.type) {
        case 'image': {
          const uri = resolveReceiptImageSrc(entry, data.storeLogoUrl);
          if (uri && typeof NativeEscposPrinter.printPic === 'function') {
            try {
              const widthPct = entry.widthPercent || RECEIPT_LOGO_DEFAULT_WIDTH_PERCENT;
              const chip = options.receiptLogoSize || 'medium';
              let prepared = await this.prepareLogoForEscPos(uri, paperWidth, widthPct, chip);
              if (!prepared && data.storeLogoUrl && uri !== data.storeLogoUrl) {
                prepared = await this.prepareLogoForEscPos(data.storeLogoUrl, paperWidth, widthPct, chip);
              }
              if (prepared) {
                await this.printEscPosBitmap(prepared.base64, {
                  width: prepared.widthDots,
                  center: entry.align !== 'left',
                  autoCut: false,
                  paperSize: paperSizeDots,
                });
                if (entry.align !== 'left') {
                  await this.restoreLeftPrintMode();
                }
              }
            } catch (err) {
              console.warn('Custom receipt image print error:', err);
            }
          }
          break;
        }

        case 'text':
        case 'text_special': {
          const rawText = this.sanitizeForThermalPrint(this.interpolateReceiptVariables(entry.text, data));
          const lines = rawText.split('\n').filter((l) => l.trim().length > 0);
          if (lines.length === 0) break;
          const cleanText = lines.join('\n');
          if (typeof NativeEscposPrinter.printerAlign === 'function') {
            await NativeEscposPrinter.printerAlign(alignCode(entry.align));
          }
          let scaleW = 0;
          let scaleH = 0;
          if (entry.type === 'text') {
            if (entry.size === 'large') {
              scaleW = 1;
              scaleH = 1;
            } else if (entry.size === 'double_width') {
              scaleW = 1;
              scaleH = 0;
            } else if (entry.size === 'double_height') {
              scaleW = 0;
              scaleH = 1;
            }
          } else if (entry.type === 'text_special') {
            if ((entry.fontSizePt || 14) >= 18) {
              scaleW = 1;
              scaleH = 1;
            }
          }
          await NativeEscposPrinter.printText(cleanText + '\n', { widthtimes: Math.min(1, scaleW + fontBump), heigthtimes: Math.min(1, scaleH + fontBump), cut: false, fonttype: escPosFontType });
          break;
        }

        case 'horizontal_line': {
          const char = entry.lineStyle === 'double' ? '=' : entry.lineStyle === 'dotted' ? '.' : '-';
          if (typeof NativeEscposPrinter.printerAlign === 'function') {
            await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
          }
          await NativeEscposPrinter.printText(char.repeat(widthCols) + '\n', { ...baseTextOpts });
          break;
        }

        case 'left_right_text': {
          if (isDiscountReceiptEntry(entry) && (!data.totalDiscount || data.totalDiscount <= 0)) {
            break;
          }
          if (isTaxReceiptEntry(entry) && (!data.totalTax || data.totalTax <= 0)) {
            break;
          }
          let left = this.sanitizeForThermalPrint(this.interpolateReceiptVariables(entry.left, data));
          let right = this.sanitizeForThermalPrint(this.interpolateReceiptVariables(entry.right, data));
          if (/scan/i.test(String(entry.left || '') + String(entry.right || ''))) {
            left = 'SCAN TO PAY VIA UPI';
            right = '';
          }
          if (!left && !right) break;
          if (typeof NativeEscposPrinter.printerAlign === 'function') {
            await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
          }
          for (const line of padTwoColLines(left, right)) {
            await NativeEscposPrinter.printText(line + '\n', { ...baseTextOpts });
          }
          break;
        }

        case 'table': {
          if (typeof NativeEscposPrinter.printerAlign === 'function') {
            await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
          }
          const itemCol = entry.columnHeaders?.item || 'Item';
          const totalCol = entry.columnHeaders?.total || 'Total';
          await NativeEscposPrinter.printText(padLine(itemCol, totalCol) + '\n', { ...baseTextOpts });
          await NativeEscposPrinter.printText('-'.repeat(widthCols) + '\n', { ...baseTextOpts });

          for (let idx = 0; idx < data.items.length; idx++) {
            const item = data.items[idx];
            const namePrefix = resolveShowItemNumbers(entry, isRestaurant) ? `${idx + 1}. ` : '';
            const rawName = String(item.productName || 'Item');
            if (namePrefix.length + rawName.length <= widthCols) {
              await NativeEscposPrinter.printText(namePrefix + rawName + '\n', { ...baseTextOpts });
            } else {
              const maxFirst = Math.max(1, widthCols - namePrefix.length);
              await NativeEscposPrinter.printText(namePrefix + rawName.slice(0, maxFirst) + '\n', { ...baseTextOpts });
              const rem = rawName.slice(maxFirst);
              if (rem) await NativeEscposPrinter.printText('   ' + rem.slice(0, Math.max(1, widthCols - 3)) + '\n', { ...baseTextOpts });
            }

            if ((showItemGst || entry.showTaxColumn) && item.gstRate) {
              const gstLabel = formatItemGstRate(item.gstRate);
              if (gstLabel) await NativeEscposPrinter.printText(`   ${gstLabel} GST\n`, { ...baseTextOpts });
            }

            await NativeEscposPrinter.printText(
              padLine(`   ${item.quantity} ${item.unit || 'Pc'} x ${item.unitPrice.toFixed(2)}`, item.total.toFixed(2)) + '\n',
              { ...baseTextOpts }
            );

            if (shouldShowItemDiscount(item.discount)) {
              await NativeEscposPrinter.printText(
                `   Disc: -Rs.${item.discount!.toFixed(2)}\n`,
                { ...baseTextOpts }
              );
            }
          }
          break;
        }

        case 'multi_format': {
          const joined = entry.segments
            .map((seg) => this.sanitizeForThermalPrint(this.interpolateReceiptVariables(seg.text, data)))
            .filter(Boolean)
            .join(' ');
          if (typeof NativeEscposPrinter.printerAlign === 'function') {
            await NativeEscposPrinter.printerAlign(alignCode(entry.align));
          }
          await NativeEscposPrinter.printText(joined + '\n', { ...baseTextOpts });
          break;
        }

        case 'barcode': {
          let rawVal = this.interpolateReceiptVariables(entry.value, data);
          if (entry.qrType === 'upi' || entry.value?.includes('{{upi_qr}}') || entry.upiId) {
            const merchantUpi = entry.upiId || data.upiId || '';
            rawVal = this.upiPayPayload(data, merchantUpi) || '';
          } else if (!rawVal || rawVal === '{{bill_pdf_url}}' || entry.qrType === 'digital_bill') {
            rawVal = buildBillPdfUrl(data);
          } else if (rawVal === '{{invoice_no}}' || entry.qrType === 'invoice_barcode') {
            rawVal = data.invoiceNumber || 'INV-0000';
          }

          if (!rawVal || !rawVal.trim()) {
            break;
          }

          const isQr =
            entry.format === 'qr' ||
            entry.codeType === 'qr_code' ||
            entry.qrType === 'upi' ||
            entry.qrType === 'digital_bill' ||
            entry.qrType === 'custom' ||
            Boolean(entry.upiId) ||
            Boolean(entry.value?.includes('{{upi_qr}}')) ||
            Boolean(entry.value?.includes('{{bill_pdf_url}}')) ||
            rawVal.startsWith('http://') ||
            rawVal.startsWith('https://') ||
            rawVal.startsWith('upi://');

          if (typeof NativeEscposPrinter.printerAlign === 'function') {
            await NativeEscposPrinter.printerAlign(alignCode(entry.align));
          }
          if (isQr && typeof NativeEscposPrinter.printQRCode === 'function') {
            try {
              const isUpi =
                entry.qrType === 'upi' ||
                entry.value?.includes('{{upi_qr}}') ||
                Boolean(entry.upiId);
              if (isUpi) {
                await NativeEscposPrinter.printText('SCAN TO PAY VIA UPI\n', { ...baseTextOpts });
              }
              const qrDots = this.receiptQrDots(
                paperWidth,
                entry.size === 'large' || entry.size === 'small' ? entry.size : options.receiptQrSize || 'medium'
              );
              await NativeEscposPrinter.printQRCode(rawVal.trim(), qrDots, NativeEscposPrinter.ERROR_CORRECTION?.M ?? 0);
              await NativeEscposPrinter.printText('\n', { ...baseTextOpts });
            } catch (qrErr) {
              console.warn('Thermal print QR code failed:', qrErr);
            }
          } else if (!isQr && (entry.format === 'code128' || entry.format === 'ean13' || entry.codeType === 'barcode_1d')) {
            await NativeEscposPrinter.printText(`* ${rawVal.trim()} *\n`, { ...baseTextOpts });
            if (entry.showText) {
              await NativeEscposPrinter.printText(rawVal.trim() + '\n', { ...baseTextOpts });
            }
          }
          break;
        }

        case 'files_note': {
          if (typeof NativeEscposPrinter.printerAlign === 'function') {
            await NativeEscposPrinter.printerAlign(alignCode(entry.align));
          }
          if (entry.title) {
            await NativeEscposPrinter.printText(this.sanitizeForThermalPrint(entry.title) + '\n', { ...baseTextOpts });
          }
          const content = this.sanitizeForThermalPrint(this.interpolateReceiptVariables(entry.content, data));
          for (const l of content.split('\n')) {
            await NativeEscposPrinter.printText(l + '\n', { ...baseTextOpts });
          }
          break;
        }
      }
    }

    if (typeof NativeEscposPrinter.printerAlign === 'function') {
      await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
    }
    if (typeof NativeEscposPrinter.printAndFeed === 'function') {
      await NativeEscposPrinter.printAndFeed(RECEIPT_BOTTOM_FEED);
    }
    if (options.autoCut && typeof NativeEscposPrinter.cutOnePoint === 'function') {
      await NativeEscposPrinter.cutOnePoint();
    }
  }

  /**
   * Prints a Kitchen Order Ticket — same connect-and-print pipeline as printReceipt (native ESC/POS
   * with a system-print-dialog fallback), but always at double width/height (kitchen tickets need to
   * be readable at a glance, unlike a bill a cashier reads up close) and with no logo/QR/pricing.
   */
  public async printKotTicket(data: PrintKotData, paperWidth: '58mm' | '80mm' = '58mm', options: { autoCut?: boolean } = {}): Promise<boolean> {
    try {
      // 1. Direct Josh Printer support for KOT
      if (await this.joshEnsureConnected()) {
        try {
          const ok = await this.printKotViaJosh(data, paperWidth);
          if (ok) return true;
        } catch (joshErr: any) {
          console.warn('Josh KOT print failed, falling back:', joshErr);
        }
      }

      if (NativeEscposPrinter && typeof NativeEscposPrinter.printText === 'function') {
        try {
          // Reset printer state before KOT print
          await this.initPrinter(paperWidth);

          const textContent = this.sanitizeForThermalPrint(this.formatKotText(data, paperWidth));
          const printOptions = { widthtimes: 0, heigthtimes: 0, cut: false };

          await NativeEscposPrinter.printText(textContent, printOptions);

          if (typeof NativeEscposPrinter.printAndFeed === 'function') {
            try {
              await NativeEscposPrinter.printAndFeed(RECEIPT_BOTTOM_FEED);
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
   * Prints a Delta Modification Ticket (+ NEW, - VOID with reason, ~ QTY CHANGE)
   * to inform the kitchen of live updates made to an active KOT order.
   */
  public async printKotDeltaTicket(
    data: PrintKotDeltaData,
    paperWidth: '58mm' | '80mm' = '58mm',
    options: { autoCut?: boolean } = {}
  ): Promise<boolean> {
    try {
      // 1. Direct Josh Printer support for KOT Delta
      if (await this.joshEnsureConnected()) {
        try {
          const ok = await this.printKotDeltaViaJosh(data, paperWidth);
          if (ok) return true;
        } catch (joshErr: any) {
          console.warn('Josh KOT delta print failed, falling back:', joshErr);
        }
      }

      if (NativeEscposPrinter && typeof NativeEscposPrinter.printText === 'function') {
        try {
          await this.initPrinter(paperWidth);

          const textContent = this.sanitizeForThermalPrint(this.formatKotDeltaText(data, paperWidth));
          const printOptions = { widthtimes: 0, heigthtimes: 0, cut: false };

          await NativeEscposPrinter.printText(textContent, printOptions);

          if (typeof NativeEscposPrinter.printAndFeed === 'function') {
            try {
              await NativeEscposPrinter.printAndFeed(RECEIPT_BOTTOM_FEED);
            } catch (feedErr) {
              console.warn('printAndFeed failed (non-fatal):', feedErr);
            }
          }
          if (options.autoCut && typeof NativeEscposPrinter.cutOnePoint === 'function') {
            await NativeEscposPrinter.cutOnePoint();
          }
          return true;
        } catch (escErr: any) {
          console.warn('ESC/POS Delta KOT print failed, falling back to System Print:', escErr);
        }
      }

      const html = this.generateKotDeltaHtml(data, paperWidth);
      await Print.printAsync({ html });
      return true;
    } catch (error) {
      console.error('Delta KOT print error:', error);
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
      .replace(/₹/g, 'Rs.')
      .replace(/[^\x00-\x7E\n]/g, '');
  }

  /**
   * Converts a local (file://, content://) or remote (http/https) image URI to raw base64 —
   * printPic() needs base64 bytes, not a URI. Uses fetch()+FileReader rather than a dedicated
   * file-reading package, since that already works for both local and remote sources and avoids
   * pulling in expo-file-system as a new dependency for one call site.
   */
  private async uriToBase64(uri: string): Promise<string | null> {
    const trimmed = String(uri || '').trim();
    if (!trimmed) return null;

    const cached = this.logoBase64Cache.get(trimmed);
    if (cached) return cached;

    const cacheResult = (base64: string | null) => {
      if (base64) this.logoBase64Cache.set(trimmed, base64);
      return base64;
    };

    // Skip slow image pipelines when the local file was deleted (common with cache/logo_clean paths).
    if (trimmed.startsWith('file://') || trimmed.startsWith('/')) {
      try {
        const FileSystem = require('expo-file-system/legacy');
        const info = await FileSystem.getInfoAsync(trimmed);
        if (!info.exists) {
          console.warn('Logo file missing, skipping bitmap conversion:', trimmed);
          return null;
        }
      } catch {
        return null;
      }
    }

    try {
      try {
        const flattened = await flattenImageOntoWhite(trimmed);
        if (flattened.base64) {
          return cacheResult(flattened.base64);
        }
      } catch (flattenErr) {
        console.warn('Logo white-flatten failed, using JPEG fallback:', flattenErr);
      }

      try {
        let ImageManipulator: any = null;
        try {
          ImageManipulator = require('expo-image-manipulator');
        } catch {}
        if (ImageManipulator && typeof ImageManipulator.manipulateAsync === 'function') {
          const result = await ImageManipulator.manipulateAsync(trimmed, [], {
            format: 'jpeg',
            compress: 0.95,
            base64: true,
          });
          if (result.base64) {
            return cacheResult(result.base64);
          }
        }
      } catch (manipErr) {
        console.warn('ImageManipulator JPEG flatten fallback:', manipErr);
      }

      const response = await fetch(trimmed);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = () => reject(new Error('Failed to read logo image'));
        reader.readAsDataURL(blob);
      });
      return cacheResult(base64 || null);
    } catch (e) {
      console.warn('Failed to convert logo image to base64 for printing:', e);
      return null;
    }
  }

  /**
   * 1-Tap Sample Test Print for Receipts
   */
  public async printTestReceipt(paperWidth?: '58mm' | '80mm', options: ReceiptPrintOptions = {}): Promise<boolean> {
    const storePaperWidth = require('../store/usePrinterStore').usePrinterStore.getState().paperWidth;
    const effectivePaperWidth = paperWidth || storePaperWidth || '58mm';
    const customTemplate = options.customTemplate !== undefined ? options.customTemplate : this.resolveActiveCustomTemplate(options);
    const template = this.resolveActiveTemplate(options);

    const isRestaurantBill = !customTemplate && isRestaurantLayout(template.layout);
    const classicHotelBill = !customTemplate && template.layout === 'restaurant_bill';

    const sampleItems = (customTemplate ? null : template.sampleItems) && (template.sampleItems?.length || 0) > 0
      ? template.sampleItems!
      : [
          { productName: 'Basmati Rice 5kg', quantity: 1, unitPrice: 450.0, total: 450.0, unit: 'Bag', gstRate: 5 },
          { productName: 'Sunflower Oil 1L', quantity: 2, unitPrice: 180.0, total: 360.0, unit: 'Btl', gstRate: 5 },
          { productName: 'Whole Wheat Flour 5kg', quantity: 1, unitPrice: 280.0, total: 280.0, unit: 'Bag', gstRate: 0 },
        ];

    const subtotal = sampleItems.reduce((s, it) => s + it.total, 0);
    const gstSlabs = classicHotelBill
      ? [
          { gstRate: 5.5, cgstRate: 2.75, sgstRate: 2.75, taxableValue: 1000, cgstAmount: 27.78, sgstAmount: 27.77, totalGst: 55.55 },
          { gstRate: 14.5, cgstRate: 7.25, sgstRate: 7.25, taxableValue: 1580, cgstAmount: 113.83, sgstAmount: 113.82, totalGst: 227.65 },
        ]
      : undefined;
    const productGst = classicHotelBill
      ? 283.2
      : isRestaurantBill && template.showTaxBreakdown
        ? Math.round(subtotal * 0.05 * 100) / 100
        : 0;
    const billCharges = classicHotelBill
      ? [
          { presetId: 'service-tax-5-6', label: 'Service Tax 5.6 %', kind: 'legacy_vat' as const, type: 'percent' as const, value: 5.6, amount: 158.93 },
          { presetId: 'service-charge-10', label: 'Service Charges 10.00%', kind: 'service' as const, type: 'percent' as const, value: 10, amount: 258.0 },
        ]
      : undefined;
    const extraChargesTotal = billCharges?.reduce((s, c) => s + c.amount, 0) ?? 0;
    const totalTax =
      isRestaurantBill
        ? productGst
        : !customTemplate && template.showTaxBreakdown
          ? Math.round(subtotal * 0.05 * 100) / 100
          : 40.5;
    const grandTotal = isRestaurantBill ? subtotal + productGst + extraChargesTotal : subtotal + totalTax;

    const fallbackProfile = resolveStoreProfile(getCachedSettings(), useAuthStore.getState().user);
    const now = new Date();
    const sampleDate = isRestaurantBill
      ? template.previewDate || now.toLocaleDateString('en-GB')
      : now.toLocaleDateString('en-GB');
    const sampleTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const sampleData: PrintSaleData = {
      storeName: options.storeName || fallbackProfile.storeName,
      storeAddress: options.storeAddress || fallbackProfile.storeAddress,
      storePhone: options.storePhone || fallbackProfile.storePhone,
      storeGstin: options.storeGstin || fallbackProfile.storeGstin,
      storeLogoUrl: options.storeLogoUrl || fallbackProfile.storeLogoUrl,
      upiId: options.upiId || fallbackProfile.upiId,
      footerMessage: options.footerMessage || (!customTemplate ? template.footerMessage : undefined) || fallbackProfile.footerMessage,
      invoiceNumber: isRestaurantBill
        ? template.previewInvoice || '1842'
        : `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      date: sampleDate,
      time: sampleTime,
      customerName: options.customerName || (template.previewCustomerName || 'Walk-in Customer'),
      customerPhone: options.customerPhone || (template.previewCustomerPhone || ''),
      tableNo: isRestaurantBill ? template.previewTableNo || '12' : resolvePrintIsRestaurant(options) ? '12' : undefined,
      waiterName: isRestaurantBill ? template.previewWaiter || 'WAITER' : resolvePrintIsRestaurant(options) ? 'RAJ' : undefined,
      tokenNo: isRestaurantBill || resolvePrintIsRestaurant(options) ? '42' : undefined,
      items: sampleItems,
      subtotal,
      totalDiscount: 0,
      totalTax,
      billCharges,
      extraChargesTotal,
      grandTotal,
      amountPaid: grandTotal,
      changeReturned: 0,
      paymentMethod: 'CASH',
      gstSlabs,
    };

    return this.printReceipt(sampleData, effectivePaperWidth, { ...options, customTemplate, template });
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

    // The test button must exercise the printer that real labels will use — with a
    // linked label printer, a TSPL test would "pass" on the receipt printer while
    // telling the user nothing about the device their labels actually go to.
    const labelKind = await this.getConnectedLabelPrinterKind();
    if (labelKind === 'td404') {
      const rawCode = item.barcode || '8901234567890';
      const spec = this.buildAutoLabelSpec(item, rawCode, format, labelWidthMm, labelHeightMm, labelGapMm);
      return await this.printSpecOnLabelPrinter(spec);
    }
    if (labelKind === 'josh') {
      return await this.printAutoLabelViaJosh(
        item,
        item.barcode || '8901234567890',
        format,
        labelWidthMm,
        labelHeightMm,
        labelGapMm
      );
    }
    if (labelKind === 'yx') {
      const rawCode = item.barcode || '8901234567890';
      const spec = this.buildAutoLabelSpec(item, rawCode, format, labelWidthMm, labelHeightMm, labelGapMm);
      return await this.printSpecOnLabelPrinter(spec);
    }

    try {
      if (NativeTscPrinter && typeof NativeTscPrinter.printLabel === 'function') {
        // TSPL label jobs never go through initPrinter(), so they need their own socket check.
        await this.ensureConnected();
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

  /**
   * Universal alignment self-test utility for all printer drivers (JOSH, TEJ, DEV, VEER).
   * Prints an outer border box (1mm inside edge) + center crosshair + dimension details across 3-4 consecutive labels.
   * This provides an instant visual verification of label pitch, horizontal centering, and margin bleed.
   */
  public async printAlignmentSelfTest(
    copies: number = 3,
    widthMmOverride?: number,
    heightMmOverride?: number,
    gapMmOverride?: number
  ): Promise<boolean> {
    const { usePrinterStore } = require('../store/usePrinterStore');
    const store = usePrinterStore.getState();
    const config = getLabelSizeConfig(
      widthMmOverride || store.labelWidthMm || 50,
      heightMmOverride || store.labelHeightMm || 30,
      gapMmOverride ?? store.labelGapMm ?? 2
    );
    const { widthMm, heightMm, gapMm } = config;
    const safeCopies = Math.max(1, Math.min(10, copies));

    let allSucceeded = true;
    for (let i = 0; i < safeCopies; i++) {
      const dummyProduct: any = {
        id: `test-align-${i + 1}`,
        name: `SEZNIK CALIBRATION ${i + 1}/${safeCopies}`,
        sellingPrice: 0,
        barcode: '12345678',
        sku: 'ALIGN',
        category: 'ALIGN',
      };

      // 1.0mm inset from physical die-cut borders
      const margin = 1.0;
      const boxW = Math.max(10, widthMm - margin * 2);
      const boxH = Math.max(6, heightMm - margin * 2);

      const elements: any[] = [
        // Outer border box (1.0mm inset from all 4 physical die-cut edges)
        {
          id: 'border',
          type: 'rect',
          xMm: margin,
          yMm: margin,
          widthMm: boxW,
          heightMm: boxH,
          thickness: 0.35,
        },
        // Horizontal center crosshair
        {
          id: 'cross_h',
          type: 'line',
          xMm: margin + 0.5,
          yMm: heightMm / 2,
          x2Mm: widthMm - margin - 0.5,
          y2Mm: heightMm / 2,
          thickness: 0.25,
        },
        // Vertical center crosshair
        {
          id: 'cross_v',
          type: 'line',
          xMm: widthMm / 2,
          yMm: margin + 0.5,
          x2Mm: widthMm / 2,
          y2Mm: heightMm - margin - 0.5,
          thickness: 0.25,
        },
        // Title text at top
        {
          id: 'title',
          type: 'text',
          binding: 'custom',
          customText: `CALIBRATION (${i + 1}/${safeCopies})`,
          xMm: margin + 0.5,
          yMm: margin + 0.3,
          widthMm: boxW - 1.0,
          heightMm: Math.min(2.8, boxH * 0.22),
          fontSizePt: heightMm <= 18 ? 1.8 : 2.2,
          bold: true,
          align: 'center',
        },
        // Dimension info text at bottom
        {
          id: 'info',
          type: 'text',
          binding: 'custom',
          customText: `${widthMm}x${heightMm}mm • GAP ${gapMm}mm • 203 DPI`,
          xMm: margin + 0.5,
          yMm: Math.max(margin + 2.5, heightMm - margin - 2.8),
          widthMm: boxW - 1.0,
          heightMm: Math.min(2.4, boxH * 0.2),
          fontSizePt: heightMm <= 18 ? 1.6 : 1.9,
          bold: false,
          align: 'center',
        },
      ];

      // Millimetre ruler down the left edge, so this print can be MEASURED rather than
      // eyeballed. Two numbers come straight off the paper and settle every remaining
      // alignment question:
      //   - where the die-cut falls against the scale = the stock's TRUE label height
      //   - where the 0 tick sits against the label's top edge = the head start offset
      // Ticks are absolute millimetres, so they stay readable even when the configured
      // height is wrong — which is exactly the case this is meant to diagnose.
      for (let mm = 0; mm <= Math.floor(heightMm); mm += 5) {
        const major = mm % 10 === 0;
        elements.push({
          id: `tick_${mm}`,
          type: 'line',
          xMm: 0,
          yMm: mm,
          x2Mm: major ? 6.0 : 3.5,
          y2Mm: mm,
          thickness: 0.25,
        });
        if (major) {
          elements.push({
            id: `ticklbl_${mm}`,
            type: 'text',
            binding: 'custom',
            customText: `${mm}`,
            xMm: 6.6,
            yMm: Math.max(0, mm - 1.1),
            widthMm: 7,
            heightMm: 2.2,
            fontSizePt: 1.6,
            bold: false,
            align: 'left',
          });
        }
      }

      const testTemplate: any = {
        id: `align-test-${i + 1}`,
        name: `Alignment Test ${widthMm}x${heightMm}`,
        widthMm,
        heightMm,
        elements,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const ok = await this.printLabelFromTemplate(dummyProduct, testTemplate, 1, gapMm);
      if (!ok) allSucceeded = false;
      if (i < safeCopies - 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    return allSucceeded;
  }

  /**
   * Generates thermal HTML for freeform text (Quick Thermal Print) for Web and print preview.
   */
  public generateFreeformThermalHtml(
    text: string,
    options: QuickThermalPrintOptions = {}
  ): string {
    const effectivePaperWidth = options.paperWidth || '58mm';
    const widthPx = effectivePaperWidth === '80mm' ? '380px' : '280px';
    const fontSize = effectivePaperWidth === '58mm' ? '12px' : '14px';
    const cssFont = receiptFontCssFamily(options.receiptFont ? resolveReceiptFontId(options.receiptFont) : undefined);
    const logoSize = options.paperWidth === '80mm' ? 140 : 100;
    const qrDimension = effectivePaperWidth === '80mm' ? 140 : 110;

    const lines = (text || '').split('\n');
    const upiImgUrl = options.upiId
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&data=${encodeURIComponent(buildUpiPayString(options.upiId, 'Merchant', 0))}`
      : '';
    const customQrUrl = options.qrCode
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&data=${encodeURIComponent(options.qrCode)}`
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { size: ${effectivePaperWidth} auto; margin: 2mm 1mm 6mm 1mm; }
            * { box-sizing: border-box; }
            body {
              font-family: ${cssFont};
              font-size: ${fontSize};
              line-height: 1.3;
              margin: 0 auto;
              padding: 6px;
              width: 100%;
              max-width: ${widthPx};
              color: #000;
              background: #fff;
            }
          </style>
        </head>
        <body>
          ${options.storeLogoUrl ? `
          <div style="text-align: center; margin-bottom: 8px;">
            <img src="${options.storeLogoUrl}" style="max-height: ${logoSize}px; max-width: ${widthPx}; width: auto; height: auto; object-fit: contain; margin: 0 auto; display: block;" />
          </div>` : ''}
          ${lines.map((l) => `<div style="white-space: pre-wrap; word-break: break-word; width: 100%; font-family: ${cssFont};">${l.replace(/ /g, '&nbsp;') || '&nbsp;'}</div>`).join('')}
          ${upiImgUrl ? `
          <div style="text-align: center; margin-top: 10px; padding: 6px 0; border-top: 1px dashed #000; display: block;">
            <div style="font-size: 10px; font-weight: 800; margin-bottom: 4px;">SCAN TO PAY VIA UPI</div>
            <img src="${upiImgUrl}" alt="UPI QR" style="width: ${qrDimension}px; height: ${qrDimension}px; object-fit: contain; margin: 0 auto; display: block;" />
            <div style="font-size: 9px; margin-top: 2px;">${options.upiId}</div>
          </div>` : ''}
          ${customQrUrl ? `
          <div style="text-align: center; margin-top: 10px; padding: 6px 0; border-top: 1px dashed #000; display: block;">
            <img src="${customQrUrl}" alt="QR Code" style="width: ${qrDimension}px; height: ${qrDimension}px; object-fit: contain; margin: 0 auto; display: block;" />
            <div style="font-size: 9px; margin-top: 2px;">${options.qrCode}</div>
          </div>` : ''}
          ${options.barcode ? `
          <div style="text-align: center; margin-top: 8px; padding: 4px 0; border-top: 1px dashed #000;">
            <div style="font-size: 10px; font-weight: 700; letter-spacing: 2px; font-family: monospace;">||||||||||||||||||||||||||||||</div>
            <div style="font-size: 10px; font-weight: 600;">${options.barcode}</div>
          </div>` : ''}
        </body>
      </html>
    `;
  }

  /**
   * Universal Quick Thermal Print (Freeform Text & Custom Blocks) for Mobile & Web.
   */
  public async printFreeformThermal(
    text: string,
    options: QuickThermalPrintOptions = {}
  ): Promise<boolean> {
    const { usePrinterStore } = require('../store/usePrinterStore');
    const printerState = usePrinterStore.getState();
    const effectivePaperWidth = options.paperWidth || printerState.paperWidth || '58mm';
    const effectiveCopies = Math.max(1, options.copies || printerState.printCopies || 1);
    const effectiveAutoCut = options.autoCut !== undefined ? options.autoCut : printerState.autoCut;
    const effectiveFont = resolveReceiptFontId(options.receiptFont || printerState.receiptFont);
    const effectiveFontSize = options.fontSize || printerState.fontSize || 'medium';

    try {
      if (NativeEscposPrinter && typeof NativeEscposPrinter.printText === 'function') {
        await this.ensureConnected();
        await this.initPrinter(effectivePaperWidth);

        const cleanText = this.sanitizeForThermalPrint(text);
        const scaleH = effectiveFontSize === 'large' ? 1 : 0;
        const printOptions = {
          widthtimes: 0,
          heigthtimes: scaleH,
          cut: false,
          fonttype: receiptFontEscPosType(effectiveFont),
        };

        const logoPrepared = options.storeLogoUrl
          ? await this.prepareLogoForEscPos(
              options.storeLogoUrl,
              effectivePaperWidth,
              RECEIPT_LOGO_STANDARD_WIDTH_PERCENT,
              'medium'
            )
          : null;
        const paperSizeDots = effectivePaperWidth === '80mm' ? 80 : 58;

        for (let i = 0; i < effectiveCopies; i++) {
          if (logoPrepared && typeof NativeEscposPrinter.printPic === 'function') {
            await this.printEscPosBitmap(logoPrepared.base64, {
              width: logoPrepared.widthDots,
              center: true,
              autoCut: false,
              paperSize: paperSizeDots,
            });
            if (typeof NativeEscposPrinter.printerAlign === 'function') {
              await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
            }
          }

          if (cleanText) {
            await NativeEscposPrinter.printText(cleanText + '\n', printOptions);
          }

          if (options.upiId && typeof NativeEscposPrinter.printQRCode === 'function') {
            try {
              const upiPayload = buildUpiPayString(options.upiId, 'Merchant', 0);
              if (typeof NativeEscposPrinter.printerAlign === 'function') {
                await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.CENTER ?? 1);
              }
              await NativeEscposPrinter.printText('SCAN TO PAY VIA UPI\n', printOptions);
              await NativeEscposPrinter.printQRCode(upiPayload, this.receiptQrDots(effectivePaperWidth, 'medium'), NativeEscposPrinter.ERROR_CORRECTION?.M ?? 0);
              await NativeEscposPrinter.printText(`${options.upiId}\n\n`, printOptions);
              if (typeof NativeEscposPrinter.printerAlign === 'function') {
                await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
              }
            } catch (qrErr) {
              console.warn('Quick print UPI QR error:', qrErr);
            }
          }

          if (options.qrCode && typeof NativeEscposPrinter.printQRCode === 'function') {
            try {
              if (typeof NativeEscposPrinter.printerAlign === 'function') {
                await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.CENTER ?? 1);
              }
              await NativeEscposPrinter.printQRCode(options.qrCode, this.receiptQrDots(effectivePaperWidth, 'medium'), NativeEscposPrinter.ERROR_CORRECTION?.M ?? 0);
              await NativeEscposPrinter.printText(`${options.qrCode}\n\n`, printOptions);
              if (typeof NativeEscposPrinter.printerAlign === 'function') {
                await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
              }
            } catch (qrErr) {
              console.warn('Quick print custom QR error:', qrErr);
            }
          }

          if (options.barcode && typeof NativeEscposPrinter.printBarCode === 'function') {
            try {
              if (typeof NativeEscposPrinter.printerAlign === 'function') {
                await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.CENTER ?? 1);
              }
              await NativeEscposPrinter.printBarCode(options.barcode, NativeEscposPrinter.BARCODETYPE?.CODE128 ?? 73, 60, 2, 0, 2);
              await NativeEscposPrinter.printText(`${options.barcode}\n\n`, printOptions);
              if (typeof NativeEscposPrinter.printerAlign === 'function') {
                await NativeEscposPrinter.printerAlign(NativeEscposPrinter.ALIGN?.LEFT ?? 0);
              }
            } catch (bcErr) {
              console.warn('Quick print barcode error:', bcErr);
            }
          }

          if (typeof NativeEscposPrinter.printAndFeed === 'function') {
            await NativeEscposPrinter.printAndFeed(RECEIPT_BOTTOM_FEED);
          }
          if (effectiveAutoCut && typeof NativeEscposPrinter.cutOnePoint === 'function') {
            await NativeEscposPrinter.cutOnePoint();
          }
        }
        return true;
      }

      // Web or system print fallback
      const html = this.generateFreeformThermalHtml(text, {
        ...options,
        paperWidth: effectivePaperWidth,
        receiptFont: effectiveFont,
        fontSize: effectiveFontSize,
      });

      for (let i = 0; i < effectiveCopies; i++) {
        await Print.printAsync({ html });
      }
      return true;
    } catch (error: any) {
      console.error('Quick thermal print error:', error);
      throw error;
    }
  }

  /**
   * Prints a specialized Utility Bill Kiosk Receipt matching the exact reference layout.
   */
  public async printUtilityBillSlip(
    billData: {
      kioskName?: string;
      billType?: string;
      provider?: string;
      consumerNumber?: string;
      consumerName?: string;
      dueDate?: string | null;
      billDate?: string | null;
      unitsConsumed?: string | null;
      billAmount: number;
      convenienceFee: number;
      totalAmount: number;
      status?: string;
      receiptNumber?: string;
      createdAt?: string;
    },
    paperWidth: '58mm' | '80mm' = '58mm',
    options: { copies?: number; autoCut?: boolean } = {}
  ): Promise<boolean> {
    const effectiveWidth = paperWidth || '58mm';
    const copies = Math.max(1, options.copies || 1);
    const {
      formatUtilityReceiptText,
      generateUtilityReceiptHtml,
    } = require('../components/bill-converter/UtilityReceiptSlip');
    const textContent = formatUtilityReceiptText(billData, effectiveWidth);

    try {
      // 1. Direct Josh Printer support if connected
      if (await this.joshEnsureConnected()) {
        try {
          const fakeSaleData: PrintSaleData = {
            invoiceNumber: billData.receiptNumber || 'BILL',
            date: billData.billDate || new Date().toLocaleDateString('en-GB'),
            items: [
              {
                productName: `${(billData.provider || billData.billType || 'Bill').slice(0, 24)}`,
                quantity: 1,
                unitPrice: billData.billAmount,
                total: billData.billAmount,
              },
            ],
            subtotal: billData.billAmount,
            totalDiscount: 0,
            totalTax: 0,
            grandTotal: billData.totalAmount,
            paymentMethod: 'CASH',
            storeName: billData.kioskName || 'SEZNIK KIOSK',
            footerMessage: 'Thank you! Keep this slip.',
            consumerNo: billData.consumerNumber || undefined,
            customerName: billData.consumerName || undefined,
            dueDate: billData.dueDate || undefined,
            providerName: billData.provider || undefined,
            unitsConsumed: billData.unitsConsumed || undefined,
          };
          if (billData.convenienceFee > 0) {
            fakeSaleData.items.push({
              productName: 'Convenience / Fee',
              quantity: 1,
              unitPrice: billData.convenienceFee,
              total: billData.convenienceFee,
            });
          }
          const ok = await this.printReceiptViaJosh(fakeSaleData, effectiveWidth, { copies });
          if (ok) return true;
        } catch (joshErr) {
          console.warn('Josh utility bill print error, falling back:', joshErr);
        }
      }

      // 2. ESC/POS Bluetooth Printer
      if (NativeEscposPrinter && typeof NativeEscposPrinter.printText === 'function') {
        try {
          await this.ensureConnected();
          await this.initPrinter(effectiveWidth);
          const sanitized = this.sanitizeForThermalPrint(textContent);
          const printOptions = { widthtimes: 0, heigthtimes: 0, cut: false };

          for (let i = 0; i < copies; i++) {
            await NativeEscposPrinter.printText(sanitized + '\n', printOptions);
            if (typeof NativeEscposPrinter.printAndFeed === 'function') {
              await NativeEscposPrinter.printAndFeed(RECEIPT_BOTTOM_FEED);
            }
            if (options.autoCut && typeof NativeEscposPrinter.cutOnePoint === 'function') {
              await NativeEscposPrinter.cutOnePoint();
            }
          }
          return true;
        } catch (escErr) {
          console.warn('ESC/POS print failed, falling back to system print:', escErr);
        }
      }

      // 3. System Print / PDF Fallback
      const html = generateUtilityReceiptHtml(billData, effectiveWidth);
      for (let i = 0; i < copies; i++) {
        await Print.printAsync({ html });
      }
      return true;
    } catch (error: any) {
      console.error('Utility bill print error:', error);
      throw error;
    }
  }

  /**
   * Sends standard ESC/POS pulse command to open the connected cash drawer / cash box.
   */
  public async openCashDrawer(): Promise<boolean> {
    try {
      if (NativeEscposPrinter && typeof NativeEscposPrinter.openCashBox === 'function') {
        await NativeEscposPrinter.openCashBox(0, 25, 250);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[PrinterService] openCashDrawer failed:', e);
      return false;
    }
  }
}

export const ThermalPrinterService = new ThermalPrinterServiceManager();
export default ThermalPrinterService;
