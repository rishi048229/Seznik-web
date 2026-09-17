import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ReceiptFontId } from '@shared/receiptFonts';

const TOKEN_KEY = 'seznik_auth_token';
const USER_KEY = 'seznik_user_data';

export async function setAuthToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOKEN_KEY, token);
      }
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (error) {
    console.error('Error saving auth token:', error);
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(TOKEN_KEY);
      }
      return null;
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error reading auth token:', error);
    return null;
  }
}

export async function removeAuthToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (error) {
    console.error('Error deleting auth token:', error);
  }
}

export async function setStoredUser(user: any): Promise<void> {
  try {
    const json = JSON.stringify(user);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(USER_KEY, json);
      }
    } else {
      await SecureStore.setItemAsync(USER_KEY, json);
    }
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

export async function getStoredUser<T>(): Promise<T | null> {
  try {
    let json: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        json = window.localStorage.getItem(USER_KEY);
      }
    } else {
      json = await SecureStore.getItemAsync(USER_KEY);
    }
    return json ? (JSON.parse(json) as T) : null;
  } catch (error) {
    console.error('Error reading user data:', error);
    return null;
  }
}

export async function removeStoredUser(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(USER_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch (error) {
    console.error('Error deleting user data:', error);
  }
}

const LANGUAGE_KEY = 'seznik_app_language';
const TEMPLATE_KEY = 'seznik_active_template_id';

export async function setStoredLanguage(lang: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LANGUAGE_KEY, lang);
      }
    } else {
      await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
    }
  } catch (error) {
    console.error('Error saving language:', error);
  }
}

export async function getStoredLanguage(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(LANGUAGE_KEY);
      }
      return null;
    }
    return await SecureStore.getItemAsync(LANGUAGE_KEY);
  } catch (error) {
    console.error('Error reading language:', error);
    return null;
  }
}

export async function setStoredActiveTemplate(templateId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TEMPLATE_KEY, templateId);
      }
    } else {
      await SecureStore.setItemAsync(TEMPLATE_KEY, templateId);
    }
  } catch (error) {
    console.error('Error saving active template:', error);
  }
}

export async function getStoredActiveTemplate(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(TEMPLATE_KEY);
      }
      return null;
    }
    return await SecureStore.getItemAsync(TEMPLATE_KEY);
  } catch (error) {
    console.error('Error reading active template:', error);
    return null;
  }
}

const CUSTOM_RECEIPT_TEMPLATES_KEY = 'seznik_custom_receipt_templates';
const ACTIVE_CUSTOM_RECEIPT_KEY = 'seznik_active_custom_receipt';
const ENABLE_BILL_QR_KEY = 'seznik_enable_bill_qr';

export async function getStoredCustomReceiptTemplates(): Promise<any[] | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(CUSTOM_RECEIPT_TEMPLATES_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(CUSTOM_RECEIPT_TEMPLATES_KEY);
    }
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('Error reading custom receipt templates:', error);
    return null;
  }
}

export async function setStoredCustomReceiptTemplates(templates: any[]): Promise<void> {
  try {
    const raw = JSON.stringify(templates);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CUSTOM_RECEIPT_TEMPLATES_KEY, raw);
      }
    } else {
      await SecureStore.setItemAsync(CUSTOM_RECEIPT_TEMPLATES_KEY, raw);
    }
  } catch (error) {
    console.error('Error saving custom receipt templates:', error);
  }
}

export async function getStoredActiveCustomReceiptTemplate(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_CUSTOM_RECEIPT_KEY) : null;
    }
    return await SecureStore.getItemAsync(ACTIVE_CUSTOM_RECEIPT_KEY);
  } catch (error) {
    console.error('Error reading active custom receipt template id:', error);
    return null;
  }
}

export async function setStoredActiveCustomReceiptTemplate(id: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        if (id) window.localStorage.setItem(ACTIVE_CUSTOM_RECEIPT_KEY, id);
        else window.localStorage.removeItem(ACTIVE_CUSTOM_RECEIPT_KEY);
      }
    } else {
      if (id) await SecureStore.setItemAsync(ACTIVE_CUSTOM_RECEIPT_KEY, id);
      else await SecureStore.deleteItemAsync(ACTIVE_CUSTOM_RECEIPT_KEY);
    }
  } catch (error) {
    console.error('Error saving active custom receipt template id:', error);
  }
}

