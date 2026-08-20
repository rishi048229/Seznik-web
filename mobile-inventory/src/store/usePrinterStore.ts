import { Alert } from 'react-native';
import { create } from 'zustand';
import { ConnectionState, PrinterDevice } from '../types';
import PrinterService from '../services/PrinterService';
import { settingsApi } from '../api/settings';
import { DEFAULT_TEMPLATE_ID } from '../constants/receiptTemplates';
import { LabelTemplate } from '../types/labelTemplate';
import { CustomReceiptTemplate, createDefaultReceiptTemplate } from '../types/customReceipt';
import {
  getStoredActiveTemplate,
  setStoredActiveTemplate,
  getStoredCustomReceiptTemplates,
  setStoredCustomReceiptTemplates,
  getStoredActiveCustomReceiptTemplate,
  setStoredActiveCustomReceiptTemplate,
  getStoredEnableBillQr,
  setStoredEnableBillQr,
} from '@/services/secureStore';

export interface PhoneBluetoothDevice extends PrinterDevice {
  statusTag?: 'Paired' | 'New';
  macAddress: string;
  isDefault?: boolean;
  lastConnected?: string;
  firmware?: string;
}

interface PrinterState {
  connectionState: ConnectionState;
  activeDevice: PrinterDevice | null;
  scannedDevices: PhoneBluetoothDevice[];
  isScanning: boolean;
  warningText: string;
  nativeModuleAvailable: boolean;
  paperWidth: '58mm' | '80mm';
  autoConnect: boolean;
  fontSize: 'small' | 'medium' | 'large';
  pairedPrinters: PhoneBluetoothDevice[];
  printDensity: number;
  autoCut: boolean;
  printCopies: number;
  /** Blank feed lines before print starts — see PrinterService's topMargin handling. */
  topMargin: number;
  /** Selected receipt template id (see src/constants/receiptTemplates.ts). Determines what every subsequent POS bill prints as. */
  activeTemplateId: string;
  /** Custom designed receipt templates */
  customTemplates: CustomReceiptTemplate[];
  /** Active custom receipt template id (null if using standard preset) */
  activeCustomTemplateId: string | null;
  /** Whether to print dynamic Digital Bill PDF QR code on bills */
  enableBillQrCode: boolean;
  /**
   * 'gap' = die-cut label stock on a separate TSPL label printer (gap sensor between labels).
   * 'continuous' = barcode/QR labels printed on the connected ESC/POS thermal RECEIPT roll instead
   * (no gap sensor involved at all — it's just the receipt paper). Lets stores with only a receipt
   * printer print real scannable labels instead of the old HTML fallback's unreadable text.
   */
  labelPaperMode: 'gap' | 'continuous';
  /**
   * The physical die-cut label stock's real size in mm — only meaningful in 'gap' mode. Every
   * TSPL text/barcode/QR position is computed FROM these numbers (see PrinterService.buildTsplLabelFields),
   * so if they don't match the actual roll loaded in the printer, content is centered for the wrong
   * canvas and can overflow past the real label edge onto the next one. Defaults (50x30mm, 2mm gap)
   * match what was previously hardcoded — override these once the real stock size is confirmed.
   */
  labelWidthMm: number;
  labelHeightMm: number;
  labelGapMm: number;
  /** User-designed label layouts from Label Studio (Printers > Label > Open Label Studio). */
  labelTemplates: LabelTemplate[];
  /** Which saved template (if any) real label prints use — see PrinterService.printLabelFromTemplate.
   *  Null means "no custom template yet", falling back to buildTsplLabelFields's auto-layout. */
  activeLabelTemplateId: string | null;
  /** True once hydrateFromSettings() has resolved (successfully or not) — lets screens avoid flashing default values before the real saved calibration loads. */
  isHydrated: boolean;

