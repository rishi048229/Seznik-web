import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useProducts } from '@/hooks/useProducts'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import type { UserSettings, PrinterConfig, ReceiptConfig, LabelElement, LabelElementType } from '@/types/settings.types'
import {
  subscribeBlePrinter,
  requestAndConnectPrinter,
  disconnectPrinter,
  tryReconnectKnownPrinter,
  isBluetoothSupported,
  printEscPos,
  type BlePrinterState,
} from '@/utils/blePrinter'
import {
  generateLabelEscPos,
  generateLabelTspl,
  generateGapCalibrationBytes,
  defaultLabelTemplate,
  PRESET_RETAIL_DUAL_CODE,
  PRESET_CENTERED_STANDARD,
  PRESET_MINIMAL_TAG,
  resolveElementText,
  type LabelData,
} from '@/utils/labelPrint'
import { generateReceiptEscPos, generateReceiptHTML, printReceipt, resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { sampleSaleForTemplate } from '@/utils/a4InvoiceTemplates'
import { ReceiptBuilderTab, type ReceiptBuilderTabHandle } from '@/pages/printers/receipt-builder/ReceiptBuilderTab'
import { useReceiptBuilderSync } from '@/hooks/useReceiptBuilderSync'
import { resolveActiveFromTemplates, ensureTemplateHasLogoBlock } from '@/utils/ensureReceiptTemplates'
import { applyQrSection } from '@/pages/printers/receipt-builder/receiptSimpleSections'
import { withSyncedPaperKeys } from '@/utils/printerThermal'
import { useGstBillingSettings } from '@/hooks/useGstBillingSettings'
import { resolveReceiptPrintGstFromForm } from '@/constants/gstBilling'
import { formatINR } from '@/utils/currency'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Switch } from '@/components/ui/Switch'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { SettingsPageSkeleton } from '@/components/ui/PageSkeleton'
import { trackUserAction } from '@/utils/analytics'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { Modal } from '@/components/ui/Modal'
import { ReceiptLivePreview } from './components/ReceiptLivePreview'
import { A4InvoiceTab } from './components/A4InvoiceTab'
import { TextToThermalPrintTab } from './components/TextToThermalPrintTab'
import { PageHeader } from '@/components/layout/PageHeader'
import { isReceiptFontId, resolveReceiptFontId, type ReceiptFontId } from '@shared/receiptFonts'
import { Section, StatusDot, chipClass, fieldClass } from './components/PrintersUi'
import { isRestaurantBusiness } from '@/constants/businessTypes'
import {
  Printer,
  QrCode,
  FileText,
  Tag,
  Save,
  Bluetooth,
  Monitor,
  Layers,
  Unplug,
  ArrowUp,
  ArrowDown,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Sparkles,
  Image as ImageIcon,
  Globe,
} from 'lucide-react'

const UpiIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 4.5L19.5 12L14 19.5H9.8L15.3 12L9.8 4.5H14Z" fill="#00B569" />
    <path d="M8.2 4.5L13.7 12L8.2 19.5H4L9.5 12L4 4.5H8.2Z" fill="#F47920" />
  </svg>
)

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `el-${Date.now()}-${Math.random()}`)

// Default fallback printer configuration
const defaultPrinterConfig: PrinterConfig = {
  connectionType: 'system_driver',
  autoPrintOnSale: true,
  openCashDrawer: true,
  cutPaper: true,
  paperSize: '58mm',
  showLogo: true,
  showGSTIN: true,
  showCustomerDetails: true,
  showBarcode: true,
  fontSize: 'medium',
  receiptFont: 'classic',

  labelWidth: 50,
  labelHeight: 30,
  labelOffsetX: 0,
  labelOffsetY: 0,
  labelDirection: 0,
  labelBarcodeOffsetX: 0,
  labelBarcodeType: 'CODE128',
  labelBarcodeHeight: 40,
  labelPrinterMode: 'tspl',
  labelDensity: 8,
  labelTemplate: defaultLabelTemplate,

  invoicePaperSize: 'A4',
  invoiceColorTheme: 'navy',
  invoiceShowHeader: true,
  invoiceShowTerms: true,
  invoiceTermsText: '1. Goods once sold cannot be returned without original receipt.\n2. Warranty covers manufacturing defects only.',
  invoiceShowPaymentQR: true,
  invoiceTemplateId: 'retail',
}

const defaultReceiptConfig: ReceiptConfig = {
  companyName: '',
  address: '',
  phone: '',
  gstin: '',
  footerMessage: 'Thank you for your business!',
  termsLine1: 'Goods once sold cannot be returned without original receipt.',
  termsLine2: 'Warranty covers manufacturing defects only.',
  termsLine3: '',
  headerTitle: 'TAX INVOICE',
  showCompanyHeader: true,
  showAddress: true,
  showPhone: true,
  showGSTIN: true,
  showCustomerDetails: true,
  showInvoiceNoAndDate: true,
  showSubtotalDiscount: true,
  showTaxBreakdown: true,
  showFooterMessage: true,
  showTerms: true,
  showBarcode: true,
  showPaymentQR: false,
  upiId: '',
  paymentQrURL: '',
  logoURL: '',
  receiptLogoSize: 'medium',
  receiptQrSize: 'medium',
  compactMode: false,
}

const LABEL_ELEMENT_META: Record<LabelElementType, { label: string; icon: string }> = {
  businessName: { label: 'Business Name', icon: '🏬' },
  productName: { label: 'Product Name', icon: '📦' },
  price: { label: 'Selling Price', icon: '💰' },
  mrpHeader: { label: 'MRP Header Text', icon: '🏷️' },
  barcode: { label: 'Barcode', icon: '▥' },
  qrCode: { label: 'QR Code', icon: '🔳' },
  sideBySideBarcodeQr: { label: 'Barcode + QR (Image 1)', icon: '📐' },
  sku: { label: 'SKU / Code', icon: '🔢' },
  category: { label: 'Category', icon: '📁' },
  sequenceNo: { label: 'Consecutive Label No.', icon: '#️⃣' },
  custom: { label: 'Custom Text', icon: '✎' },
  divider: { label: 'Divider Line', icon: '➖' },
}