export async function getStoredEnableBillQr(): Promise<boolean> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(ENABLE_BILL_QR_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(ENABLE_BILL_QR_KEY);
    }
    return raw !== null ? raw === 'true' : true; // default true
  } catch {
    return true;
  }
}

export async function setStoredEnableBillQr(enabled: boolean): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ENABLE_BILL_QR_KEY, enabled ? 'true' : 'false');
      }
    } else {
      await SecureStore.setItemAsync(ENABLE_BILL_QR_KEY, enabled ? 'true' : 'false');
    }
  } catch (error) {
    console.error('Error saving enable bill qr setting:', error);
  }
}

const PAIRED_PRINTERS_KEY = 'seznik_paired_printers';
const AUTO_CONNECT_KEY = 'seznik_printer_auto_connect';
const LABEL_TEMPLATES_KEY = 'seznik_label_templates';
const ACTIVE_LABEL_TEMPLATE_KEY = 'seznik_active_label_template';
const PRINTER_CALIBRATION_KEY = 'seznik_printer_calibration';

export interface StoredPrinterCalibration {
  paperWidth?: '58mm' | '80mm';
  printDensity?: number;
  topMargin?: number;
  autoCut?: boolean;
  printCopies?: number;
  fontSize?: 'small' | 'medium' | 'large';
  receiptFont?: ReceiptFontId;
  receiptLogoSize?: 'small' | 'medium' | 'large';
  receiptQrSize?: 'small' | 'medium' | 'large';
  labelPaperMode?: 'gap' | 'continuous';
  labelWidthMm?: number;
  labelHeightMm?: number;
  labelGapMm?: number;
  /** Residual vertical alignment trim in mm for gap-sensor-less (blind raster) label printing. */
  labelOffsetMm?: number;
  /** User's preferred SEZNIK printer model choice: 'josh' | 'dev' | 'veer' | null */
  preferredPrinterModel?: 'josh' | 'dev' | 'veer' | null;
  /** Last actively connected SEZNIK printer model: 'josh' | 'dev' | 'veer' | null */
  connectedPrinterModel?: 'josh' | 'dev' | 'veer' | null;
}

export async function getStoredPrinterCalibration(): Promise<StoredPrinterCalibration | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(PRINTER_CALIBRATION_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(PRINTER_CALIBRATION_KEY);
    }
    return raw ? (JSON.parse(raw) as StoredPrinterCalibration) : null;
  } catch (error) {
    console.error('Error reading printer calibration:', error);
    return null;
  }
}

export async function setStoredPrinterCalibration(calibration: StoredPrinterCalibration): Promise<void> {
  try {
    const raw = JSON.stringify(calibration);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PRINTER_CALIBRATION_KEY, raw);
      }
    } else {
      await SecureStore.setItemAsync(PRINTER_CALIBRATION_KEY, raw);
    }
  } catch (error) {
    console.error('Error saving printer calibration:', error);
  }
}

export async function getStoredLabelTemplates(): Promise<any[] | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(LABEL_TEMPLATES_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(LABEL_TEMPLATES_KEY);
    }
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error('Error reading label templates:', error);
    return null;
  }
}

export async function setStoredLabelTemplates(templates: any[]): Promise<void> {
  try {
    const raw = JSON.stringify(templates);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LABEL_TEMPLATES_KEY, raw);
      }
    } else {
      await SecureStore.setItemAsync(LABEL_TEMPLATES_KEY, raw);
    }
  } catch (error) {
    console.error('Error saving label templates:', error);
  }
}

export async function getStoredActiveLabelTemplate(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_LABEL_TEMPLATE_KEY) : null;
    }
    return await SecureStore.getItemAsync(ACTIVE_LABEL_TEMPLATE_KEY);
  } catch (error) {
    console.error('Error reading active label template id:', error);
    return null;
  }
}

export async function setStoredActiveLabelTemplate(id: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        if (id) window.localStorage.setItem(ACTIVE_LABEL_TEMPLATE_KEY, id);
        else window.localStorage.removeItem(ACTIVE_LABEL_TEMPLATE_KEY);
      }
    } else {
      if (id) await SecureStore.setItemAsync(ACTIVE_LABEL_TEMPLATE_KEY, id);
      else await SecureStore.deleteItemAsync(ACTIVE_LABEL_TEMPLATE_KEY);
    }
  } catch (error) {
    console.error('Error saving active label template id:', error);
  }
}