  initListener: () => () => void;
  scanForDevices: () => Promise<void>;
  connectDevice: (deviceId: string, deviceName?: string) => Promise<void>;
  disconnectDevice: () => Promise<void>;
  addPairedPrinter: (device: PrinterDevice) => void;
  setPaperWidth: (width: '58mm' | '80mm') => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setAutoConnect: (val: boolean) => void;
  setPrintDensity: (density: number) => void;
  setAutoCut: (val: boolean) => void;
  setPrintCopies: (copies: number) => void;
  setTopMargin: (margin: number) => void;
  setLabelPaperMode: (mode: 'gap' | 'continuous') => void;
  setLabelWidthMm: (mm: number) => void;
  setLabelHeightMm: (mm: number) => void;
  setLabelGapMm: (mm: number) => void;
  /** Upserts by id (existing id -> replace, new id -> append) and persists the whole templates array. */
  saveLabelTemplate: (template: LabelTemplate) => Promise<void>;
  deleteLabelTemplate: (id: string) => Promise<void>;
  setActiveLabelTemplate: (id: string | null) => Promise<void>;
  /** Custom receipt builder methods */
  saveCustomTemplate: (template: CustomReceiptTemplate) => Promise<void>;
  deleteCustomTemplate: (id: string) => Promise<void>;
  duplicateCustomTemplate: (id: string) => Promise<CustomReceiptTemplate>;
  setActiveCustomTemplate: (id: string | null) => Promise<void>;
  setEnableBillQrCode: (val: boolean) => Promise<void>;
  setDefaultPrinter: (deviceId: string) => void;
  forgetPrinter: (deviceId: string) => void;
  /** Persists paperWidth/printDensity/topMargin/autoCut/printCopies/fontSize/labelPaperMode/labelWidthMm/labelHeightMm/labelGapMm together — call from the Printers "Save Calibration" button. */
  savePrinterCalibration: (config: {
    paperWidth: '58mm' | '80mm';
    printDensity: number;
    topMargin: number;
    autoCut: boolean;
    printCopies: number;
    fontSize: 'small' | 'medium' | 'large';
    labelPaperMode: 'gap' | 'continuous';
    labelWidthMm: number;
    labelHeightMm: number;
    labelGapMm: number;
  }) => Promise<void>;
  /** Selects a receipt template and persists it immediately (discrete choice, not a slider — no separate Save step). */
  setActiveTemplate: (templateId: string) => Promise<void>;
  /** Loads persisted calibration + template from the backend Settings row. Call once on app boot / Printers page mount. */
  hydrateFromSettings: () => Promise<void>;
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  connectionState: 'disconnected',
  activeDevice: null,
  // Starts empty — populated only from the phone's real Bluetooth adapter via scanForDevices().
  scannedDevices: [],
  isScanning: false,
  warningText: '',
  nativeModuleAvailable: PrinterService.isNativeModuleAvailable(),
  paperWidth: '58mm',
  autoConnect: true,
  fontSize: 'medium',
  pairedPrinters: [],
  printDensity: 3,
  autoCut: true,
  printCopies: 1,
  topMargin: 2,
  activeTemplateId: DEFAULT_TEMPLATE_ID,
  customTemplates: [],
  activeCustomTemplateId: null,
  enableBillQrCode: true,
  // Defaults to 'gap' (the pre-existing TSPL label-printer behavior) so nothing changes for stores
  // that already have a separate die-cut label printer set up — 'continuous' is an opt-in switch.
  labelPaperMode: 'gap',
  // Measured on the real SEZNIK label stock (user-confirmed, explicit): 50mm wide x 30mm tall,
  // landscape — matches what was originally hardcoded before any of this was made configurable.
  // Adjustable via the calibration steppers if a different roll is ever loaded.
  labelWidthMm: 50,
  labelHeightMm: 30,
  labelGapMm: 2,
  labelTemplates: [],
  activeLabelTemplateId: null,
  isHydrated: false,

