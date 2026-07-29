export interface NotificationConfig {
  lowStockThreshold: number
  overdueDays: number
}

export interface InvoiceConfig {
  prefix: string
  footerText: string
}

export interface ReceiptConfig {
  companyName: string
  address: string
  phone: string
  gstin: string
  logoURL: string
  footerMessage: string
  termsLine1: string
  termsLine2: string
  termsLine3: string
}

export interface PersonalInfo {
  ownerName: string
  ownerPhone: string
  ownerAddress: string
}

export type LabelElementType = 'businessName' | 'productName' | 'price' | 'barcode' | 'custom'

export interface LabelElement {
  id: string
  type: LabelElementType
  align: 'left' | 'center' | 'right'
  bold: boolean
  large: boolean
  /** Only used when type === 'custom' — user-entered static text. */
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
  labelBarcodeType: 'CODE128' | 'EAN13' | 'QR'
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
  supportEmail?: string
  supportPhone?: string
  whatsappNumber?: string
  personalInfo: PersonalInfo
  invoiceConfig: InvoiceConfig
  notificationConfig: NotificationConfig
  receiptConfig: ReceiptConfig
  printerConfig?: PrinterConfig
}
