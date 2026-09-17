export type SeznikPrinterModelId = 'josh' | 'dev' | 'veer';

export interface SeznikPrinterModel {
  id: SeznikPrinterModelId;
  name: string;
  tagline: string;
  typeBadge: 'Receipt + Label' | 'Receipt Only';
  driver: string;
  driverType: 'escpos' | 'josh';
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
    name: 'Other Printer (DEV 2-in-1)',
    tagline: 'Third-Party Bluetooth Thermal Printer',
    typeBadge: 'Receipt Only',
    driver: 'Standard Bluetooth (ESC/POS)',
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
    warningNotice: '⚠️ Non-SEZNIK Printer: This printer is a third-party non-SEZNIK device. Only receipt printing is supported. Label printing is exclusive to official SEZNIK hardware.',
    connectionHelp: 'Pair via Bluetooth in phone settings, then select and connect.',
  },
  veer: {
    id: 'veer',
    name: 'Other Printer (VEER Receipt)',
    tagline: 'Third-Party 58mm/80mm Thermal Receipt Printer',
    typeBadge: 'Receipt Only',
    driver: 'Standard Bluetooth (ESC/POS)',
    driverType: 'escpos',
    image: require('@/assets/images/printers/printer_veer.jpg'),
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
    description: 'Third-party compact thermal receipt printer for sales bills, KOT, and daybook.',
    warningNotice: '⚠️ Non-SEZNIK Printer: This printer is a third-party non-SEZNIK device. Only receipt printing is supported. Label printing is exclusive to official SEZNIK hardware.',
    connectionHelp: 'Pair via Bluetooth in phone settings, then select and connect.',
  },
};

export const PRINTER_MODEL_LIST: SeznikPrinterModel[] = [
  SEZNIK_PRINTER_MODELS.josh,
  SEZNIK_PRINTER_MODELS.dev,
  SEZNIK_PRINTER_MODELS.veer,
];
