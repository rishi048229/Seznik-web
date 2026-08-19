export interface NotificationConfig {
  lowStockThreshold: number
  overdueDays: number
}

export interface InvoiceConfig {
  prefix: string
  footerText: string
}

export interface ReceiptConfig {
  headerTitle?: string
  companyName: string
  address: string
  phone: string
  gstin: string
  logoURL: string
  footerMessage: string
  termsLine1: string
  termsLine2: string
  termsLine3: string
  compactMode?: boolean
  showLogo?: boolean
  showCompanyHeader?: boolean
  showAddress?: boolean
  showPhone?: boolean
  showGSTIN?: boolean
  showCustomerDetails?: boolean
  showInvoiceNoAndDate?: boolean
  showTaxBreakdown?: boolean
  showSubtotalDiscount?: boolean
  showFooterMessage?: boolean
  showTerms?: boolean
  showBarcode?: boolean
  showPaymentQR?: boolean
  paymentQrURL?: string
}

export interface PersonalInfo {
  ownerName: string
  ownerPhone: string
  ownerAddress: string
}

export type LabelElementType =
  | 'businessName'
  | 'productName'
  | 'price'
  | 'mrpHeader'
  | 'barcode'
  | 'qrCode'
  | 'sideBySideBarcodeQr'
  | 'sku'
  | 'category'
  | 'sequenceNo'
  | 'custom'
  | 'divider'

export interface LabelElement {
  id: string
  type: LabelElementType
  align: 'left' | 'center' | 'right'
  bold?: boolean
  large?: boolean
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge'
  prefix?: string
  suffix?: string
  /** Used when type === 'custom' — user-entered static text. */
  text?: string
}

export interface PrinterConfig {
  // 'bluetooth' routes to the connected BLE printer; 'system_driver' always
  // uses the browser print dialog. (USB/network-IP were never implemented —
  // selecting them silently did nothing, which is why they were removed.)
  connectionType: 'bluetooth' | 'system_driver'
  autoPrintOnSale: boolean
  openCashDrawer: boolean
  cutPaper: boolean

  // Thermal Receipt Format — company name/address/phone/GSTIN/footer/terms
  // live on Settings.receiptConfig (the same object the real print pipeline
  // in utils/receipt.ts reads), so both this page and the Settings page edit
  // that one shared source instead of each keeping its own disconnected copy.
  paperSize: '58mm' | '80mm'
  showLogo: boolean
  showGSTIN: boolean
  showCustomerDetails: boolean
  showBarcode: boolean
  fontSize: 'small' | 'medium' | 'large'

  // Barcode Label Sticker Format — the layout itself is a user-editable list
  // of elements (labelTemplate); these are the label-wide settings that apply
  // regardless of which elements are on it.
  labelWidth: number
  labelHeight: number
  labelOffsetX?: number // Printer horizontal calibration offset in mm (e.g. -10 to +10)
  labelOffsetY?: number // Printer vertical calibration offset in mm (e.g. -10 to +10)
  // TSPL DIRECTION command (0 = normal, 1 = rotated 180°). Whether a roll needs
  // 0 or 1 depends on which way the sticker is loaded in the printer, so this
  // is a user-facing toggle rather than a fixed value.
  labelDirection?: 0 | 1
  // mm — extra rightward nudge applied only to centered barcodes, to correct
  // for printer firmware rendering CODE128 slightly off from the calculated
  // dead-center position. Independent of labelOffsetX (which shifts everything).
  labelBarcodeOffsetX?: number
  labelBarcodeType: 'CODE128' | 'EAN13' | 'QR'
  labelBarcodeHeight?: number
  labelPrinterMode?: 'tspl' | 'escpos'
  labelDensity: number
  labelTemplate: LabelElement[]

  // A4 / Full Sheet Invoice Format
  invoicePaperSize: 'A4' | 'Letter'
  invoiceColorTheme: 'navy' | 'emerald' | 'slate' | 'royal'
  invoiceShowHeader: boolean
  invoiceShowTerms: boolean
  invoiceTermsText: string
  invoiceShowPaymentQR: boolean
}

export interface UserSettings {
  id: string
  businessName: string
  businessAddress: string
  businessPhone: string
  businessGSTIN: string
  businessLogoURL: string
  personalInfo: PersonalInfo
  invoiceConfig: InvoiceConfig
  notificationConfig: NotificationConfig
  receiptConfig: ReceiptConfig
  printerConfig?: PrinterConfig
}