/**
 * The paired-printer list is device-local (a MAC address only means anything to the phone that
 * bonded it), so it lives here rather than in the synced backend Settings row. Without it every
 * cold start begins with an empty list and forces a fresh ~15s discovery scan before the first bill.
 */
export async function getStoredPairedPrinters(): Promise<any[] | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(PAIRED_PRINTERS_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(PAIRED_PRINTERS_KEY);
    }
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error('Error reading paired printers:', error);
    return null;
  }
}

export async function setStoredPairedPrinters(printers: any[]): Promise<void> {
  try {
    const raw = JSON.stringify(printers);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PAIRED_PRINTERS_KEY, raw);
      }
    } else {
      await SecureStore.setItemAsync(PAIRED_PRINTERS_KEY, raw);
    }
  } catch (error) {
    console.error('Error saving paired printers:', error);
  }
}

export async function getStoredAutoConnect(): Promise<boolean> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(AUTO_CONNECT_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(AUTO_CONNECT_KEY);
    }
    return raw !== null ? raw === 'true' : true; // default true
  } catch {
    return true;
  }
}

export async function setStoredAutoConnect(enabled: boolean): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTO_CONNECT_KEY, enabled ? 'true' : 'false');
      }
    } else {
      await SecureStore.setItemAsync(AUTO_CONNECT_KEY, enabled ? 'true' : 'false');
    }
  } catch (error) {
    console.error('Error saving auto-connect setting:', error);
  }
}

/**
 * The linked DothanTech/Josh LPAPI label printer. Device-local like the paired ESC/POS
 * printers (a MAC address is only meaningful to the phone that bonded it). Persisting it
 * is what lets label prints silently reconnect after an app restart instead of requiring
 * a trip to the Printers screen before every shift.
 */
const JOSH_PRINTER_KEY = 'seznik_josh_label_printer';

export interface StoredJoshPrinter {
  address: string;
  name: string;
}

export async function getStoredJoshPrinter(): Promise<StoredJoshPrinter | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(JOSH_PRINTER_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(JOSH_PRINTER_KEY);
    }
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.address === 'string' && parsed.address ? parsed : null;
  } catch (error) {
    console.error('Error reading saved label printer:', error);
    return null;
  }
}

export async function setStoredJoshPrinter(printer: StoredJoshPrinter | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        if (printer) window.localStorage.setItem(JOSH_PRINTER_KEY, JSON.stringify(printer));
        else window.localStorage.removeItem(JOSH_PRINTER_KEY);
      }
      return;
    }
    if (printer) {
      await SecureStore.setItemAsync(JOSH_PRINTER_KEY, JSON.stringify(printer));
    } else {
      await SecureStore.deleteItemAsync(JOSH_PRINTER_KEY);
    }
  } catch (error) {
    console.error('Error saving label printer:', error);
  }
}

/**
 * The linked SEZNIK TEJ (Y50/YX SDK) label printer. Device-local like JOSH and paired ESC/POS
 * printers. Persisted so that TEJ auto-reconnects on launch and across print operations.
 */
const TEJ_PRINTER_KEY = 'seznik_tej_label_printer';

export interface StoredTejPrinter {
  address: string;
  name: string;
}

export async function getStoredTejPrinter(): Promise<StoredTejPrinter | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof window !== 'undefined' ? window.localStorage.getItem(TEJ_PRINTER_KEY) : null;
    } else {
      raw = await SecureStore.getItemAsync(TEJ_PRINTER_KEY);
    }
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.address === 'string' && parsed.address ? parsed : null;
  } catch (error) {
    console.error('Error reading saved TEJ label printer:', error);
    return null;
  }
}

export async function setStoredTejPrinter(printer: StoredTejPrinter | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        if (printer) window.localStorage.setItem(TEJ_PRINTER_KEY, JSON.stringify(printer));
        else window.localStorage.removeItem(TEJ_PRINTER_KEY);
      }
      return;
    }
    if (printer) {
      await SecureStore.setItemAsync(TEJ_PRINTER_KEY, JSON.stringify(printer));
    } else {
      await SecureStore.deleteItemAsync(TEJ_PRINTER_KEY);
    }
  } catch (error) {
    console.error('Error saving TEJ label printer:', error);
  }
}