  initListener: () => {
    // Subscribe to changes in PrinterService
    const unsubscribe = PrinterService.onStatusChange((state) => {
      const warningText = (PrinterService as any).getWarningText ? (PrinterService as any).getWarningText() : '';
      const activeDevice = (PrinterService as any).getActiveDevice ? (PrinterService as any).getActiveDevice() : null;

      set((prev) => {
        let updatedPaired = [...prev.pairedPrinters];
        if (activeDevice && state === 'connected') {
          const idx = updatedPaired.findIndex((d) => d.id === activeDevice.id);
          const nowStr = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          if (idx >= 0) {
            updatedPaired[idx] = {
              ...updatedPaired[idx],
              lastConnected: nowStr,
            };
          } else {
            updatedPaired.push({
              ...activeDevice,
              isDefault: updatedPaired.length === 0,
              lastConnected: nowStr,
              macAddress: activeDevice.macAddress || activeDevice.id,
              statusTag: 'Paired',
            });
          }
        }
        return { connectionState: state, warningText, activeDevice, pairedPrinters: updatedPaired };
      });
    });
    return unsubscribe;
  },

  scanForDevices: async () => {
    set({ isScanning: true, scannedDevices: [], warningText: '' });

    // Live-merge each device the moment the phone's Bluetooth adapter reports it,
    // instead of waiting for the whole ~12s discovery window to finish.
    const mergeDevice = (d: PrinterDevice & { bonded?: boolean }) => {
      set((prev) => {
        const macAddress = d.macAddress || d.id;
        const existingIdx = prev.scannedDevices.findIndex((sd) => sd.id === d.id || sd.macAddress === macAddress);
        const entry: PhoneBluetoothDevice = {
          ...d,
          macAddress,
          statusTag: d.bonded ? 'Paired' : 'New',
        };
        const scannedDevices =
          existingIdx >= 0
            ? prev.scannedDevices.map((sd, i) => (i === existingIdx ? entry : sd))
            : [...prev.scannedDevices, entry];
        return { scannedDevices };
      });
    };

    try {
      await PrinterService.scanForDevices((device, bonded) => mergeDevice({ ...device, bonded }));
    } finally {
      set({ isScanning: false, warningText: (PrinterService as any).getWarningText?.() || '' });
    }
  },

  connectDevice: async (deviceId: string, deviceName?: string) => {
    try {
      await PrinterService.connect(deviceId, deviceName);
      const target =
        get().pairedPrinters.find((p) => p.id === deviceId) ||
        get().scannedDevices.find((p) => p.id === deviceId) || {
          id: deviceId,
          name: deviceName || `Bluetooth Printer (${deviceId.slice(-6)})`,
          macAddress: deviceId,
          type: 'receipt' as const,
          statusTag: 'Paired' as const,
        };

      set((prev) => {
        const exists = prev.pairedPrinters.some((p) => p.id === deviceId);
        const updatedPaired = exists
          ? prev.pairedPrinters.map((p) => (p.id === deviceId ? { ...p, lastConnected: 'Active Now' } : p))
          : [...prev.pairedPrinters, { ...target, isDefault: prev.pairedPrinters.length === 0, lastConnected: 'Active Now' }];

        return {
          activeDevice: target,
          connectionState: 'connected',
          pairedPrinters: updatedPaired,
          scannedDevices: prev.scannedDevices.map((d) => (d.id === deviceId ? { ...d, statusTag: 'Paired' } : d)),
        };
      });
    } catch (e: any) {
      set({ connectionState: 'disconnected', activeDevice: null });
      Alert.alert('Bluetooth Connection Failed', e?.message || 'Could not connect to Bluetooth thermal printer.');
    }
  },

  disconnectDevice: async () => {
    try {
      await PrinterService.disconnect();
      set({ activeDevice: null, connectionState: 'disconnected' });
    } catch (e) {
      // Ignored
    }
  },

