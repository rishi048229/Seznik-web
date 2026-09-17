export type SeznikPrinterModelId = 'josh' | 'dev' | 'veer' | 'other' | 'rudra' | 'tejas';

export interface SeznikPrinterModel {
  id: SeznikPrinterModelId;
  name: string;
  tagline: string;
  typeBadge: 'Receipt + Label' | 'Receipt Only';
  driver: string;
  driverType: 'escpos' | 'josh' | 'td404';
  image: any;
  isNonSeznik?: boolean;
  capabilities: {
    receipts: boolean;
    labels: boolean;
    barcodes: boolean;
    qrCodes: boolean;
    highResBitmap: boolean;
  };
  badgeColor: string;
  badgeTextColor: string;
  description: string;
  warningNotice?: string;
  connectionHelp: string;
}

export const SEZNIK_PRINTER_MODELS: Record<SeznikPrinterModelId, SeznikPrinterModel> = {
  josh: {
    id: 'josh',
    name: 'SEZNIK JOSH',
    tagline: 'Official Dual-Mode Smart Printer (Receipt + Label)',
    typeBadge: 'Receipt + Label',
    driver: 'JOSH Smart Driver',
    driverType: 'josh',
    image: require('@/assets/images/printers/printer_josh.png'),
    isNonSeznik: false,
    capabilities: {
      receipts: true,
      labels: true,
      barcodes: true,
      qrCodes: true,
      highResBitmap: true,
    },
    badgeColor: '#F5F3FF',
    badgeTextColor: '#7C3AED',
    description: 'Official SEZNIK smart dual-mode printer with optical gap sensor and native LPAPI vector engine.',
    warningNotice: 'Official SEZNIK Hardware: Supports high-speed 2-in-1 sticker label & thermal receipt printing.',
    connectionHelp: 'Power on SEZNIK JOSH and connect via the JOSH Smart Connector.',
  },
  dev: {
    id: 'dev',
    name: 'SEZNIK DEV',
    tagline: 'Official 2-in-1 POS & Label Thermal Printer',
    typeBadge: 'Receipt + Label',
    driver: 'Standard Bluetooth (ESC/POS)',
    driverType: 'escpos',
    image: require('@/assets/images/printers/printer_dev.jpg'),
    isNonSeznik: false,
    capabilities: {
      receipts: true,
      labels: true,
      barcodes: true,
      qrCodes: true,
      highResBitmap: false,
    },
    badgeColor: '#EFF6FF',
    badgeTextColor: '#2563EB',
    description: 'Official SEZNIK DEV printer for multi-format thermal bill & sticker label printing.',
    warningNotice: 'Official SEZNIK Hardware: Supports direct Bluetooth billing and label creation.',
    connectionHelp: 'Pair via Bluetooth in phone settings, then tap to connect.',
  },
  veer: {
    id: 'veer',
    name: 'SEZNIK VEER',
    tagline: 'Official High-Speed Thermal Receipt Printer',
    typeBadge: 'Receipt Only',
    driver: 'Standard Bluetooth (ESC/POS)',
    driverType: 'escpos',
    image: require('@/assets/images/printers/printer_veer.jpg'),
    isNonSeznik: false,
    capabilities: {
      receipts: true,
      labels: false,
      barcodes: true,
      qrCodes: true,
      highResBitmap: false,
    },
    badgeColor: '#ECFDF5',
    badgeTextColor: '#059669',
    description: 'Official SEZNIK compact high-speed thermal receipt printer for sales bills, KOT, and daybook.',
    warningNotice: 'Official SEZNIK Hardware: Optimized for ultra-fast point-of-sale thermal receipts.',
    connectionHelp: 'Pair via Bluetooth in phone settings, then select and connect.',
  },
  other: {
    id: 'other',
    name: 'Other Printers',
    tagline: 'Third-Party / Non-SEZNIK Bluetooth Printer',
    typeBadge: 'Receipt Only',
    driver: 'Generic ESC/POS Driver',
    driverType: 'escpos',
    image: require('@/assets/images/printers/printer_dev.jpg'),
    isNonSeznik: true,
    capabilities: {
      receipts: true,
      labels: false,
      barcodes: true,
      qrCodes: true,
      highResBitmap: false,
    },
    badgeColor: '#FEF3C7',
    badgeTextColor: '#D97706',
    description: 'Third-party generic Bluetooth printer. Configured for thermal bill & receipt printing.',
    warningNotice: '⚠️ Non-SEZNIK Printer: Only receipt printing is supported on third-party printers. Label printing is exclusive to official SEZNIK hardware.',
    connectionHelp: 'Pair via Bluetooth in phone settings, then tap to connect.',
  },
  rudra: {
    id: 'rudra',
    name: 'SEZNIK RUDRA',
    tagline: 'Industrial 80mm/58mm Dual-Mode Label & Receipt Printer',
    typeBadge: 'Receipt + Label',
    driver: 'TD-404 / Ninestar SDK',
    driverType: 'td404',
    image: require('@/assets/images/printers/printer_rudra.png'),
    isNonSeznik: false,
    capabilities: {
      receipts: true,
      labels: true,
      barcodes: true,
      qrCodes: true,
      highResBitmap: true,
    },
    badgeColor: '#EEF2FF',
    badgeTextColor: '#4F46E5',
    description: 'Heavy-duty industrial thermal printer supporting 80mm & 58mm receipts and die-cut labels.',
    warningNotice: 'Official SEZNIK Hardware: High-volume 80mm/58mm dual-mode receipt and TSPL label engine.',
    connectionHelp: 'Turn on SEZNIK RUDRA, pair Bluetooth, and connect instantly.',
  },
  tejas: {
    id: 'tejas',
    name: 'SEZNIK TEJAS',
    tagline: 'Desktop 80mm/58mm Smart Dual-Mode Printer',
    typeBadge: 'Receipt + Label',
    driver: 'TD-404 / Ninestar SDK',
    driverType: 'td404',
    image: require('@/assets/images/printers/printer_tejas.png'),
    isNonSeznik: false,
    capabilities: {
      receipts: true,
      labels: true,
      barcodes: true,
      qrCodes: true,
      highResBitmap: true,
    },
    badgeColor: '#F0FDF4',
    badgeTextColor: '#16A34A',
    description: 'Sleek desktop dual-mode thermal printer for 80mm & 58mm receipts and all label formats.',
    warningNotice: 'Official SEZNIK Hardware: Ultra-compact, fast 80mm receipt and sticker label printer.',
    connectionHelp: 'Turn on SEZNIK TEJAS, pair Bluetooth, and connect instantly.',
  },
};

export const PRINTER_MODEL_LIST: SeznikPrinterModel[] = [
  SEZNIK_PRINTER_MODELS.josh,
  SEZNIK_PRINTER_MODELS.dev,
  SEZNIK_PRINTER_MODELS.veer,
  SEZNIK_PRINTER_MODELS.other,
  SEZNIK_PRINTER_MODELS.rudra,
  SEZNIK_PRINTER_MODELS.tejas,
];