// Multi-store inventory: which store the user is currently billing/browsing from. Shared
// between POS and Products via this one key, so picking a store on either screen carries
// over to the other (a cashier is physically at one store for a whole shift, not per-item).
const SELECTED_STORE_KEY = 'selected_store_id';

export async function getStoredSelectedStoreId(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(SELECTED_STORE_KEY) : null;
    }
    return await SecureStore.getItemAsync(SELECTED_STORE_KEY);
  } catch (error) {
    console.error('Error reading selected store:', error);
    return null;
  }
}

export async function setStoredSelectedStoreId(storeId: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        if (storeId) window.localStorage.setItem(SELECTED_STORE_KEY, storeId);
        else window.localStorage.removeItem(SELECTED_STORE_KEY);
      }
      return;
    }
    if (storeId) {
      await SecureStore.setItemAsync(SELECTED_STORE_KEY, storeId);
    } else {
      await SecureStore.deleteItemAsync(SELECTED_STORE_KEY);
    }
  } catch (error) {
    console.error('Error saving selected store:', error);
  }
}

// Notification Inbox Storage
const NOTIFICATIONS_STORAGE_KEY = 'seznik_notifications_list';
const NOTIF_PREFS_STORAGE_KEY = 'seznik_notification_preferences';

export async function getStoredNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) : null;
    }
    return await SecureStore.getItemAsync(NOTIFICATIONS_STORAGE_KEY);
  } catch (error) {
    console.error('Error reading stored notifications:', error);
    return null;
  }
}

export async function setStoredNotifications(json: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, json);
      }
      return;
    }
    await SecureStore.setItemAsync(NOTIFICATIONS_STORAGE_KEY, json);
  } catch (error) {
    console.error('Error saving notifications:', error);
  }
}

export async function getStoredNotificationPreferences(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(NOTIF_PREFS_STORAGE_KEY) : null;
    }
    return await SecureStore.getItemAsync(NOTIF_PREFS_STORAGE_KEY);
  } catch (error) {
    console.error('Error reading notification preferences:', error);
    return null;
  }
}

export async function setStoredNotificationPreferences(json: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(NOTIF_PREFS_STORAGE_KEY, json);
      }
      return;
    }
    await SecureStore.setItemAsync(NOTIF_PREFS_STORAGE_KEY, json);
  } catch (error) {
    console.error('Error saving notification preferences:', error);
  }
}

// Josh Dual-Mode Printer Tip Storage (shows at most 2 times to prevent irritating the user)
const JOSH_DUAL_MODE_TIP_KEY = 'seznik_josh_dual_mode_tip_count';

export async function getStoredJoshDualModeTipCount(): Promise<number> {
  try {
    if (Platform.OS === 'web') {
      const val = typeof window !== 'undefined' ? window.localStorage.getItem(JOSH_DUAL_MODE_TIP_KEY) : null;
      return val ? parseInt(val, 10) || 0 : 0;
    }
    const val = await SecureStore.getItemAsync(JOSH_DUAL_MODE_TIP_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch (error) {
    console.error('Error reading Josh dual-mode tip count:', error);
    return 0;
  }
}

export async function setStoredJoshDualModeTipCount(count: number): Promise<void> {
  try {
    const val = String(count);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(JOSH_DUAL_MODE_TIP_KEY, val);
      }
      return;
    }
    await SecureStore.setItemAsync(JOSH_DUAL_MODE_TIP_KEY, val);
  } catch (error) {
    console.error('Error saving Josh dual-mode tip count:', error);
  }
}

// Persistent Store Settings (business name, address, phone, GSTIN, UPI, logo, receipt config)
const SETTINGS_STORAGE_KEY = 'seznik_store_settings';

export async function getStoredSettings<T = any>(): Promise<T | null> {
  try {
    let json: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        json = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      }
    } else {
      json = await SecureStore.getItemAsync(SETTINGS_STORAGE_KEY);
    }
    return json ? (JSON.parse(json) as T) : null;
  } catch (error) {
    console.error('Error reading stored settings:', error);
    return null;
  }
}

export async function setStoredSettings(settings: any): Promise<void> {
  try {
    if (!settings) return;
    const json = JSON.stringify(settings);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, json);
      }
    } else {
      await SecureStore.setItemAsync(SETTINGS_STORAGE_KEY, json);
    }
  } catch (error) {
    console.error('Error saving stored settings:', error);
  }
}

