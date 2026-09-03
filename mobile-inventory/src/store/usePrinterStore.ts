import { create } from 'zustand';
import { playPrinterConnectFeedback } from '@/utils/printerConnectFeedback';
import { ConnectionState, PrinterDevice } from '../types';
import PrinterService from '../services/PrinterService';
import { settingsApi } from '../api/settings';
import { DEFAULT_TEMPLATE_ID } from '../constants/receiptTemplates';
import { LabelTemplate } from '../types/labelTemplate';
import { CustomReceiptTemplate, createDefaultReceiptTemplate } from '../types/customReceipt';
import { ensureTemplateHasLogoBlock } from '../utils/receiptLogo';
import type { ReceiptSizeChip } from '@shared/receiptPrintGeometry';
import {
  getStoredActiveTemplate,
  setStoredActiveTemplate,
  getStoredCustomReceiptTemplates,
  setStoredCustomReceiptTemplates,
  getStoredActiveCustomReceiptTemplate,
  setStoredActiveCustomReceiptTemplate,
  getStoredEnableBillQr,
  setStoredEnableBillQr,
  getStoredPairedPrinters,
  setStoredPairedPrinters,
  getStoredAutoConnect,
  setStoredAutoConnect,
  getStoredLabelTemplates,
  setStoredLabelTemplates,
  getStoredActiveLabelTemplate,
  setStoredActiveLabelTemplate,
  getStoredPrinterCalibration,
  setStoredPrinterCalibration,
} from '@/services/secureStore';