  addPairedPrinter: (device: PrinterDevice) => {
    const fullDev: PhoneBluetoothDevice = {
      ...device,
      macAddress: device.macAddress || device.id,
      statusTag: 'Paired',
    };
    set((prev) => {
      const exists = prev.pairedPrinters.some((p) => p.id === device.id || p.macAddress === device.macAddress);
      const updated = exists
        ? prev.pairedPrinters
        : [...prev.pairedPrinters, { ...fullDev, isDefault: prev.pairedPrinters.length === 0, lastConnected: 'Just now' }];
      return { pairedPrinters: updated, scannedDevices: [...prev.scannedDevices, fullDev] };
    });
    get().connectDevice(device.id, device.name);
  },

  setPaperWidth: (paperWidth) => set({ paperWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setAutoConnect: (autoConnect) => set({ autoConnect }),
  setPrintDensity: (printDensity) => set({ printDensity }),
  setAutoCut: (autoCut) => set({ autoCut }),
  setPrintCopies: (printCopies) => set({ printCopies }),
  setTopMargin: (topMargin) => set({ topMargin }),
  setLabelPaperMode: (labelPaperMode) => set({ labelPaperMode }),
  setLabelWidthMm: (labelWidthMm) => set({ labelWidthMm }),
  setLabelHeightMm: (labelHeightMm) => set({ labelHeightMm }),
  setLabelGapMm: (labelGapMm) => set({ labelGapMm }),

  saveLabelTemplate: async (template) => {
    const existing = get().labelTemplates;
    const idx = existing.findIndex((t) => t.id === template.id);
    const labelTemplates = idx >= 0 ? existing.map((t, i) => (i === idx ? template : t)) : [...existing, template];
    set({ labelTemplates });
    await settingsApi.updateLabelConfig({ templates: labelTemplates, activeTemplateId: get().activeLabelTemplateId });
  },

  deleteLabelTemplate: async (id) => {
    const labelTemplates = get().labelTemplates.filter((t) => t.id !== id);
    const activeLabelTemplateId = get().activeLabelTemplateId === id ? null : get().activeLabelTemplateId;
    set({ labelTemplates, activeLabelTemplateId });
    await settingsApi.updateLabelConfig({ templates: labelTemplates, activeTemplateId: activeLabelTemplateId });
  },

  setActiveLabelTemplate: async (activeLabelTemplateId) => {
    set({ activeLabelTemplateId });
    await settingsApi.updateLabelConfig({ templates: get().labelTemplates, activeTemplateId: activeLabelTemplateId });
  },

  saveCustomTemplate: async (template) => {
    const existing = get().customTemplates;
    const idx = existing.findIndex((t) => t.id === template.id);
    const updated = idx >= 0 ? existing.map((t, i) => (i === idx ? template : t)) : [...existing, template];
    set({ customTemplates: updated });
    await setStoredCustomReceiptTemplates(updated);
    try {
      await settingsApi.updateReceiptConfig({
        customTemplates: updated,
        activeCustomTemplateId: get().activeCustomTemplateId,
        templateId: get().activeTemplateId,
        enableBillQrCode: get().enableBillQrCode,
      });
    } catch (e) {
      console.warn('Could not sync custom templates to server, persisted locally:', e);
    }
  },

  deleteCustomTemplate: async (id) => {
    const customTemplates = get().customTemplates.filter((t) => t.id !== id);
    const activeCustomTemplateId = get().activeCustomTemplateId === id ? null : get().activeCustomTemplateId;
    set({ customTemplates, activeCustomTemplateId });
    await setStoredCustomReceiptTemplates(customTemplates);
    if (get().activeCustomTemplateId === id) {
      await setStoredActiveCustomReceiptTemplate(null);
    }
    try {
      await settingsApi.updateReceiptConfig({
        customTemplates,
        activeCustomTemplateId,
        templateId: get().activeTemplateId,
        enableBillQrCode: get().enableBillQrCode,
      });
    } catch (e) {
      console.warn('Could not sync template deletion to server, persisted locally:', e);
    }
  },

  duplicateCustomTemplate: async (id) => {
    const target = get().customTemplates.find((t) => t.id === id) || createDefaultReceiptTemplate();
    const now = new Date().toISOString();
    const cloned: CustomReceiptTemplate = {
      ...target,
      id: `receipt-tpl-${Date.now()}`,
      name: `${target.name} (Copy)`,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      entries: target.entries.map((e) => ({
        ...e,
        id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      })),
    };
    await get().saveCustomTemplate(cloned);
    return cloned;
  },

  setActiveCustomTemplate: async (id) => {
    set({ activeCustomTemplateId: id });
    await setStoredActiveCustomReceiptTemplate(id);
    try {
      await settingsApi.updateReceiptConfig({
        activeCustomTemplateId: id,
        templateId: get().activeTemplateId,
        customTemplates: get().customTemplates,
        enableBillQrCode: get().enableBillQrCode,
      });
    } catch (e) {
      console.warn('Could not sync active custom template to server, persisted locally:', e);
    }
  },

  setEnableBillQrCode: async (enabled) => {
    set({ enableBillQrCode: enabled });
    await setStoredEnableBillQr(enabled);
    try {
      await settingsApi.updateReceiptConfig({
        enableBillQrCode: enabled,
        activeCustomTemplateId: get().activeCustomTemplateId,
        templateId: get().activeTemplateId,
        customTemplates: get().customTemplates,
      });
    } catch (e) {
      console.warn('Could not sync QR setting to server, persisted locally:', e);
    }
  },

  savePrinterCalibration: async (config) => {
    set(config);
    await settingsApi.updatePrinterConfig({
      paperWidth: config.paperWidth,
      printDensity: config.printDensity,
      topMargin: config.topMargin,
      autoCut: config.autoCut,
      printCopies: config.printCopies,
      fontSize: config.fontSize,
      labelPaperMode: config.labelPaperMode,
      labelWidthMm: config.labelWidthMm,
      labelHeightMm: config.labelHeightMm,
      labelGapMm: config.labelGapMm,
    });
  },

  setActiveTemplate: async (templateId) => {
    set({ activeTemplateId: templateId, activeCustomTemplateId: null });
    await setStoredActiveTemplate(templateId);
    await setStoredActiveCustomReceiptTemplate(null);
    try {
      await settingsApi.updateReceiptConfig({
        templateId,
        activeCustomTemplateId: null,
        customTemplates: get().customTemplates,
        enableBillQrCode: get().enableBillQrCode,
      });
    } catch (e) {
      console.warn('Could not sync template config to server, persisted locally:', e);
    }
  },

  hydrateFromSettings: async () => {
    try {
      // 1. First hydrate immediately from local storage for instant offline availability
      const [localTemplateId, localCustomTemplates, localActiveCustomId, localEnableBillQr] = await Promise.all([
        getStoredActiveTemplate(),
        getStoredCustomReceiptTemplates(),
        getStoredActiveCustomReceiptTemplate(),
        getStoredEnableBillQr(),
      ]);

      const initialTemplates = localCustomTemplates && localCustomTemplates.length > 0
        ? localCustomTemplates
        : [createDefaultReceiptTemplate('Standard Shop Receipt')];

      if (localTemplateId) {
        set({ activeTemplateId: localTemplateId });
      }
      set({
        customTemplates: initialTemplates,
        activeCustomTemplateId: localActiveCustomId,
        enableBillQrCode: localEnableBillQr,
      });

      // 2. Fetch server settings to sync cloud configuration
      const settings = await settingsApi.getSettings();
      const printerConfig = (settings?.printerConfig || {}) as Record<string, any>;
      const receiptConfig = (settings?.receiptConfig || {}) as Record<string, any>;
      const labelConfig = (settings?.labelConfig || {}) as Record<string, any>;

      const effectiveTemplateId =
        typeof receiptConfig.templateId === 'string'
          ? receiptConfig.templateId
          : localTemplateId || get().activeTemplateId;

      const effectiveCustomTemplates = Array.isArray(receiptConfig.customTemplates) && receiptConfig.customTemplates.length > 0
        ? receiptConfig.customTemplates
        : initialTemplates;

      const effectiveActiveCustomId =
        receiptConfig.activeCustomTemplateId !== undefined
          ? receiptConfig.activeCustomTemplateId
          : localActiveCustomId;

      const effectiveEnableBillQr =
        typeof receiptConfig.enableBillQrCode === 'boolean'
          ? receiptConfig.enableBillQrCode
          : localEnableBillQr;

      if (effectiveTemplateId) {
        await setStoredActiveTemplate(effectiveTemplateId);
      }
      if (effectiveCustomTemplates) {
        await setStoredCustomReceiptTemplates(effectiveCustomTemplates);
      }
      await setStoredActiveCustomReceiptTemplate(effectiveActiveCustomId);
      await setStoredEnableBillQr(effectiveEnableBillQr);

      set({
        paperWidth: printerConfig.paperWidth === '80mm' ? '80mm' : get().paperWidth,
        printDensity: typeof printerConfig.printDensity === 'number' ? printerConfig.printDensity : get().printDensity,
        topMargin: typeof printerConfig.topMargin === 'number' ? printerConfig.topMargin : get().topMargin,
        autoCut: typeof printerConfig.autoCut === 'boolean' ? printerConfig.autoCut : get().autoCut,
        printCopies: typeof printerConfig.printCopies === 'number' ? printerConfig.printCopies : get().printCopies,
        fontSize: ['small', 'medium', 'large'].includes(printerConfig.fontSize) ? printerConfig.fontSize : get().fontSize,
        labelPaperMode: ['gap', 'continuous'].includes(printerConfig.labelPaperMode) ? printerConfig.labelPaperMode : get().labelPaperMode,
        labelWidthMm: typeof printerConfig.labelWidthMm === 'number' ? printerConfig.labelWidthMm : get().labelWidthMm,
        labelHeightMm: typeof printerConfig.labelHeightMm === 'number' ? printerConfig.labelHeightMm : get().labelHeightMm,
        labelGapMm: typeof printerConfig.labelGapMm === 'number' ? printerConfig.labelGapMm : get().labelGapMm,
        activeTemplateId: effectiveTemplateId,
        customTemplates: effectiveCustomTemplates,
        activeCustomTemplateId: effectiveActiveCustomId,
        enableBillQrCode: effectiveEnableBillQr,
        labelTemplates: Array.isArray(labelConfig.templates) ? labelConfig.templates : get().labelTemplates,
        activeLabelTemplateId:
          typeof labelConfig.activeTemplateId === 'string' || labelConfig.activeTemplateId === null
            ? labelConfig.activeTemplateId
            : get().activeLabelTemplateId,
        isHydrated: true,
      });
    } catch (e) {
      // Offline / not logged in yet — keep local defaults, just mark hydration attempted.
      set({ isHydrated: true });
    }
  },

  setDefaultPrinter: (deviceId) =>
    set((prev) => ({
      pairedPrinters: prev.pairedPrinters.map((p) => ({
        ...p,
        isDefault: p.id === deviceId,
      })),
    })),
  forgetPrinter: (deviceId) =>
    set((prev) => ({
      pairedPrinters: prev.pairedPrinters.filter((p) => p.id !== deviceId),
      scannedDevices: prev.scannedDevices.filter((p) => p.id !== deviceId),
      activeDevice: prev.activeDevice?.id === deviceId ? null : prev.activeDevice,
      connectionState: prev.activeDevice?.id === deviceId ? 'disconnected' : prev.connectionState,
    })),
}));

// Eagerly trigger hydration on store initialization so active template is available immediately
usePrinterStore.getState().hydrateFromSettings().catch(() => {});
