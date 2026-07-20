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
}