/** Backoff for automatic reconnects after an unexpected drop. Deliberately brief so app reload is instant. */
const AUTO_RECONNECT_DELAYS_MS = [1500];

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
  /** User-configured logo size on receipt: small, medium, large */
  receiptLogoSize: ReceiptSizeChip;
  /** User-configured QR code size on receipt: small, medium, large */
  receiptQrSize: ReceiptSizeChip;
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

  /** True while an automatic reconnect is being retried in the background after an unexpected drop. */
  isAutoReconnecting: boolean;
  /** True when the user explicitly disconnected, preventing auto-reconnect from firing immediately */
  isUserDisconnected: boolean;

  initListener: () => () => void;
  scanForDevices: () => Promise<void>;
  /** Rejects when the printer can't be reached — callers must handle it rather than assuming success.
   *  `opts.auto` marks background auto-reconnect attempts, which yield to any user-initiated action. */
  connectDevice: (deviceId: string, deviceName?: string, opts?: { auto?: boolean }) => Promise<void>;
  disconnectDevice: () => Promise<void>;
  /** Reconnects to the default (or most recently used) saved printer. No-op when autoConnect is off. */
  attemptAutoConnect: () => Promise<void>;
  addPairedPrinter: (device: PrinterDevice) => Promise<void>;
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
  setReceiptLogoSize: (size: ReceiptSizeChip) => Promise<void>;
  setReceiptQrSize: (size: ReceiptSizeChip) => Promise<void>;
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
    receiptLogoSize?: ReceiptSizeChip;
    receiptQrSize?: ReceiptSizeChip;
  }) => Promise<void>;
  /** Selects a receipt template and persists it immediately (discrete choice, not a slider — no separate Save step). */
  setActiveTemplate: (templateId: string) => Promise<void>;
  /** Loads persisted calibration + template from the backend Settings row. Call once on app boot / Printers page mount. */
  hydrateFromSettings: () => Promise<void>;
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  connectionState: 'disconnected',
  activeDevice: null,
  isAutoReconnecting: false,
  isUserDisconnected: false,
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
  receiptLogoSize: 'medium',
  receiptQrSize: 'medium',
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
    // Mirrors PrinterService into store state. Must be mounted once at app root: every screen gates
    // printing on connectionState, so without this subscription a printer that is switched off or
    // out of range still reads as "Ready" until the user manually disconnects.
    const unsubscribeStatus = PrinterService.onStatusChange((state) => {
      const warningText = PrinterService.getWarningText();
      const activeDevice = PrinterService.getActiveDevice();

      let pairedToPersist: PhoneBluetoothDevice[] | null = null;

      set((prev) => {
        const updatedPaired = [...prev.pairedPrinters];
        const justConnected = activeDevice && state === 'connected' && prev.connectionState !== 'connected';
        if (justConnected) {
          playPrinterConnectFeedback();
        }
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
          pairedToPersist = updatedPaired;
        }
        return { connectionState: state, warningText, activeDevice, pairedPrinters: updatedPaired };
      });

      if (pairedToPersist) {
        setStoredPairedPrinters(pairedToPersist).catch(() => {});
      }
    });

    // Unexpected drops only (printer switched off / out of range), never a user-initiated disconnect.
    const unsubscribeLost = PrinterService.onConnectionLost(() => {
      if (!get().autoConnect || get().isUserDisconnected) return;
      get().attemptAutoConnect().catch(() => {});
    });

    return () => {
      unsubscribeStatus();
      unsubscribeLost();
    };
  },

  scanForDevices: async () => {
    // The user asked to scan — a background auto-reconnect must not hold the radio
    // hostage (an Android inquiry and an RFCOMM handshake fight each other, and the
    // old behavior also blocked tapping any found printer until auto-connect gave up).
    PrinterService.cancelAutoConnect();

    // Keep whatever is already on screen. Wiping the list meant a printer found seconds ago
    // vanished the moment the user tapped "Scan Again"; re-discovery simply refreshes each entry.
    set({ isScanning: true, warningText: '', isUserDisconnected: false });

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

  /**
   * Throws when the printer can't be reached. That rejection is the contract callers rely on —
   * swallowing it here previously let the connect modal report success, close itself, and leave the
   * rest of the app printing into a socket that was never opened.
   */
  connectDevice: async (deviceId: string, deviceName?: string, opts?: { auto?: boolean }) => {
    if (!opts?.auto) {
      set({ isUserDisconnected: false });
    }
    await PrinterService.connect(deviceId, deviceName, opts);

    const target =
      get().pairedPrinters.find((p) => p.id === deviceId) ||
      get().scannedDevices.find((p) => p.id === deviceId) || {
        id: deviceId,
        name: deviceName || `Bluetooth Printer (${deviceId.slice(-6)})`,
        macAddress: deviceId,
        type: 'receipt' as const,
        statusTag: 'Paired' as const,
      };

    let pairedToPersist: PhoneBluetoothDevice[] = [];

    set((prev) => {
      const exists = prev.pairedPrinters.some((p) => p.id === deviceId);
      const updatedPaired = exists
        ? prev.pairedPrinters.map((p) => (p.id === deviceId ? { ...p, lastConnected: 'Active Now' } : p))
        : [...prev.pairedPrinters, { ...target, isDefault: prev.pairedPrinters.length === 0, lastConnected: 'Active Now' }];

      pairedToPersist = updatedPaired;

      return {
        activeDevice: target,
        isUserDisconnected: false,
        // Mirrors what PrinterService already reported; the status subscription remains the
        // authority, this just avoids a frame of stale state for screens reading it immediately.
        connectionState: PrinterService.getActiveDevice() ? 'connected' : prev.connectionState,
        warningText: PrinterService.getWarningText(),
        pairedPrinters: updatedPaired,
        scannedDevices: prev.scannedDevices.map((d) => (d.id === deviceId ? { ...d, statusTag: 'Paired' } : d)),
      };
    });

    await setStoredPairedPrinters(pairedToPersist);
  },

  disconnectDevice: async () => {
    try {
      // A deliberate disconnect also means "stop trying to reconnect for me".
      PrinterService.cancelAutoConnect();
      set({ isUserDisconnected: true, isAutoReconnecting: false });
      await PrinterService.disconnect();
      set({ activeDevice: null, connectionState: 'disconnected', warningText: '', isAutoReconnecting: false, isUserDisconnected: true });
    } catch (e) {
      // Ignored
    }
  },

  /**
   * Reconnects to the saved default printer, retrying with backoff. Used both on app boot and after
   * an unexpected drop, so a printer that browns out mid-shift comes back without the cashier
   * having to open the Printers screen.
   */
  attemptAutoConnect: async () => {
    const { autoConnect, pairedPrinters, isAutoReconnecting, connectionState, nativeModuleAvailable, isUserDisconnected } = get();
    if (!autoConnect || isAutoReconnecting || connectionState === 'connected' || isUserDisconnected) return;
    // Nothing to reconnect to in Expo Go / a build without the native Bluetooth module — retrying
    // would just log three guaranteed failures on every launch.
    if (!nativeModuleAvailable) return;

    const target =
      PrinterService.getLastConnectedDevice() ||
      pairedPrinters.find((p) => p.isDefault) ||
      pairedPrinters[0];
    if (!target) return;

    // Do NOT auto-reconnect to a dedicated Josh label printer if Josh is supported
    const isDedicatedJosh = /^(LD|LP|JOSH)/i.test(target.name || '') && PrinterService.isJoshSupported();
    if (isDedicatedJosh) return;

    set({ isAutoReconnecting: true });
    try {
      for (let attempt = 0; attempt < AUTO_RECONNECT_DELAYS_MS.length; attempt++) {
        // The user may have connected manually, deliberately disconnected, or started a
        // scan while we waited — all of those own the radio now, so the background
        // reconnect steps aside instead of fighting them for it.
        if (get().connectionState === 'connected' || !get().autoConnect || get().isScanning) return;

        await new Promise((resolve) => setTimeout(resolve, AUTO_RECONNECT_DELAYS_MS[attempt]));

        if (get().connectionState === 'connected' || !get().autoConnect || get().isScanning) return;

        try {
          // Marked auto so a user tapping a different printer mid-attempt preempts
          // this connect instead of getting "another connection is in progress".
          await get().connectDevice(target.id, target.name, { auto: true });
          return;
        } catch (e: any) {
          // Cancellation means the user took over the radio (scan or manual connect) —
          // stop the whole loop instead of queueing more attempts behind their action.
          const msg = String(e?.message || '');
          if (e?.name === 'ConnectCancelled' || msg.includes('cancelled') || msg.includes('Skipped automatic reconnect')) {
            return;
          }
          console.warn(`[usePrinterStore] auto-reconnect attempt ${attempt + 1} failed:`, e);
        }
      }
      // Out of retries — leave the service's warning text in place so the UI can prompt the user.
    } finally {
      set({ isAutoReconnecting: false });
    }
  },

  addPairedPrinter: async (device: PrinterDevice) => {
    const fullDev: PhoneBluetoothDevice = {
      ...device,
      macAddress: device.macAddress || device.id,
      statusTag: 'Paired',
    };

    let pairedToPersist: PhoneBluetoothDevice[] = [];

    set((prev) => {
      const exists = prev.pairedPrinters.some((p) => p.id === device.id || p.macAddress === device.macAddress);
      const updated = exists
        ? prev.pairedPrinters
        : [...prev.pairedPrinters, { ...fullDev, isDefault: prev.pairedPrinters.length === 0, lastConnected: 'Just now' }];
      pairedToPersist = updated;
      const alreadyScanned = prev.scannedDevices.some((d) => d.id === fullDev.id || d.macAddress === fullDev.macAddress);
      return {
        pairedPrinters: updated,
        scannedDevices: alreadyScanned ? prev.scannedDevices : [...prev.scannedDevices, fullDev],
      };
    });

    await setStoredPairedPrinters(pairedToPersist);
    // Awaited (and allowed to reject) so callers can tell a real connection from a saved entry.
    await get().connectDevice(device.id, device.name);
  },

  setPaperWidth: (paperWidth) => set({ paperWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setAutoConnect: (autoConnect) => {
    set({ autoConnect });
    setStoredAutoConnect(autoConnect).catch(() => {});
    if (autoConnect) {
      get().attemptAutoConnect().catch(() => {});
    }
  },
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
    const activeLabelTemplateId = get().activeLabelTemplateId === null ? template.id : get().activeLabelTemplateId;
    set({ labelTemplates, activeLabelTemplateId });
    await setStoredLabelTemplates(labelTemplates);
    if (get().activeLabelTemplateId === null) {
      await setStoredActiveLabelTemplate(template.id);
    }
    try {
      await settingsApi.updateLabelConfig({ templates: labelTemplates, activeTemplateId: activeLabelTemplateId });
    } catch (e) {
      console.warn('Could not sync label templates to server, persisted locally:', e);
    }
  },

  deleteLabelTemplate: async (id) => {
    const labelTemplates = get().labelTemplates.filter((t) => t.id !== id);
    const activeLabelTemplateId = get().activeLabelTemplateId === id ? null : get().activeLabelTemplateId;
    set({ labelTemplates, activeLabelTemplateId });
    await setStoredLabelTemplates(labelTemplates);
    if (get().activeLabelTemplateId === id) {
      await setStoredActiveLabelTemplate(null);
    }
    try {
      await settingsApi.updateLabelConfig({ templates: labelTemplates, activeTemplateId: activeLabelTemplateId });
    } catch (e) {
      console.warn('Could not sync label template deletion to server, persisted locally:', e);
    }
  },

  setActiveLabelTemplate: async (activeLabelTemplateId) => {
    const matched = get().labelTemplates.find((t) => t.id === activeLabelTemplateId);
    if (matched) {
      set({
        activeLabelTemplateId,
        labelWidthMm: matched.widthMm,
        labelHeightMm: matched.heightMm,
      });
    } else {
      set({ activeLabelTemplateId });
    }
    await setStoredActiveLabelTemplate(activeLabelTemplateId);
    try {
      await settingsApi.updateLabelConfig({ templates: get().labelTemplates, activeTemplateId: activeLabelTemplateId });
    } catch (e) {
      console.warn('Could not sync active label template to server, persisted locally:', e);
    }
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
        deletedTemplateIds: [id],
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

  setReceiptLogoSize: async (size) => {
    set({ receiptLogoSize: size });
    try {
      await settingsApi.updateReceiptConfig({ receiptLogoSize: size });
    } catch (e) {
      console.warn('[usePrinterStore] Could not sync receiptLogoSize:', e);
    }
  },

  setReceiptQrSize: async (size) => {
    set({ receiptQrSize: size });
    try {
      await settingsApi.updateReceiptConfig({ receiptQrSize: size });
    } catch (e) {
      console.warn('[usePrinterStore] Could not sync receiptQrSize:', e);
    }
  },

  savePrinterCalibration: async (config) => {
    set(config);
    setStoredPrinterCalibration({
      paperWidth: config.paperWidth,
      printDensity: config.printDensity,
      topMargin: config.topMargin,
      autoCut: config.autoCut,
      printCopies: config.printCopies,
      fontSize: config.fontSize,
      receiptLogoSize: config.receiptLogoSize || get().receiptLogoSize,
      receiptQrSize: config.receiptQrSize || get().receiptQrSize,
      labelPaperMode: config.labelPaperMode,
      labelWidthMm: config.labelWidthMm,
      labelHeightMm: config.labelHeightMm,
      labelGapMm: config.labelGapMm,
    }).catch(() => {});
    await settingsApi.updatePrinterConfig({
      paperWidth: config.paperWidth,
      paperSize: config.paperWidth,
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
    if (config.receiptLogoSize || config.receiptQrSize) {
      try {
        await settingsApi.updateReceiptConfig({
          receiptLogoSize: config.receiptLogoSize || get().receiptLogoSize,
          receiptQrSize: config.receiptQrSize || get().receiptQrSize,
        });
      } catch (err) {
        console.warn('[usePrinterStore] Could not sync receipt size settings:', err);
      }
    }
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
      const [
        localTemplateId,
        localCustomTemplates,
        localActiveCustomId,
        localEnableBillQr,
        localPairedPrinters,
        localAutoConnect,
        localLabelTemplates,
        localActiveLabelId,
        localCalibration,
      ] = await Promise.all([
        getStoredActiveTemplate(),
        getStoredCustomReceiptTemplates(),
        getStoredActiveCustomReceiptTemplate(),
        getStoredEnableBillQr(),
        getStoredPairedPrinters(),
        getStoredAutoConnect(),
        getStoredLabelTemplates(),
        getStoredActiveLabelTemplate(),
        getStoredPrinterCalibration(),
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
        autoConnect: localAutoConnect,
        labelTemplates: localLabelTemplates || get().labelTemplates,
        activeLabelTemplateId: localActiveLabelId !== undefined ? localActiveLabelId : get().activeLabelTemplateId,
        ...(localCalibration ? {
          paperWidth: localCalibration.paperWidth || get().paperWidth,
          printDensity: typeof localCalibration.printDensity === 'number' ? localCalibration.printDensity : get().printDensity,
          topMargin: typeof localCalibration.topMargin === 'number' ? localCalibration.topMargin : get().topMargin,
          autoCut: typeof localCalibration.autoCut === 'boolean' ? localCalibration.autoCut : get().autoCut,
          printCopies: typeof localCalibration.printCopies === 'number' ? localCalibration.printCopies : get().printCopies,
          fontSize: localCalibration.fontSize || get().fontSize,
          receiptLogoSize: localCalibration.receiptLogoSize || get().receiptLogoSize,
          receiptQrSize: localCalibration.receiptQrSize || get().receiptQrSize,
          labelPaperMode: localCalibration.labelPaperMode || get().labelPaperMode,
          labelWidthMm: typeof localCalibration.labelWidthMm === 'number' ? localCalibration.labelWidthMm : get().labelWidthMm,
          labelHeightMm: typeof localCalibration.labelHeightMm === 'number' ? localCalibration.labelHeightMm : get().labelHeightMm,
          labelGapMm: typeof localCalibration.labelGapMm === 'number' ? localCalibration.labelGapMm : get().labelGapMm,
        } : {}),
      });

      // Restore the saved printers before anything else awaits the network
      if (localPairedPrinters && localPairedPrinters.length > 0 && get().pairedPrinters.length === 0) {
        set({ pairedPrinters: localPairedPrinters });
        if (localAutoConnect) {
          get().attemptAutoConnect().catch(() => {});
        }
      }

      // 2. Fetch server settings to sync cloud configuration
      const settings = await settingsApi.getSettings();
      const printerConfig = (settings?.printerConfig || {}) as Record<string, any>;
      const receiptConfig = (settings?.receiptConfig || {}) as Record<string, any>;
      const labelConfig = (settings?.labelConfig || {}) as Record<string, any>;

      const effectiveTemplateId =
        typeof receiptConfig.templateId === 'string'
          ? receiptConfig.templateId
          : localTemplateId || get().activeTemplateId;

      let effectiveCustomTemplates = Array.isArray(receiptConfig.customTemplates) && receiptConfig.customTemplates.length > 0
        ? receiptConfig.customTemplates
        : initialTemplates;

      const activeStoreLogo =
        (typeof receiptConfig.logoURL === 'string' && receiptConfig.logoURL.trim()) ||
        (typeof settings?.businessLogoURL === 'string' && settings.businessLogoURL.trim()) ||
        undefined;

      if (activeStoreLogo) {
        PrinterService.clearLogoCache();
        effectiveCustomTemplates = effectiveCustomTemplates.map((t) =>
          ensureTemplateHasLogoBlock(t, activeStoreLogo)
        );
      }

      let effectiveActiveCustomId =
        receiptConfig.activeCustomTemplateId !== undefined
          ? receiptConfig.activeCustomTemplateId
          : localActiveCustomId;

      // One-time migration: upload device-only templates when cloud is empty
      const serverHasTemplates = Array.isArray(receiptConfig.customTemplates) && receiptConfig.customTemplates.length > 0;
      if (!serverHasTemplates && localCustomTemplates && localCustomTemplates.length > 0) {
        try {
          await settingsApi.updateReceiptConfig({
            customTemplates: localCustomTemplates,
            activeCustomTemplateId: localActiveCustomId,
            templateId: effectiveTemplateId,
            enableBillQrCode: localEnableBillQr,
          });
          effectiveCustomTemplates = localCustomTemplates;
          effectiveActiveCustomId = localActiveCustomId;
        } catch (migrateErr) {
          console.warn('[usePrinterStore] Could not migrate local templates to server:', migrateErr);
        }
      }

      const effectiveEnableBillQr =
        typeof receiptConfig.enableBillQrCode === 'boolean'
          ? receiptConfig.enableBillQrCode
          : localEnableBillQr;

      const effectiveLabelTemplates =
        Array.isArray(labelConfig.templates) && labelConfig.templates.length > 0
          ? labelConfig.templates
          : localLabelTemplates || get().labelTemplates;

      const effectiveActiveLabelId =
        typeof labelConfig.activeTemplateId === 'string' || labelConfig.activeTemplateId === null
          ? labelConfig.activeTemplateId
          : localActiveLabelId !== undefined
          ? localActiveLabelId
          : get().activeLabelTemplateId;

      if (effectiveTemplateId) {
        await setStoredActiveTemplate(effectiveTemplateId);
      }
      if (effectiveCustomTemplates) {
        await setStoredCustomReceiptTemplates(effectiveCustomTemplates);
      }
      await setStoredActiveCustomReceiptTemplate(effectiveActiveCustomId);
      await setStoredEnableBillQr(effectiveEnableBillQr);
      if (effectiveLabelTemplates) {
        await setStoredLabelTemplates(effectiveLabelTemplates);
      }
      await setStoredActiveLabelTemplate(effectiveActiveLabelId);

      const paperFromConfig =
        printerConfig.paperWidth === '80mm' || printerConfig.paperSize === '80mm'
          ? '80mm'
          : printerConfig.paperWidth === '58mm' || printerConfig.paperSize === '58mm'
            ? '58mm'
            : get().paperWidth;

      const effectiveLogoSize: ReceiptSizeChip =
        ['small', 'medium', 'large'].includes(receiptConfig.receiptLogoSize)
          ? receiptConfig.receiptLogoSize
          : 'medium';

      const effectiveQrSize: ReceiptSizeChip =
        ['small', 'medium', 'large'].includes(receiptConfig.receiptQrSize)
          ? receiptConfig.receiptQrSize
          : 'medium';

      set({
        paperWidth: paperFromConfig,
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
        receiptLogoSize: effectiveLogoSize,
        receiptQrSize: effectiveQrSize,
        labelTemplates: effectiveLabelTemplates,
        activeLabelTemplateId: effectiveActiveLabelId,
        isHydrated: true,
      });

      setStoredPrinterCalibration({
        paperWidth: paperFromConfig,
        printDensity: typeof printerConfig.printDensity === 'number' ? printerConfig.printDensity : get().printDensity,
        topMargin: typeof printerConfig.topMargin === 'number' ? printerConfig.topMargin : get().topMargin,
        autoCut: typeof printerConfig.autoCut === 'boolean' ? printerConfig.autoCut : get().autoCut,
        printCopies: typeof printerConfig.printCopies === 'number' ? printerConfig.printCopies : get().printCopies,
        fontSize: ['small', 'medium', 'large'].includes(printerConfig.fontSize) ? printerConfig.fontSize : get().fontSize,
        receiptLogoSize: effectiveLogoSize,
        receiptQrSize: effectiveQrSize,
        labelPaperMode: ['gap', 'continuous'].includes(printerConfig.labelPaperMode) ? printerConfig.labelPaperMode : get().labelPaperMode,
        labelWidthMm: typeof printerConfig.labelWidthMm === 'number' ? printerConfig.labelWidthMm : get().labelWidthMm,
        labelHeightMm: typeof printerConfig.labelHeightMm === 'number' ? printerConfig.labelHeightMm : get().labelHeightMm,
        labelGapMm: typeof printerConfig.labelGapMm === 'number' ? printerConfig.labelGapMm : get().labelGapMm,
      }).catch(() => {});
    } catch (e) {
      // Offline / not logged in yet / timeout — keep local defaults, mark hydration attempted.
      const msg = e instanceof Error ? e.message : String(e);
      const isOfflineOrTimeout =
        msg.includes('Cannot connect to backend') ||
        msg.includes('HTTP 0') ||
        msg.includes('timed out') ||
        msg.includes('took too long') ||
        msg.includes('Failed to connect') ||
        msg.includes('Network request failed');
      if (isOfflineOrTimeout) {
        console.warn('[usePrinterStore] hydrateFromSettings offline/timeout — using local defaults');
      } else {
        console.error('[usePrinterStore] hydrateFromSettings failed:', e);
      }
      set({ isHydrated: true });
    }
  },

  setDefaultPrinter: (deviceId) => {
    let pairedToPersist: PhoneBluetoothDevice[] = [];
    set((prev) => {
      pairedToPersist = prev.pairedPrinters.map((p) => ({
        ...p,
        isDefault: p.id === deviceId,
      }));
      return { pairedPrinters: pairedToPersist };
    });
    setStoredPairedPrinters(pairedToPersist).catch(() => {});
  },
  forgetPrinter: (deviceId) => {
    let pairedToPersist: PhoneBluetoothDevice[] = [];
    set((prev) => {
      pairedToPersist = prev.pairedPrinters.filter((p) => p.id !== deviceId);
      return {
        pairedPrinters: pairedToPersist,
        scannedDevices: prev.scannedDevices.filter((p) => p.id !== deviceId),
        activeDevice: prev.activeDevice?.id === deviceId ? null : prev.activeDevice,
        connectionState: prev.activeDevice?.id === deviceId ? 'disconnected' : prev.connectionState,
      };
    });
    setStoredPairedPrinters(pairedToPersist).catch(() => {});
    // Forgetting the printer that is currently connected should also drop the physical socket,
    // otherwise the printer stays bonded and the next print silently succeeds on a "forgotten" device.
    if (deviceId === PrinterService.getActiveDevice()?.id) {
      PrinterService.disconnect().catch(() => {});
    }
  },
}));

// Eagerly trigger hydration on store initialization so active template is available immediately
usePrinterStore.getState().hydrateFromSettings().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (!msg.includes('Cannot connect to backend')) {
    console.error('[usePrinterStore] eager hydrate failed:', e);
  }
});

// Re-sync receipt templates when app returns to foreground (web/mobile parity)
try {
  const { AppState } = require('react-native');
  AppState.addEventListener('change', (state: string) => {
    if (state === 'active') {
      usePrinterStore.getState().hydrateFromSettings().catch(() => {});
    }
  });
} catch {
  // non-RN environment
}
