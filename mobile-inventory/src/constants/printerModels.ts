export type SeznikPrinterModelId = 'tej' | 'dev' | 'veer' | 'josh';

export interface SeznikPrinterModel {
  id: SeznikPrinterModelId;
  name: string;
  tagline: string;
  typeBadge: 'Receipt + Label' | 'Receipt Only';
  driver: string;
  driverType: 'escpos' | 'josh' | 'tej';
  image: any;
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
  tej: {
    id: 'tej',
    name: 'SEZNIK TEJ',
    tagline: 'Smart Label & Thermal Printer',
    typeBadge: 'Receipt + Label',
    driver: 'TEJ SDK (High-Speed Dual-Mode)',
    driverType: 'tej',
    image: require('@/assets/images/printers/printer_tej.png'),
    capabilities: {
      receipts: true,
      labels: true,
      barcodes: true,
      qrCodes: true,
      highResBitmap: true,
    },
    badgeColor: '#ECFDF5',
    badgeTextColor: '#059669',
    description: 'Dedicated high-speed smart label & receipt printer with proprietary TEJ driver engine.',
    warningNotice: 'Uses dedicated TEJ Native Bridge for high-resolution 203 DPI label and receipt printing.',
    connectionHelp: 'Power on the TEJ printer and tap Scan under TEJ section.',
  },
  dev: {
    id: 'dev',
    name: 'SEZNIK DEV',
    tagline: '2-in-1 POS & Label Printer',
    typeBadge: 'Receipt + Label',
    driver: 'ESC/POS & TSPL Bridge',
    driverType: 'escpos',
    image: require('@/assets/images/printers/printer_dev.jpg'),
    capabilities: {
      receipts: true,
      labels: true,
      barcodes: true,
      qrCodes: true,
      highResBitmap: false,
    },
    badgeColor: '#EFF6FF',
    badgeTextColor: '#2563EB',
    description: 'Versatile 2-in-1 printer supporting both continuous receipt rolls and 50x30mm die-cut labels.',
    warningNotice: 'Supports standard continuous receipts and 50x30mm sticker labels via ESC/POS & TSPL commands.',
    connectionHelp: 'Pair via Bluetooth in phone settings, then select SEZNIK DEV.',
  },
  veer: {
    id: 'veer',
    name: 'SEZNIK VEER',
    tagline: 'Classic Thermal Receipt Printer',
    typeBadge: 'Receipt Only',
    driver: 'Universal ESC/POS Bridge',
    driverType: 'escpos',
    image: require('@/assets/images/printers/printer_veer.jpg'),
    capabilities: {
      receipts: true,
      labels: false,
      barcodes: true,
      qrCodes: true,
      highResBitmap: false,
    },
    badgeColor: '#FEF3C7',
    badgeTextColor: '#D97706',
    description: 'High-speed compact 58mm/80mm thermal receipt printer for sales bills, KOT, and daybook.',
    warningNotice: '⚠️ Receipt printing only — does not support die-cut sticker labels or gap sensors.',
    connectionHelp: 'Pair via Bluetooth in phone settings, then select SEZNIK VEER.',
  },
  josh: {
    id: 'josh',
    name: 'SEZNIK JOSH',
    tagline: 'Dual-Mode Smart Label & Receipt Printer',
    typeBadge: 'Receipt + Label',
    driver: 'LPAPI SDK (Native Bitmap Engine)',
    driverType: 'josh',
    image: require('@/assets/images/printers/printer_josh.png'),
    capabilities: {
      receipts: true,
      labels: true,
      barcodes: true,
      qrCodes: true,
      highResBitmap: true,
    },
    badgeColor: '#F5F3FF',
    badgeTextColor: '#7C3AED',
    description: 'Premium dual-mode printer with hardware optical gap sensor and native LPAPI vector engine.',
    warningNotice: 'Powered by DothanTech LPAPI SDK for hardware-calibrated gap detection and instant bitmap prints.',
    connectionHelp: 'Power on JOSH printer and tap Scan on the JOSH connector card.',
  },
};

export const PRINTER_MODEL_LIST: SeznikPrinterModel[] = [
  SEZNIK_PRINTER_MODELS.tej,
  SEZNIK_PRINTER_MODELS.dev,
  SEZNIK_PRINTER_MODELS.veer,
  SEZNIK_PRINTER_MODELS.josh,
];