export const PrintersPage = () => {
  const pageTutorial = usePageTutorial('printers')
  const { user, userProfile } = useAuth()
  const isRestaurant = isRestaurantBusiness(user?.businessType ?? userProfile?.businessType)
  const { data: products } = useProducts()
  const { data: settings, isLoading, isError } = useSettings()
  const { mutate: updateSettingsMutation, isPending: isUpdating } = useUpdateSettings()
  const { mutate: createSettingsMutation, isPending: isCreating } = useCreateSettings()
  const saving = isUpdating || isCreating

  const [config, setConfig] = useState<PrinterConfig>(defaultPrinterConfig)
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig>(defaultReceiptConfig)
  const [activeTab, setActiveTab] = useState<'receipt' | 'receiptBuilder' | 'label' | 'invoice'>('receipt')
  const [isUnchangedSaveConfirmOpen, setIsUnchangedSaveConfirmOpen] = useState(false)
  const [showQuickPrintModal, setShowQuickPrintModal] = useState(false)

  const configRef = useRef(config)
  const receiptConfigRef = useRef(receiptConfig)
  const hydratedConfigRef = useRef<string | null>(null)
  const hydratedReceiptRef = useRef<string | null>(null)
  configRef.current = config
  receiptConfigRef.current = receiptConfig

  const { customTemplates, activeCustomTemplateId, saveTemplate } = useReceiptBuilderSync()
  const {
    form: gstForm,
    setStyle: setGstStyle,
    setPrintOnReceipt: setGstPrintOnReceipt,
    setItemWiseGst: setGstItemWiseGst,
    saveGstBilling,
    isSaving: isSavingGst,
  } = useGstBillingSettings()
  const receiptBuilderRef = useRef<ReceiptBuilderTabHandle>(null)

  const effectiveCustomTemplates = customTemplates

  const activeCustomTemplate = useMemo(
    () => resolveActiveFromTemplates(customTemplates, activeCustomTemplateId, user?.businessType ?? userProfile?.businessType) || customTemplates[0],
    [customTemplates, activeCustomTemplateId, user?.businessType, userProfile?.businessType]
  )

  const effectivePreviewTemplate = useMemo(() => {
    if (!activeCustomTemplate) return null
    let tpl = ensureTemplateHasLogoBlock(
      activeCustomTemplate,
      receiptConfig.logoURL || settings?.businessLogoURL
    )
    if (!receiptConfig.showPaymentQR) {
      tpl = applyQrSection(tpl, { purpose: 'none' })
    } else {
      const purpose = receiptConfig.qrType || (receiptConfig.upiId ? 'upi' : 'digital_bill')
      tpl = applyQrSection(tpl, { purpose })
      if (purpose === 'upi' && receiptConfig.upiId) {
        tpl = {
          ...tpl,
          entries: tpl.entries.map((e) =>
            e.type === 'barcode' ? { ...e, upiId: receiptConfig.upiId, qrType: 'upi' } : e
          ),
        }
      } else if (purpose === 'custom' && receiptConfig.customQrUrl) {
        tpl = {
          ...tpl,
          entries: tpl.entries.map((e) =>
            e.type === 'barcode' ? { ...e, value: receiptConfig.customQrUrl, qrType: 'custom' } : e
          ),
        }
      }
    }
    tpl = {
      ...tpl,
      paperWidth: config.paperSize === '80mm' ? '80mm' : '58mm',
    }
    return tpl
  }, [activeCustomTemplate, receiptConfig, settings?.businessLogoURL, config.paperSize])

  // Real product data to preview/print the label
  const [previewProductId, setPreviewProductId] = useState<string>('')
  const selectedProduct = useMemo(
    () => products?.find(p => p.id === previewProductId) ?? null,
    [products, previewProductId]
  )

  // Bluetooth printer state
  const [bleState, setBleState] = useState<BlePrinterState>({
    status: isBluetoothSupported() ? 'disconnected' : 'unsupported',
    deviceName: null,
    profileName: null,
  })
  const [connectingBle, setConnectingBle] = useState(false)
  const [linkPulse, setLinkPulse] = useState<'connected' | 'disconnected' | null>(null)
  const prevBleStatus = useRef<BlePrinterState['status']>(bleState.status)

  useEffect(() => {
    if (prevBleStatus.current === bleState.status) return
    const next =
      bleState.status === 'connected'
        ? 'connected'
        : prevBleStatus.current === 'connected'
          ? 'disconnected'
          : null
    prevBleStatus.current = bleState.status
    if (!next) return
    setLinkPulse(next)
    const timer = window.setTimeout(() => setLinkPulse(null), 700)
    return () => window.clearTimeout(timer)
  }, [bleState.status])

  useEffect(() => {
    const unsubscribe = subscribeBlePrinter(s => setBleState(s))
    tryReconnectKnownPrinter()
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!settings) return

    if (settings.printerConfig) {
      const merged = { ...defaultPrinterConfig, ...settings.printerConfig } as PrinterConfig & {
        primaryPrinter?: string
        ipAddress?: string
        headerText?: string
        footerMessage?: string
        labelShowPrice?: boolean
        labelShowBarcode?: boolean
        labelShowBusinessName?: boolean
      }
      delete merged.primaryPrinter
      delete merged.ipAddress
      delete merged.headerText
      delete merged.footerMessage
      delete merged.labelShowPrice
      delete merged.labelShowBarcode
      delete merged.labelShowBusinessName
      if (merged.connectionType !== 'bluetooth' && merged.connectionType !== 'system_driver') {
        merged.connectionType = 'system_driver'
      }
      if (!Array.isArray(merged.labelTemplate) || merged.labelTemplate.length === 0) {
        merged.labelTemplate = defaultLabelTemplate
      }
      try {
        const savedLocalFont = typeof window !== 'undefined' ? localStorage.getItem('seznik_printer_receiptFont') : null
        if (savedLocalFont && isReceiptFontId(savedLocalFont) && !settings.printerConfig?.receiptFont) {
          merged.receiptFont = savedLocalFont
        }
      } catch {}
      setConfig(merged)
      hydratedConfigRef.current = JSON.stringify(withSyncedPaperKeys(merged))
    }

    const mergedReceipt: ReceiptConfig = { ...defaultReceiptConfig, ...settings.receiptConfig }
    if (!mergedReceipt.logoURL && settings.businessLogoURL) {
      mergedReceipt.logoURL = settings.businessLogoURL
    }
    setReceiptConfig(mergedReceipt)
    hydratedReceiptRef.current = JSON.stringify(mergedReceipt)
  }, [settings])

  const executeSave = () => {
    if (!user) return
    if (isError) {
      toast.error('Settings are still loading from the server. Wait a moment and try again.')
      return
    }

    const updatedTemplates = customTemplates.map((t) => {
      if (t.id === activeCustomTemplate?.id && effectivePreviewTemplate) {
        return effectivePreviewTemplate
      }
      return t
    })

    const printerPayload = {
      receiptConfig: {
        ...receiptConfig,
        customTemplates: updatedTemplates,
        activeCustomTemplateId: activeCustomTemplate?.id || activeCustomTemplateId || null,
      },
      printerConfig: withSyncedPaperKeys(config),
      businessLogoURL: receiptConfig.logoURL || settings?.businessLogoURL || '',
    }

    if (settings?.id) {
      updateSettingsMutation(
        { settingsId: settings.id, data: printerPayload },
        {
          onSuccess: () => {
            trackUserAction('feature_printer_settings_saved', { mode: config.connectionType })
            toast.success('Printer settings saved!')
            hydratedConfigRef.current = JSON.stringify(printerPayload.printerConfig)
            hydratedReceiptRef.current = JSON.stringify(printerPayload.receiptConfig)
          },
          onError: (err) => {
            console.error('Save printer config error:', err)
            toastError(err, 'Could not save printer settings. Please try again.')
          },
        }
      )
      return
    }

    createSettingsMutation(
      {
        businessName: settings?.businessName ?? user.displayName ?? '',
        businessAddress: settings?.businessAddress ?? '',
        businessPhone: settings?.businessPhone ?? '',
        businessGSTIN: settings?.businessGSTIN ?? '',
        personalInfo: settings?.personalInfo ?? { ownerName: '', ownerPhone: '', ownerAddress: '' },
        invoiceConfig: settings?.invoiceConfig ?? { prefix: 'INV', footerText: '' },
        notificationConfig: settings?.notificationConfig ?? { lowStockThreshold: 10, overdueDays: 30 },
        ...printerPayload,
      } as Omit<UserSettings, 'id'>,
      {
        onSuccess: () => {
          trackUserAction('feature_printer_settings_saved', { mode: config.connectionType })
          toast.success('Printer settings saved!')
          hydratedConfigRef.current = JSON.stringify(printerPayload.printerConfig)
          hydratedReceiptRef.current = JSON.stringify(printerPayload.receiptConfig)
        },
        onError: (err) => {
          console.error('Create settings error:', err)
          toastError(err, 'Could not save printer settings. Please try again.')
        },
      }
    )
  }

  const handleSaveClick = () => {
    if (!user) return
    const currentConfigStr = JSON.stringify(withSyncedPaperKeys(config))
    const currentReceiptStr = JSON.stringify(receiptConfig)
    const isUnchanged =
      hydratedConfigRef.current !== null &&
      hydratedReceiptRef.current !== null &&
      hydratedConfigRef.current === currentConfigStr &&
      hydratedReceiptRef.current === currentReceiptStr

    if (isUnchanged) {
      setIsUnchangedSaveConfirmOpen(true)
      return
    }

    executeSave()
  }

  const handleConnectBluetooth = async () => {
    if (!isBluetoothSupported()) {
      toast.error('Web Bluetooth is not supported in this browser. Use Google Chrome or MS Edge.')
      return
    }
    setConnectingBle(true)
    try {
      await requestAndConnectPrinter()
      toast.success('Connected to Bluetooth Printer!')
    } catch (err) {
      toastError(err, 'Could not connect the printer. Please try again.')
    } finally {
      setConnectingBle(false)
    }
  }

  const handleDisconnectBluetooth = () => {
    disconnectPrinter()
    toast.success('Bluetooth printer disconnected')
  }

  const handleCalibrateGap = async () => {
    if (bleState.status !== 'connected') {
      toast.error('Connect your Bluetooth label printer first, then calibrate.')
      return
    }
    try {
      const bytes = generateGapCalibrationBytes()
      await printEscPos(bytes)
      toast.success('Gap calibration sent. The printer will sense sticker spacing.')
    } catch {
      toast.error('Failed to send gap calibration command')
    }
  }

  const labelTemplate = useMemo(() => {
    return Array.isArray(config.labelTemplate) && config.labelTemplate.length > 0
      ? config.labelTemplate
      : defaultLabelTemplate
  }, [config.labelTemplate])

  const labelData: LabelData = {
    businessName: receiptConfig.companyName || settings?.businessName || 'SEZNIK POS',
    productName: selectedProduct?.name || 'Sample Product',
    price: formatINR(selectedProduct?.sellingPrice ?? 1299),
    barcodeValue: selectedProduct?.barcode || selectedProduct?.sku || '0000000000',
    sku: selectedProduct?.sku || 'SKU-001',
    sequenceNo: '001',
  }

  const addLabelElement = (type: LabelElementType) => {
    const el: LabelElement = { id: newId(), type, align: 'center', bold: type === 'price', large: false, text: type === 'custom' ? 'New text' : undefined }
    setConfig(prev => ({ ...prev, labelTemplate: [...labelTemplate, el] }))
  }
  const removeLabelElement = (id: string) => {
    setConfig(prev => ({ ...prev, labelTemplate: labelTemplate.filter(e => e.id !== id) }))
  }
  const updateLabelElement = (id: string, patch: Partial<LabelElement>) => {
    setConfig(prev => ({ ...prev, labelTemplate: labelTemplate.map(e => (e.id === id ? { ...e, ...patch } : e)) }))
  }
  const moveLabelElement = (id: string, dir: -1 | 1) => {
    setConfig(prev => {
      const list = [...labelTemplate]
      const idx = list.findIndex(e => e.id === id)
      const target = idx + dir
      if (idx < 0 || target < 0 || target >= list.length) return prev
      ;[list[idx], list[target]] = [list[target], list[idx]]
      return { ...prev, labelTemplate: list }
    })
  }

  const renderLabelHtml = () => {
    const w = config.labelWidth
    const h = config.labelHeight
    const ox = config.labelOffsetX ?? 0
    const oy = config.labelOffsetY ?? 0

    const elementsHtml = labelTemplate.map(el => {
      const align = el.align === 'left' ? 'left' : el.align === 'right' ? 'right' : 'center'
      const weight = el.bold ? 'bold' : 'normal'
      const size = el.fontSize === 'small' ? '8pt' : el.fontSize === 'large' ? '12pt' : el.fontSize === 'xlarge' ? '14pt' : '10pt'

      if (el.type === 'divider') {
        return '<hr style="border:0;border-top:1px solid #000;margin:3px 0;width:100%;" />'
      }

      if (el.type === 'sideBySideBarcodeQr') {
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin:2px 0;">
            <div style="flex:1;text-align:center;">
              <div style="font-family:'Libre Barcode 128',monospace;font-size:22pt;line-height:1;">*${labelData.barcodeValue}*</div>
              <div style="font-size:7pt;font-family:monospace;">${labelData.barcodeValue}</div>
            </div>
            <div style="width:24px;height:24px;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:6pt;font-weight:bold;">QR</div>
          </div>
        `
      }

      if (el.type === 'barcode' || el.type === 'qrCode') {
        return `
          <div style="text-align:center;margin:3px 0;">
            <div style="font-family:'Libre Barcode 128',monospace;font-size:26pt;line-height:1;">*${labelData.barcodeValue}*</div>
            <div style="font-size:8pt;font-family:monospace;letter-spacing:1px;">${labelData.barcodeValue}</div>
          </div>
        `
      }

      const text = resolveElementText(el, labelData)
      return `<div style="text-align:${align};font-size:${size};font-weight:${weight};margin:1px 0;line-height:1.2;word-break:break-word;">${text}</div>`
    }).join('')

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Print Label</title>
          <style>
            @page { size: ${w}mm ${h}mm; margin: 0; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              width: ${w}mm;
              height: ${h}mm;
              overflow: hidden;
              background: #fff;
              color: #000;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .label-box {
              width: 100%;
              height: 100%;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              transform: translate(${ox}px, ${oy}px);
            }
          </style>
        </head>
        <body>
          <div class="label-box">
            ${elementsHtml}
          </div>
        </body>
      </html>
    `
  }

  const previewGstOpts = useMemo(() => {
    const resolved = resolveReceiptPrintGstFromForm(gstForm, receiptConfig)
    return {
      showTaxBreakdown: resolved.showTaxBreakdown,
      gstStyle: resolved.gstStyle,
      itemWiseGst: resolved.itemWiseGst,
      isRestaurant,
      receiptQrSize: receiptConfig.receiptQrSize,
      receiptFont: config.receiptFont,
    }
  }, [gstForm, receiptConfig, isRestaurant, config.receiptFont])

  const handleTestPrint = async () => {
    if (activeTab === 'receiptBuilder') {
      if (receiptBuilderRef.current) {
        await receiptBuilderRef.current.runTestPrint()
      } else {
        toast.error('Receipt builder is initializing')
      }
      return
    }

    const testPrintTemplate = effectivePreviewTemplate || activeCustomTemplate
    const gstResolved = resolveReceiptPrintGstFromForm(gstForm, receiptConfig)
    const effectiveReceiptConfig = resolveEffectiveReceiptConfig(
      {
        ...settings,
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        receiptConfig: {
          ...receiptConfig,
          customTemplates,
          activeCustomTemplateId: testPrintTemplate?.id || activeCustomTemplateId,
          showTaxBreakdown: gstResolved.showTaxBreakdown,
          gstStyle: gstResolved.gstStyle,
          itemWiseGst: gstResolved.itemWiseGst,
        },
        printerConfig: config,
      },
      {
        ...receiptConfig,
        customTemplates,
        activeCustomTemplateId: testPrintTemplate?.id || activeCustomTemplateId,
        showTaxBreakdown: gstResolved.showTaxBreakdown,
        gstStyle: gstResolved.gstStyle,
        itemWiseGst: gstResolved.itemWiseGst,
      },
    )


    if (activeTab === 'receipt') {
      const testSale = {
        id: 'test-sale-1',
        invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: 'Walk-in Customer',
        customerPhone: '+91 99887 76655',
        items: [
          { productId: '1', productName: 'Basmati Rice 5kg', quantity: 1, sellingPrice: 450.00, discount: 0, taxRate: 5, taxAmount: 22.50, total: 450.00 },
          { productId: '2', productName: 'Sunflower Oil 1L', quantity: 2, sellingPrice: 180.00, discount: 0, taxRate: 5, taxAmount: 18.00, total: 360.00 },
          { productId: '3', productName: 'Whole Wheat Flour 5kg', quantity: 1, sellingPrice: 280.00, discount: 0, taxRate: 0, taxAmount: 0, total: 280.00 },
        ],
        subtotal: 1090.00,
        totalDiscount: 0,
        totalTax: 40.50,
        grandTotal: 1130.50,
        paymentMethod: 'cash',
        amountPaid: 1130.50,
        changeReturned: 0,
        isQuickBill: false,
        createdAt: new Date().toISOString(),
      }

      if (bleState.status === 'connected' || config.connectionType === 'bluetooth') {
        try {
          if (bleState.status !== 'connected') {
            await requestAndConnectPrinter()
          }
          const bytes = await generateReceiptEscPos({
            sale: testSale as any,
            receiptConfig: effectiveReceiptConfig,
            templateOverride: testPrintTemplate ?? undefined,
            paperSize: config.paperSize,
            printerConfig: config,
            receiptFont: config.receiptFont,
            businessName: settings?.businessName,
            businessAddress: settings?.businessAddress,
            customerName: 'Walk-in Customer',
            customerPhone: testSale.customerPhone,
          })
          await printEscPos(bytes)
          toast.success('Test receipt sent to Bluetooth printer!')
          return
        } catch (err: any) {
          console.error('BLE Print error:', err)
          if (bleState.status !== 'connected') {
            toast.error('Connect the Bluetooth printer first. Thermal test print does not open the system print dialog.')
          } else {
            toast.error(err?.message || 'Failed to print test receipt to Bluetooth printer.')
          }
          return
        }
      }

      const receiptHTML = generateReceiptHTML({
        sale: testSale as any,
        receiptConfig: effectiveReceiptConfig,
        templateOverride: testPrintTemplate ?? undefined,
        printerConfig: config,
        receiptFont: config.receiptFont,
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        customerName: 'Walk-in Customer',
        width: config.paperSize === '80mm' ? '80mm' : '50mm',
        logoURL: settings?.businessLogoURL || effectiveReceiptConfig.logoURL,
        settingsTaxName: 'GST',
      })
      printReceipt(receiptHTML, config.paperSize === '80mm' ? '80mm' : '50mm', 'Test Receipt', undefined, config.receiptFont)
      return
    }

    if (activeTab === 'label') {
      const mode = config.labelPrinterMode || 'tspl'
      if (bleState.status === 'connected') {
        try {
          const bytes = mode === 'tspl'
            ? generateLabelTspl(
                labelTemplate,
                config.labelBarcodeType,
                labelData,
                config.labelWidth,
                config.labelHeight,
                config.labelOffsetX ?? 0,
                config.labelOffsetY ?? 0,
                undefined,
                config.labelDirection ?? 0,
                config.labelBarcodeOffsetX ?? 4
              )
            : generateLabelEscPos(labelTemplate, config.labelBarcodeType, labelData)
          await printEscPos(bytes)
          toast.success(mode === 'tspl' ? 'Label sent to sticker printer.' : 'Label sent to receipt printer.')
          return
        } catch (err: any) {
          console.error('BLE Print error:', err)
          if (bleState.status !== 'connected') {
            toast.error('Connect the Bluetooth printer first. Label test print does not open the system print dialog.')
          } else {
            toast.error(err?.message || 'Failed to print label to Bluetooth printer.')
          }
          return
        }
      }

      if (config.connectionType === 'bluetooth') {
        toast.error('Connect the Bluetooth printer first to test labels.')
        return
      }

      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast.error('Please allow popups to test printing')
        return
      }
      const htmlContent = renderLabelHtml()
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 500)
      return
    }

    // A4 Invoice Tab
    const testInvoiceSale = sampleSaleForTemplate(config.invoiceTemplateId)
    const invoiceHTML = generateReceiptHTML({
      sale: testInvoiceSale,
      receiptConfig: effectiveReceiptConfig,
      printerConfig: config,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      customerName: 'Sample Customer',
      width: '210mm',
      logoURL: settings?.businessLogoURL || effectiveReceiptConfig.logoURL,
      settingsTaxName: 'GST',
    })
    printReceipt(invoiceHTML, '210mm', 'Test Invoice')
  }

  if (isLoading) return <SettingsPageSkeleton />

  return (
    <div className="space-y-6 pb-16 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <PageHeader
          title="Printers"
          subtitle="Configure thermal receipts, barcode labels, and A4 invoices"
          tutorialKey="printers"
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowQuickPrintModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white dark:text-white flex items-center gap-1.5 text-xs sm:text-sm font-bold shadow-sm cursor-pointer"
              >
                <Printer size={16} className="text-white dark:text-white" />
                <span className="text-white dark:text-white">Quick Text Print</span>
              </Button>
              <Button
                data-tour="printer-test-btn"
                variant="outline"
                onClick={handleTestPrint}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <Printer size={16} />
                {activeTab === 'label' ? 'Print label' : 'Test print'}
              </Button>
              <Button
                onClick={handleSaveClick}
                loading={saving}
                disabled={isError}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white dark:text-white flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-sm"
              >
                <Save size={16} className="text-white dark:text-white" />
                <span className="text-white dark:text-white">Save</span>
              </Button>
            </div>
          }
        />
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-3 mb-1 max-w-4xl">
          Connect a printer, then set up receipts, barcode labels, or A4 invoices. Nothing here changes until you save.
        </p>
      </div>

      {/* Printer connection status — honest cards from main */}
      <div data-tour="printers-status" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`p-4 rounded-2xl border transition-all ${
            bleState.status === 'connected'
              ? 'bg-gradient-to-b from-blue-50/80 to-sky-50/40 border-blue-500 dark:from-blue-900/30 dark:to-sky-900/20 dark:border-blue-500/60'
              : 'bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg">
                <Bluetooth size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Bluetooth Thermal Printer</h4>
                  <StatusDot on={bleState.status === 'connected'} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {bleState.status === 'connected'
                    ? (bleState.deviceName || 'Thermal Printer')
                    : bleState.status === 'unsupported'
                      ? 'Web Bluetooth unsupported in this browser'
                      : 'Not connected'}
                </p>
              </div>
            </div>
            {bleState.status === 'connected' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectBluetooth}
                className="text-xs text-red-600 dark:text-red-400 border-red-200 hover:bg-red-50 dark:border-red-800"
              >
                <Unplug size={14} className="mr-1" />
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnectBluetooth}
                loading={connectingBle}
                disabled={bleState.status === 'unsupported'}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-white"
              >
                <Bluetooth size={14} className="mr-1" />
                Connect
              </Button>
            )}
          </div>
          {linkPulse && (
            <div
              className={`mt-2 p-2 rounded-xl text-xs flex items-center gap-2 ${
                linkPulse === 'connected'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <StatusDot on={linkPulse === 'connected'} />
              <span>{linkPulse === 'connected' ? 'Bluetooth thermal printer ready' : 'Bluetooth thermal printer disconnected'}</span>
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl border bg-white dark:bg-dark-card border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg">
              <Monitor size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">System Driver / Browser Print</h4>
                <StatusDot on={true} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Always available — used for A4 invoices and as a fallback.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation Header — Pill Navigation from Main */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-dark-card/80 rounded-2xl border border-slate-200/80 dark:border-dark-border/80 overflow-x-auto">
        {([
          { key: 'receipt', label: 'Receipts', hint: 'Thermal bills', icon: FileText },
          { key: 'receiptBuilder', label: 'Receipt Builder', hint: 'Custom layout', icon: Sparkles },
          { key: 'label', label: 'Labels', hint: 'Barcode stickers', icon: Tag },
          { key: 'invoice', label: 'A4 invoice', hint: 'Full-page bill', icon: Layers },
        ] as const).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
              activeTab === t.key
                ? 'bg-white text-slate-900 shadow-sm dark:bg-blue-600 dark:text-white dark:shadow-none'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-dark-elevated/60'
            }`}
          >
            <t.icon size={15} />
            <span>{t.label}</span>
            <span className={`hidden sm:inline text-[11px] font-medium ${
              activeTab === t.key
                ? 'text-slate-400 dark:text-blue-100/80'
                : 'text-slate-400/80 dark:text-slate-500'
            }`}>
              {t.hint}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: Thermal Receipt Settings & Live Preview */}
      {activeTab === 'receipt' && (
        <div className="space-y-4 w-full min-w-0">
          <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0">
            <div className="w-full lg:w-7/12 space-y-4 min-w-0">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">Advanced layout in Receipt Builder</p>
                  <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300 mt-1 leading-relaxed">
                    Custom blocks, restaurant layouts, and fine-grained positioning can also be edited in Receipt Builder.
                  </p>
                </div>
                <Button type="button" size="sm" onClick={() => setActiveTab('receiptBuilder')} className="shrink-0">
                  Open Receipt Builder
                </Button>
              </div>

              <Section
                eyebrow="Checkout"
                title="Paper and print destination"
                description="Choose roll width and where a receipt goes after a sale."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                      Paper Width
                      <FieldInfo textKey="tip.printer.paperWidth" />
                    </label>
                    <div className="flex gap-2">
                      {(['58mm', '80mm'] as const).map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setConfig(prev => ({ ...prev, paperSize: size }))}
                          className={`flex-1 py-2 px-3 ${chipClass(config.paperSize === size)}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      Use 58mm for 2-inch rolls, 80mm for 3-inch rolls.
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                      After checkout, print to
                      <FieldInfo textKey="tip.printer.printDestination" />
                    </label>
                    <select
                      value={config.connectionType}
                      onChange={(e) => setConfig(prev => ({ ...prev, connectionType: e.target.value as 'bluetooth' | 'system_driver' }))}
                      className={fieldClass}
                    >
                      <option value="bluetooth">Bluetooth printer</option>
                      <option value="system_driver">Browser print dialog</option>
                    </select>
                    <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {bleState.status === 'connected'
                        ? `Bluetooth is connected${bleState.deviceName ? ` (${bleState.deviceName})` : ''}.`
                        : 'Bluetooth is off — connect above, or keep browser print as the fallback.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-1">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Shorter receipts</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Hides extra lines so a small bill uses less paper.</p>
                  </div>
                  <Switch
                    checked={receiptConfig.compactMode ?? false}
                    onChange={v => setReceiptConfig(prev => ({ ...prev, compactMode: v }))}
                    label="Compact"
                  />
                </div>

                <div className="rounded-xl border border-slate-100 dark:border-dark-border px-4 py-3 bg-slate-50/70 dark:bg-dark-elevated/40">
                  <Switch
                    checked={config.autoPrintOnSale}
                    onChange={v => setConfig(prev => ({ ...prev, autoPrintOnSale: v }))}
                    label="Print receipt automatically after checkout"
                    info={<FieldInfo textKey="tip.printer.autoPrintOnSale" />}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pb-1 -mt-1">
                    {config.autoPrintOnSale
                      ? 'Bluetooth prints in the background when connected. You can still pick A4, thermal, or skip from the print panel.'
                      : 'After checkout you will choose thermal, A4, Bluetooth, or skip.'}
                  </p>
                </div>

                <div>
                  <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                    Font Size
                    <FieldInfo textKey="tip.printer.fontSize" />
                  </label>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, fontSize: size }))}
                        className={`flex-1 py-2 px-3 capitalize ${chipClass(config.fontSize === size)}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              <Section
                eyebrow="Header & footer"
                title="Store & Invoice details"
                description="These fields are shared with Settings → Invoice."
                action={
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-dark-card px-2 py-1 rounded-full">
                    Synced with Settings
                  </span>
                }
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={receiptConfig.headerTitle ?? 'TAX INVOICE'}
                    onChange={e => setReceiptConfig(prev => ({ ...prev, headerTitle: e.target.value }))}
                    placeholder="e.g. TAX INVOICE, RETAIL BILL, ESTIMATE"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs font-bold text-gray-900 dark:text-gray-100"
                  />
                  <select
                    value={receiptConfig.headerTitle ?? 'TAX INVOICE'}
                    onChange={e => setReceiptConfig(prev => ({ ...prev, headerTitle: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <option value="TAX INVOICE">TAX INVOICE</option>
                    <option value="RETAIL BILL">RETAIL BILL</option>
                    <option value="BILL OF SUPPLY">BILL OF SUPPLY</option>
                    <option value="ESTIMATE / QUOTATION">ESTIMATE</option>
                    <option value="CASH MEMO">CASH MEMO</option>
                    <option value="">None (Hide Header Title)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={receiptConfig.companyName}
                      onChange={(e) => setReceiptConfig(prev => ({ ...prev, companyName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs"
                      placeholder="Company name"
                    />
                    <input
                      type="text"
                      value={receiptConfig.gstin}
                      onChange={(e) => setReceiptConfig(prev => ({ ...prev, gstin: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs"
                      placeholder="GSTIN"
                    />
                  </div>
                  <input
                    type="text"
                    value={receiptConfig.address}
                    onChange={(e) => setReceiptConfig(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs"
                    placeholder="Address"
                  />
                  <input
                    type="text"
                    value={receiptConfig.phone}
                    onChange={(e) => setReceiptConfig(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs"
                    placeholder="Phone number"
                  />
                  <textarea
                    rows={2}
                    value={receiptConfig.footerMessage}
                    onChange={(e) => setReceiptConfig(prev => ({ ...prev, footerMessage: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs resize-none"
                    placeholder="Footer message"
                  />
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={receiptConfig.termsLine1}
                      onChange={(e) => setReceiptConfig(prev => ({ ...prev, termsLine1: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs"
                      placeholder="Terms line 1"
                    />
                    <input
                      type="text"
                      value={receiptConfig.termsLine2}
                      onChange={(e) => setReceiptConfig(prev => ({ ...prev, termsLine2: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs"
                      placeholder="Terms line 2"
                    />
                    <input
                      type="text"
                      value={receiptConfig.termsLine3}
                      onChange={(e) => setReceiptConfig(prev => ({ ...prev, termsLine3: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs"
                      placeholder="Terms line 3 (optional)"
                    />
                  </div>
                </div>
              </Section>

              <Section
                eyebrow="Layout"
                title="What prints on the receipt"
                description="Turn lines on or off. The live preview on the right updates immediately."
                action={
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptConfig(prev => ({
                          ...prev,
                          showCompanyHeader: true,
                          showAddress: true,
                          showPhone: true,
                          showGSTIN: true,
                          showCustomerDetails: true,
                          showInvoiceNoAndDate: true,
                          showSubtotalDiscount: true,
                          showTaxBreakdown: true,
                          showFooterMessage: true,
                          showTerms: true,
                          showBarcode: true,
                          compactMode: false
                        }))
                        setConfig(prev => ({ ...prev, showLogo: true, showGSTIN: true, showCustomerDetails: true, showBarcode: true }))
                      }}
                      className="font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
                    >
                      Show all
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptConfig(prev => ({
                          ...prev,
                          showCompanyHeader: true,
                          showAddress: false,
                          showPhone: false,
                          showGSTIN: false,
                          showCustomerDetails: false,
                          showInvoiceNoAndDate: true,
                          showSubtotalDiscount: false,
                          showTaxBreakdown: false,
                          showFooterMessage: false,
                          showTerms: false,
                          showBarcode: false,
                          compactMode: true
                        }))
                        setConfig(prev => ({ ...prev, showLogo: false, showGSTIN: false, showCustomerDetails: false, showBarcode: false }))
                      }}
                      className="font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
                    >
                      Show less
                    </button>
                  </div>
                }
              >
                {/* Store Logo Graphic Section + Dev's Logo Size Selector */}
                <div className="p-4 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-white flex items-center justify-center">
                        <ImageIcon size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">Store Logo Graphic</span>
                        <p className="text-[11px] text-gray-500">Show high-contrast brand logo at top of receipt</p>
                      </div>
                    </div>
                    <Switch
                      label="Show Store Logo Graphic"
                      checked={config.showLogo ?? true}
                      onChange={v => setConfig(prev => ({ ...prev, showLogo: v }))}
                    />
                  </div>
                  {config.showLogo && (
                    <div className="pt-3 border-t border-gray-100 dark:border-dark-border space-y-3">
                      <ImageUpload
                        label="Store Logo Image"
                        value={receiptConfig.logoURL || settings?.businessLogoURL || ''}
                        onChange={(url) => setReceiptConfig(prev => ({ ...prev, logoURL: url }))}
                        previewSize="md"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        enableBackgroundCleanup
                      />
                      {/* Logo Size Picker from Dev */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                          Logo Size on Receipt
                        </label>
                        <div className="flex gap-2">
                          {(['small', 'medium', 'large'] as const).map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setReceiptConfig(prev => ({ ...prev, receiptLogoSize: chip }))}
                              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                                (receiptConfig.receiptLogoSize ?? 'medium') === chip
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white dark:bg-dark-elevated text-gray-600 dark:text-gray-300 border-gray-300 dark:border-dark-border-strong hover:border-purple-400'
                              }`}
                            >
                              {chip.charAt(0).toUpperCase() + chip.slice(1)}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Small: 32px · Medium: 56px · Large: 80px tall</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content & Information Toggles */}
                <div className="divide-y divide-gray-100 dark:divide-dark-border border border-gray-100 dark:border-dark-border rounded-xl px-4 bg-white dark:bg-dark-card">
                  <Switch
                    checked={receiptConfig.showCompanyHeader ?? true}
                    onChange={v => setReceiptConfig(prev => ({ ...prev, showCompanyHeader: v }))}
                    label="Company Name & Title Header"
                  />
                  <Switch
                    checked={receiptConfig.showAddress ?? true}
                    onChange={v => setReceiptConfig(prev => ({ ...prev, showAddress: v }))}
                    label="Business Address line"
                  />
                  <Switch
                    checked={receiptConfig.showPhone ?? true}
                    onChange={v => setReceiptConfig(prev => ({ ...prev, showPhone: v }))}
                    label="Business Phone Number line"
                  />
                  <Switch
                    checked={receiptConfig.showGSTIN ?? true}
                    onChange={v => {
                      setReceiptConfig(prev => ({ ...prev, showGSTIN: v }))
                      setConfig(prev => ({ ...prev, showGSTIN: v }))
                    }}
                    label="GSTIN / Tax Registration Number"
                    info={<FieldInfo textKey="tip.printer.showGSTIN" />}
                  />
                  <Switch
                    checked={receiptConfig.showCustomerDetails ?? true}
                    onChange={v => {
                      setReceiptConfig(prev => ({ ...prev, showCustomerDetails: v }))
                      setConfig(prev => ({ ...prev, showCustomerDetails: v }))
                    }}
                    label="Customer Name & Mobile Number"
                    info={<FieldInfo textKey="tip.printer.showCustomerDetails" />}
                  />
                  <Switch
                    checked={receiptConfig.showInvoiceNoAndDate ?? true}
                    onChange={v => setReceiptConfig(prev => ({ ...prev, showInvoiceNoAndDate: v }))}
                    label="Invoice Number & Date Header"
                  />
                  <Switch
                    checked={receiptConfig.showSubtotalDiscount ?? true}
                    onChange={v => setReceiptConfig(prev => ({ ...prev, showSubtotalDiscount: v }))}
                    label="Subtotal & Item Discount breakdown"
                  />
                  <Switch
                    checked={receiptConfig.showTaxBreakdown ?? true}
                    onChange={v => setReceiptConfig(prev => ({ ...prev, showTaxBreakdown: v }))}
                    label="SGST / CGST Tax breakdown lines"
                  />
                  <Switch
                    checked={receiptConfig.showFooterMessage ?? true}
                    onChange={v => setReceiptConfig(prev => ({ ...prev, showFooterMessage: v }))}
                    label="Footer Thank You message"
                  />
                  <Switch
                    checked={receiptConfig.showTerms ?? true}
                    onChange={v => setReceiptConfig(prev => ({ ...prev, showTerms: v }))}
                    label="Terms & Conditions lines"
                  />
                  <Switch
                    checked={receiptConfig.showBarcode ?? true}
                    onChange={v => {
                      setReceiptConfig(prev => ({ ...prev, showBarcode: v }))
                      setConfig(prev => ({ ...prev, showBarcode: v }))
                    }}
                    label="Bottom Invoice Barcode / Identifier graphic"
                    info={<FieldInfo textKey="tip.printer.showBarcode" />}
                  />
                </div>

                {/* Payment QR Code (UPI / QR Pay) Section + Dev's QR Size Selector */}
                {/* QR Code on Bills Section with 3 Options */}
                <div className="p-4 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <QrCode size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">QR Code on Bills</span>
                        <p className="text-[11px] text-gray-500">Print a scannable QR code on receipts (UPI pay, digital bill, or custom link)</p>
                      </div>
                    </div>
                    <Switch
                      label="Enable QR Code on Bills"
                      checked={receiptConfig.showPaymentQR ?? false}
                      onChange={v => {
                        setReceiptConfig(prev => ({
                          ...prev,
                          showPaymentQR: v,
                          qrType: v ? (prev.qrType || 'upi') : prev.qrType,
                        }))
                        setConfig(prev => ({ ...prev, invoiceShowPaymentQR: v }))
                      }}
                    />
                  </div>
                  {receiptConfig.showPaymentQR && (
                    <div className="pt-3 border-t border-gray-100 dark:border-dark-border space-y-4">
                      {/* 3 Selectable QR Options — Exactly one is active */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                          Select QR Code Type (One must be selected)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {([
                            {
                              id: 'upi' as const,
                              title: 'UPI Payment QR',
                              badge: (sel: boolean) => (
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                    sel
                                      ? 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 shadow-xs'
                                      : 'bg-gray-100 dark:bg-dark-elevated border-gray-200 dark:border-dark-border'
                                  }`}
                                >
                                  <UpiIcon className="w-4 h-4" />
                                </div>
                              ),
                              desc: 'Live dynamic UPI QR for customer checkout payments',
                            },
                            {
                              id: 'digital_bill' as const,
                              title: 'Digital Bill PDF',
                              badge: (sel: boolean) => (
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                    sel
                                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400 border-blue-300 dark:border-blue-700 shadow-xs'
                                      : 'bg-gray-100 text-gray-500 dark:bg-dark-elevated dark:text-gray-400 border-gray-200 dark:border-dark-border'
                                  }`}
                                >
                                  <FileText size={15} />
                                </div>
                              ),
                              desc: 'Scan to view & download invoice / receipt PDF',
                            },
                            {
                              id: 'custom' as const,
                              title: 'Custom Link / Web',
                              badge: (sel: boolean) => (
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                    sel
                                      ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/70 dark:text-purple-400 border-purple-300 dark:border-purple-700 shadow-xs'
                                      : 'bg-gray-100 text-gray-500 dark:bg-dark-elevated dark:text-gray-400 border-gray-200 dark:border-dark-border'
                                  }`}
                                >
                                  <Globe size={15} />
                                </div>
                              ),
                              desc: 'Store website, Google review, menu, or link',
                            },
                          ]).map(opt => {
                            const isSelected = (receiptConfig.qrType || 'upi') === opt.id
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setReceiptConfig(prev => ({
                                    ...prev,
                                    showPaymentQR: true,
                                    qrType: opt.id,
                                  }))
                                }}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 dark:border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                                    : 'border-gray-200 dark:border-dark-border-strong bg-white dark:bg-dark-elevated hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    {opt.badge(isSelected)}
                                    <span className={`text-xs font-bold ${isSelected ? 'text-emerald-900 dark:text-emerald-200' : 'text-gray-900 dark:text-gray-100'}`}>
                                      {opt.title}
                                    </span>
                                  </div>
                                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 dark:border-dark-border'}`}>
                                    {isSelected ? <div className="w-1.5 h-1.5 bg-white rounded-full" /> : null}
                                  </div>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{opt.desc}</p>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Option-Specific Configuration Inputs */}
                      {(receiptConfig.qrType || 'upi') === 'upi' && (
                        <div className="space-y-3 bg-gray-50 dark:bg-dark-elevated/60 p-3 rounded-xl border border-gray-100 dark:border-dark-border">
                          <div>
                            <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                              UPI ID for Live Payment QR (Recommended)
                            </label>
                            <input
                              type="text"
                              value={receiptConfig.upiId || ''}
                              onChange={(e) => setReceiptConfig(prev => ({ ...prev, upiId: e.target.value.trim() }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs font-medium"
                              placeholder="yourname@okhdfcbank"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">
                              Encodes the exact bill amount dynamically on printed thermal receipts and in checkout.
                            </p>
                          </div>
                          <ImageUpload
                            label="Or upload a static Payment QR Code image (Fallback)"
                            value={receiptConfig.paymentQrURL || ''}
                            onChange={(url) => setReceiptConfig(prev => ({ ...prev, paymentQrURL: url }))}
                            previewSize="md"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                          />
                        </div>
                      )}

                      {(receiptConfig.qrType || 'upi') === 'digital_bill' && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
                          <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                            <FileText size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                            <span>Digital Bill / Invoice PDF URL</span>
                          </div>
                          <p className="text-[11px] text-blue-700 dark:text-blue-300">
                            Automatically generates a QR code linking to each invoice&apos;s digital receipt page where customers can view, download, or share their PDF bill.
                          </p>
                        </div>
                      )}

                      {(receiptConfig.qrType || 'upi') === 'custom' && (
                        <div className="space-y-2 bg-gray-50 dark:bg-dark-elevated/60 p-3 rounded-xl border border-gray-100 dark:border-dark-border">
                          <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block">
                            Custom Link / Website URL
                          </label>
                          <input
                            type="text"
                            value={receiptConfig.customQrUrl || ''}
                            onChange={(e) => setReceiptConfig(prev => ({ ...prev, customQrUrl: e.target.value.trim() }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs font-medium"
                            placeholder="https://g.page/r/your-google-review-link or https://yourstore.com"
                          />
                          <p className="text-[11px] text-gray-400">
                            Customers can scan this QR code on their printed bill to visit your website, leave a Google review, or view your menu.
                          </p>
                        </div>
                      )}

                      {/* QR Code Size Selector */}
                      <div className="pt-2 border-t border-gray-100 dark:border-dark-border/80">
                        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                          QR Code Size on Receipt
                        </label>
                        <div className="flex gap-2">
                          {(['small', 'medium', 'large'] as const).map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setReceiptConfig(prev => ({ ...prev, receiptQrSize: chip }))}
                              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                                (receiptConfig.receiptQrSize ?? 'medium') === chip
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white dark:bg-dark-elevated text-gray-600 dark:text-gray-300 border-gray-300 dark:border-dark-border-strong hover:border-emerald-400'
                              }`}
                            >
                              {chip.charAt(0).toUpperCase() + chip.slice(1)}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Small: 80px · Medium: 110px · Large: 140px</p>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            </div>

            {/* Right Column: Live Sticky Preview */}
            <div className="w-full lg:w-5/12 flex flex-col min-w-0 max-w-full self-start lg:sticky lg:top-6">
              <Section
                eyebrow="Preview"
                title={`Thermal receipt · ${config.paperSize}`}
                action={
                  receiptConfig.compactMode ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Compact
                    </span>
                  ) : null
                }
              >
                <ReceiptLivePreview
                  paperSize={config.paperSize === '80mm' ? '80mm' : '58mm'}
                  receiptConfig={receiptConfig}
                  settings={settings}
                  showLogo={!!config.showLogo}
                  cutPaper={false}
                  activeTemplate={effectivePreviewTemplate}
                  isRestaurant={isRestaurant}
                  receiptFont={config.receiptFont}
                  gstOpts={previewGstOpts}
                />

              </Section>
            </div>
          </div>
        </div>
      )}


      {/* Tab 3: Receipt Builder from Dev */}
      {activeTab === 'receiptBuilder' && (
        <ReceiptBuilderTab
          ref={receiptBuilderRef}
          connectionType={config.connectionType}
          bleConnected={bleState.status === 'connected'}
          receiptConfigOverride={receiptConfig}
          receiptFont={config.receiptFont}
          previewGstOpts={previewGstOpts}
          gstForm={gstForm}
          onGstStyleChange={setGstStyle}
          onGstPrintOnReceiptChange={setGstPrintOnReceipt}
          onGstItemWiseGstChange={setGstItemWiseGst}
          onSaveGst={() => saveGstBilling()}
          isSavingGst={isSavingGst}
        />
      )}

      {/* Tab 3: Label Designer from Main */}
      {activeTab === 'label' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          <div className="w-full lg:w-7/12 space-y-4 min-w-0">
            <Section
              eyebrow="Layout"
              title="Label layout"
              description="Pick a starting layout, then add or remove fields below."
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { preset: PRESET_RETAIL_DUAL_CODE, title: 'Barcode + QR', hint: 'Name, barcode, QR, and price' },
                  { preset: PRESET_CENTERED_STANDARD, title: 'Standard price tag', hint: 'Store name, product, barcode, price' },
                  { preset: PRESET_MINIMAL_TAG, title: 'Name + barcode', hint: 'Small tag with product and price' },
                ]).map(opt => {
                  const active = labelTemplate.map(e => e.type).join('|') === opt.preset.map(e => e.type).join('|')
                  return (
                    <button
                      key={opt.title}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, labelTemplate: opt.preset }))}
                      className={`text-left py-2.5 px-3 rounded-xl text-xs transition-colors border ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                          : 'border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-card/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold">{opt.title}</div>
                      <div className={`text-[10px] mt-0.5 ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                        {opt.hint}
                      </div>
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section
              eyebrow="Hardware"
              title="Dimensions and speed"
              description="Adjust for your roll width, height, and printer language."
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    value={config.labelWidth}
                    onChange={e => setConfig(prev => ({ ...prev, labelWidth: Number(e.target.value) || 50 }))}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Height (mm)
                  </label>
                  <input
                    type="number"
                    value={config.labelHeight}
                    onChange={e => setConfig(prev => ({ ...prev, labelHeight: Number(e.target.value) || 30 }))}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Shift X (px)
                  </label>
                  <input
                    type="number"
                    value={config.labelOffsetX ?? 0}
                    onChange={e => setConfig(prev => ({ ...prev, labelOffsetX: Number(e.target.value) }))}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Shift Y (px)
                  </label>
                  <input
                    type="number"
                    value={config.labelOffsetY ?? 0}
                    onChange={e => setConfig(prev => ({ ...prev, labelOffsetY: Number(e.target.value) }))}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Barcode Type
                  </label>
                  <select
                    value={config.labelBarcodeType || 'CODE128'}
                    onChange={e => setConfig(prev => ({ ...prev, labelBarcodeType: e.target.value as any }))}
                    className={fieldClass}
                  >
                    <option value="CODE128">Code 128 (Standard)</option>
                    <option value="EAN13">EAN-13 (Retail Standard)</option>
                    <option value="QR">QR Code Matrix</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Barcode Offset X
                  </label>
                  <input
                    type="number"
                    value={config.labelBarcodeOffsetX ?? 0}
                    onChange={e => setConfig(prev => ({ ...prev, labelBarcodeOffsetX: Number(e.target.value) }))}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-dark-bg/40 rounded-xl border border-slate-200 dark:border-dark-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Printer Command Language</span>
                    <p className="text-[11px] text-slate-500">TSPL is native for thermal sticker printers.</p>
                  </div>
                  <div className="flex gap-1.5">
                    {(['tspl', 'escpos'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, labelPrinterMode: mode }))}
                        className={`py-1 px-3 ${chipClass(config.labelPrinterMode === mode)}`}
                      >
                        {mode === 'tspl' ? 'TSPL / TSC' : 'ESC/POS'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-dark-border">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Sensor calibration:</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCalibrateGap}
                      disabled={bleState.status !== 'connected'}
                      className="text-xs"
                    >
                      Calibrate Gap
                    </Button>
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, labelDirection: prev.labelDirection === 1 ? 0 : 1 }))}
                      className={`text-xs px-2.5 py-1 rounded-lg border ${
                        config.labelDirection === 1
                          ? 'bg-purple-100 border-purple-300 text-purple-800'
                          : 'border-slate-300 text-slate-600'
                      }`}
                    >
                      {config.labelDirection === 1 ? '180° Flip ON' : '180° Flip OFF'}
                    </button>
                  </div>
                </div>
              </div>
            </Section>

            <Section
              eyebrow="Test & preview"
              title="Pick a product to preview"
              description="Preview and test print with real catalog items."
            >
              <div className="flex gap-2">
                <select
                  value={previewProductId}
                  onChange={(e) => setPreviewProductId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-dark-border-strong rounded-xl bg-white dark:bg-dark-elevated text-xs font-semibold"
                >
                  <option value="">-- Select Real Product --</option>
                  {(products || []).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.barcode || p.sku || 'No code'}) - {formatINR(p.sellingPrice)}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={handleTestPrint} className="flex items-center gap-1.5">
                  <Printer size={14} />
                  Print
                </Button>
              </div>
            </Section>

            <Section
              eyebrow="Elements"
              title="Label content & fields"
              description="Add, arrange, and style text, barcode, price, and QR codes."
              action={
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addLabelElement(e.target.value as LabelElementType)
                        e.target.value = ''
                      }
                    }}
                    className="text-xs font-bold text-blue-600 dark:text-white bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>+ Add Element...</option>
                    {Object.entries(LABEL_ELEMENT_META).map(([type, meta]) => (
                      <option key={type} value={type}>
                        {meta.icon} {meta.label}
                      </option>
                    ))}
                  </select>
                </div>
              }
            >
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {labelTemplate.map((el, idx) => (
                  <div
                    key={el.id}
                    className="p-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{LABEL_ELEMENT_META[el.type]?.icon || '📄'}</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                          {LABEL_ELEMENT_META[el.type]?.label || el.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {el.type !== 'divider' && (
                          <>
                            <div className="flex border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden mr-1">
                              <button
                                type="button"
                                onClick={() => updateLabelElement(el.id, { align: 'left' })}
                                className={`p-1 ${el.align === 'left' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
                              >
                                <AlignLeft size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateLabelElement(el.id, { align: 'center' })}
                                className={`p-1 ${el.align === 'center' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
                              >
                                <AlignCenter size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateLabelElement(el.id, { align: 'right' })}
                                className={`p-1 ${el.align === 'right' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
                              >
                                <AlignRight size={13} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => updateLabelElement(el.id, { bold: !el.bold })}
                              className={`p-1 rounded ${el.bold ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated'}`}
                            >
                              <Bold size={13} />
                            </button>
                            <select
                              value={el.fontSize || (el.large ? 'large' : 'medium')}
                              onChange={(e) => updateLabelElement(el.id, { fontSize: e.target.value as any })}
                              className="text-[10px] font-bold px-1 py-0.5 border border-gray-200 dark:border-dark-border-strong rounded bg-white dark:bg-dark-elevated text-gray-700 dark:text-gray-200"
                            >
                              <option value="small">Small</option>
                              <option value="medium">Medium</option>
                              <option value="large">Large</option>
                              <option value="xlarge">X-Large</option>
                            </select>
                          </>
                        )}
                        <button type="button" onClick={() => moveLabelElement(el.id, -1)} disabled={idx === 0} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated disabled:opacity-30">
                          <ArrowUp size={13} />
                        </button>
                        <button type="button" onClick={() => moveLabelElement(el.id, 1)} disabled={idx === labelTemplate.length - 1} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-elevated disabled:opacity-30">
                          <ArrowDown size={13} />
                        </button>
                        <button type="button" onClick={() => removeLabelElement(el.id)} className="p-1 rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {(el.type === 'price' || el.type === 'businessName' || el.type === 'productName' || el.type === 'sku' || el.type === 'custom') && (
                      <div className="flex gap-2 text-[10px] pt-1">
                        <input
                          type="text"
                          placeholder="Prefix (e.g. Rs. )"
                          value={el.prefix ?? ''}
                          onChange={(e) => updateLabelElement(el.id, { prefix: e.target.value })}
                          className="flex-1 px-2 py-0.5 border border-gray-200 dark:border-dark-border-strong rounded bg-white dark:bg-dark-elevated text-gray-800 dark:text-gray-200"
                        />
                        <input
                          type="text"
                          placeholder="Suffix (e.g. /-)"
                          value={el.suffix ?? ''}
                          onChange={(e) => updateLabelElement(el.id, { suffix: e.target.value })}
                          className="flex-1 px-2 py-0.5 border border-gray-200 dark:border-dark-border-strong rounded bg-white dark:bg-dark-elevated text-gray-800 dark:text-gray-200"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div className="w-full lg:w-5/12 flex flex-col lg:sticky lg:top-6 min-w-0 max-w-full">
            <Section
              eyebrow="Preview"
              title={`Label · ${config.labelWidth}mm × ${config.labelHeight}mm`}
            >
              <div className="p-6 sm:p-8 bg-slate-900 rounded-2xl flex items-center justify-center w-full min-h-[240px] max-w-full overflow-hidden relative">
                <div
                  className="bg-white text-gray-900 p-3.5 rounded-lg shadow-xl flex flex-col justify-start gap-1 border border-gray-300 transition-all duration-300 relative overflow-hidden"
                  style={{
                    width: `${Math.min(config.labelWidth * 4.5, 280)}px`,
                    minHeight: `${Math.min(config.labelHeight * 4.5, 180)}px`,
                    transform: `translate(${config.labelOffsetX ?? 0}px, ${config.labelOffsetY ?? 0}px)`,
                  }}
                >
                  {labelTemplate.map(el => {
                    const alignClass = el.align === 'left' ? 'text-left w-full' : el.align === 'right' ? 'text-right w-full' : 'text-center w-full'
                    const fontClass = el.fontSize === 'small' ? 'text-[9px]' : el.fontSize === 'large' ? 'text-sm' : el.fontSize === 'xlarge' ? 'text-base' : 'text-[11px]'
                    
                    if (el.type === 'divider') {
                      return <hr key={el.id} className="border-t border-gray-400 my-1 w-full" />
                    }

                    if (el.type === 'sideBySideBarcodeQr') {
                      return (
                        <div key={el.id} className="flex items-center justify-between w-full my-1 gap-1">
                          <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="font-extrabold text-[10px] tracking-widest leading-none">|||||| ||||| ||||</div>
                            <span className="text-[8px] font-mono text-gray-600">{labelData.barcodeValue}</span>
                          </div>
                          <div className="w-10 flex items-center justify-center flex-shrink-0">
                            <QrCode size={26} className="text-slate-900" />
                          </div>
                        </div>
                      )
                    }

                    if (el.type === 'barcode' || el.type === 'qrCode') {
                      return (
                        <div key={el.id} className="w-full flex flex-col items-center justify-center my-1">
                          {el.type === 'qrCode' || config.labelBarcodeType === 'QR' ? (
                            <QrCode size={32} className="inline-block text-slate-900" />
                          ) : (
                            <>
                              <div className="font-extrabold text-sm tracking-widest leading-none">|||||| ||||| |||||||</div>
                              <span className="text-[9px] font-mono text-gray-600 mt-0.5">{labelData.barcodeValue}</span>
                            </>
                          )}
                        </div>
                      )
                    }

                    const text = resolveElementText(el, labelData)
                    const priceExtra = el.type === 'price' ? 'mt-auto pt-1' : ''
                    return (
                      <div
                        key={el.id}
                        className={`${alignClass} truncate ${el.bold ? 'font-bold' : ''} ${fontClass} ${priceExtra}`}
                      >
                        {text}
                      </div>
                    )
                  })}
                </div>
              </div>
              {!selectedProduct && (
                <p className="text-[11px] text-slate-500 mt-1 text-center">Pick a product above to preview with real data.</p>
              )}
            </Section>
          </div>
        </div>
      )}

      {/* Tab 4: A4 Full Invoice Settings & Live Preview from Main */}
      {activeTab === 'invoice' && (
        <A4InvoiceTab
          config={config}
          setConfig={setConfig}
          receiptConfig={receiptConfig}
          setReceiptConfig={setReceiptConfig}
          settings={settings}
        />
      )}

      {/* Unchanged Save Confirmation Modal */}
      <Modal
        isOpen={isUnchangedSaveConfirmOpen}
        onClose={() => setIsUnchangedSaveConfirmOpen(false)}
        title="Settings are unchanged"
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsUnchangedSaveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsUnchangedSaveConfirmOpen(false)
                executeSave()
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              Save anyway
            </Button>
          </div>
        }
      >
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          You haven't changed any printer or receipt settings since they were loaded. Do you still want to re-save them to the database?
        </p>
      </Modal>

      {/* Quick Text to Thermal Print Modal */}
      <Modal
        isOpen={showQuickPrintModal}
        onClose={() => setShowQuickPrintModal(false)}
        title="Quick Text to Thermal Print"
        size="xl"
      >
        <TextToThermalPrintTab
          config={config}
          setConfig={setConfig}
          receiptConfig={receiptConfig}
          setReceiptConfig={setReceiptConfig}
          settings={settings}
        />
      </Modal>

      {/* Tutorial Video Modal & Guided Onboarding Tour */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="printers"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
