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
import type { Sale } from '@/types/sale.types'
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
import { ReceiptLivePreview } from './components/ReceiptLivePreview'
import { A4InvoiceTab } from './components/A4InvoiceTab'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section, StatusDot, chipClass, fieldClass } from './components/PrintersUi'
import {
  LABEL_SIZE_PRESETS,
  snapLabelPreset,
} from '@/utils/labelSizes'
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
  Image as ImageIcon,
} from 'lucide-react'

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `el-${Date.now()}-${Math.random()}`)

// Default fallback printer configuration — company name/address/phone/GSTIN/
// footer/terms are NOT here; they live on Settings.receiptConfig (see below),
// the same object the Settings page and the real print pipeline both use.
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
  invoiceDocTitle: 'TAX INVOICE',
  invoiceShowHsn: true,
  invoiceShowSku: false,
  invoiceShowUnit: true,
  invoiceShowBatchExpiry: false,
  invoiceReverseCharge: 'No',
  invoiceSignatureName: 'Authorised Signatory',
}

// Mirrors SettingsPage's DEFAULT_SETTINGS.receiptConfig exactly, so both
// pages fall back to the same values before any settings row exists.
const defaultReceiptConfig: ReceiptConfig = {
  headerTitle: 'TAX INVOICE',
  companyName: '',
  address: '',
  phone: '',
  gstin: '',
  logoURL: '',
  footerMessage: 'Thank you for your purchase!',
  termsLine1: '1. Goods once sold will not be taken back or exchanged',
  termsLine2: '2. All disputes are subject to local jurisdiction only',
  termsLine3: '',
  compactMode: false,
  showCompanyHeader: true,
  showAddress: true,
  showPhone: true,
  showGSTIN: true,
  showCustomerDetails: true,
  showInvoiceNoAndDate: true,
  showTaxBreakdown: true,
  showSubtotalDiscount: true,
  showFooterMessage: true,
  showTerms: true,
  showBarcode: true,
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
  const { user } = useAuth()
  const { data: products } = useProducts()
  const { data: settings, isLoading, isError, refetch } = useSettings()
  const { mutate: updateSettingsMutation, isPending: isUpdating } = useUpdateSettings()
  const { mutate: createSettingsMutation, isPending: isCreating } = useCreateSettings()
  const saving = isUpdating || isCreating

  const [config, setConfig] = useState<PrinterConfig>(defaultPrinterConfig)
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig>(defaultReceiptConfig)
  const [activeTab, setActiveTab] = useState<'receipt' | 'label' | 'invoice'>('receipt')

  // Which real product's data is used to preview/print the label
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
  const prevBleStatus = useRef(bleState.status)
  const [linkPulse, setLinkPulse] = useState<'connected' | 'disconnected' | null>(null)

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

  // Subscribe to Web Bluetooth events & try auto reconnecting known device
  useEffect(() => {
    const unsubscribe = subscribeBlePrinter(s => setBleState(s))
    tryReconnectKnownPrinter()
    return () => unsubscribe()
  }, [])

  // Sync local editable drafts whenever the shared settings query has fresh
  // data — this is the SAME react-query cache the Settings page reads and
  // writes, so a save made on either page shows up here (and vice versa)
  // without needing a manual refetch.
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
      // Older saved rows may still carry fields from earlier iterations of this
      // page (fake driver selection, dead USB/IP option, boolean-flag label
      // toggles, the disconnected header/footer text) — drop them so a stale
      // value can't silently no-op in the UI.
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
      const snapped = snapLabelPreset(merged.labelWidth || 50, merged.labelHeight || 30)
      merged.labelWidth = snapped.width
      merged.labelHeight = snapped.height
      setConfig(merged)
    }

    const mergedReceipt = { ...defaultReceiptConfig, ...settings.receiptConfig }
    if (!mergedReceipt.logoURL && settings.businessLogoURL) {
      mergedReceipt.logoURL = settings.businessLogoURL
    }
    setReceiptConfig(mergedReceipt)
  }, [settings])

  // Save configuration to Database — writes printerConfig AND receiptConfig
  // together, merged on top of every other existing settings field (business
  // profile, personal info, notifications) so this save can never clobber
  // something edited on the Settings page.
  const handleSave = async () => {
    if (!user) return
    if (isError) {
      toast.error('Settings are still loading from the server. Wait a moment and try again.')
      return
    }

    const printerPayload = {
      receiptConfig,
      printerConfig: config,
      businessLogoURL: receiptConfig.logoURL || settings?.businessLogoURL || '',
    }

    if (settings?.id) {
      updateSettingsMutation(
        { settingsId: settings.id, data: printerPayload },
        {
          onSuccess: () => {
            trackUserAction('feature_printer_settings_saved', { mode: config.connectionType })
            toast.success('Printer settings saved!')
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
        },
        onError: (err) => {
          console.error('Create settings error:', err)
          toastError(err, 'Could not save printer settings. Please try again.')
        },
      }
    )
  }

  // Connection type is the user's saved preference for where receipts go.
  // Do not overwrite it when Bluetooth connects or drops — that used to
  // wipe a saved "Bluetooth" choice the moment the printer was off.

  // Connect Bluetooth Printer
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

  // Disconnect Bluetooth Printer
  const handleDisconnectBluetooth = () => {
    disconnectPrinter()
    toast.success('Bluetooth printer disconnected')
  }

  // Send hardware Gap Auto-Calibration command to Bluetooth Printer
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

  // Safely guarded labelTemplate array (falls back to defaultLabelTemplate if undefined or empty)
  const labelTemplate = useMemo(() => {
    return Array.isArray(config.labelTemplate) && config.labelTemplate.length > 0
      ? config.labelTemplate
      : defaultLabelTemplate
  }, [config.labelTemplate])

  // Resolved values for whichever element types are on the label — shared by
  // both the live on-screen preview and the real print byte generator, so
  // what you see is genuinely what gets sent to the printer.
  const labelData: LabelData = {
    businessName: receiptConfig.companyName || settings?.businessName || 'SEZNIK POS',
    productName: selectedProduct?.name || 'Sample Product',
    price: formatINR(selectedProduct?.sellingPrice ?? 1299),
    barcodeValue: selectedProduct?.barcode || selectedProduct?.sku || '0000000000',
    sku: selectedProduct?.sku || 'SKU-001',
    sequenceNo: '001',
  }

  // ---- Label element list editing ----
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

  // Renders the label element list to an HTML string for the browser-print
  // fallback popup, mirroring the on-page live preview element for element.
  const renderLabelHtml = () => {
    const rows = labelTemplate.map(el => {
      const style = `text-align:${el.align};font-weight:${el.bold ? 700 : 400};font-size:${el.large ? '16px' : '11px'};margin:2px 0;`
      if (el.type === 'barcode') {
        return config.labelBarcodeType === 'QR'
          ? `<div style="text-align:${el.align};margin:4px 0;font-size:28px;">▦</div>`
          : `<div style="text-align:${el.align};margin:4px 0;"><div style="font-weight:800;font-size:16px;letter-spacing:2px;">||||||||||||||||</div><div style="font-size:8px;font-family:monospace;">${labelData.barcodeValue}</div></div>`
      }
      const text = el.type === 'custom' ? (el.text ?? '') : el.type === 'businessName' ? labelData.businessName : el.type === 'productName' ? labelData.productName : labelData.price
      return `<div style="${style}">${text}</div>`
    }).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Label Print</title>
        <style>
          body { font-family: sans-serif; width: ${config.labelWidth}mm; height: ${config.labelHeight}mm; margin: 0 auto; padding: 4px; box-sizing: border-box; text-align: center; color:#000; }
        </style>
      </head>
      <body>${rows}</body>
      </html>
    `
  }

  // Test Print via Bluetooth or Browser Spooler.
  // BLE only ever fires for the tab currently being tested — a thermal/label
  // printer can't render an A4 invoice, and each tab's bytes are shaped
  // specifically for that output, so cross-firing them would print garbage.
  const handleTestPrint = async () => {
    trackUserAction('feature_test_print', { tab: activeTab, mode: config.labelPrinterMode })

    const effectiveReceiptConfig = {
      ...receiptConfig,
      showLogo: config.showLogo,
      logoURL: receiptConfig.logoURL || settings?.businessLogoURL || '',
      showPaymentQR: receiptConfig.showPaymentQR ?? false,
      paymentQrURL: receiptConfig.paymentQrURL || '',
    }

    if (activeTab === 'receipt') {
      const testSale: Sale = {
        id: 'test_sale',
        invoiceNumber: 'INV-TEST01',
        items: [
          { productId: 'p1', productName: 'Sample Wireless Mouse', quantity: 1, sellingPrice: 750.00, discount: 0, taxRate: 18, taxAmount: 135.00, total: 885.00 },
          { productId: 'p2', productName: 'USB-C Cable 1m', quantity: 2, sellingPrice: 200.00, discount: 0, taxRate: 18, taxAmount: 72.00, total: 472.00 },
        ],
        subtotal: 1150.00,
        totalDiscount: 0,
        totalTax: 207.00,
        grandTotal: 1357.00,
        paymentMethod: 'cash',
        amountPaid: 1500.00,
        changeReturned: 143.00,
        isQuickBill: false,
        createdAt: new Date().toISOString(),
      }

      if (bleState.status === 'connected' || config.connectionType === 'bluetooth') {
        try {
          if (bleState.status !== 'connected') {
            await requestAndConnectPrinter()
          }
          const bytes = await generateReceiptEscPos({
            sale: testSale,
            receiptConfig: effectiveReceiptConfig,
            paperSize: config.paperSize,
            businessName: settings?.businessName,
            businessAddress: settings?.businessAddress,
          })
          await printEscPos(bytes)
          toast.success('Test receipt sent to Bluetooth printer!')
          return
        } catch (err) {
          console.error('BLE Print error:', err)
          toast.error('Connect the Bluetooth printer first. Thermal test print does not open the system print dialog.')
          return
        }
      }

      const receiptHTML = generateReceiptHTML({
        sale: testSale,
        receiptConfig: effectiveReceiptConfig,
        businessName: settings?.businessName,
        businessAddress: settings?.businessAddress,
        customerName: 'Sample Customer',
        width: config.paperSize === '80mm' ? '80mm' : '50mm',
        logoURL: settings?.businessLogoURL || effectiveReceiptConfig.logoURL,
        settingsTaxName: 'GST',
      })
      printReceipt(receiptHTML, config.paperSize === '80mm' ? '80mm' : '50mm', 'Test Receipt')
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
                config.labelBarcodeOffsetX ?? 4,
              )
            : generateLabelEscPos(labelTemplate, config.labelBarcodeType, labelData)
          await printEscPos(bytes)
          toast.success(mode === 'tspl' ? 'Label sent to sticker printer.' : 'Label sent to receipt printer.')
          return
        } catch (err) {
          console.error('BLE Print error:', err)
          toast.error('Connect the Bluetooth printer first. Label test print does not open the system print dialog.')
          return
        }
      }

      if (config.connectionType === 'bluetooth') {
        toast.error('Connect the Bluetooth printer first to test labels.')
        return
      }

      // Browser label fallback (system printer mode only)
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

    // Invoice Tab
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

  if (isLoading) {
    return <SettingsPageSkeleton />
  }

  return (
    <div className="space-y-6 pb-16 w-full max-w-full min-w-0 overflow-x-hidden">
      {isError && (
        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Could not load printer settings yet. Your business profile was not changed.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      <div data-tour="printers-header">
        <PageHeader
          title="Printers"
          onWatchTutorial={pageTutorial.openTutorial}
          action={
            <>
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
                onClick={handleSave}
                loading={saving}
                disabled={isError}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white flex items-center gap-2 text-xs sm:text-sm"
              >
                <Save size={16} />
                Save
              </Button>
            </>
          }
        />
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-3 mb-1 max-w-2xl">
          Connect a printer, then set up receipts, barcode labels, or A4 invoices. Nothing here changes until you save.
        </p>
      </div>

      <div data-tour="printers-status" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`rounded-2xl border p-5 transition-all duration-500 ease-out ${
            bleState.status === 'connected'
              ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
          } ${
            linkPulse === 'connected'
              ? 'scale-[1.01] shadow-[0_0_0_4px_rgba(16,185,129,0.18)]'
              : linkPulse === 'disconnected'
                ? 'scale-[0.99] opacity-80'
                : ''
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                bleState.status === 'connected'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                <Bluetooth size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusDot on={bleState.status === 'connected'} />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                    {bleState.status === 'connected' ? (bleState.deviceName || 'Bluetooth printer') : 'Bluetooth printer'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {bleState.status === 'connected'
                    ? 'Connected — receipts and labels can print here.'
                    : bleState.status === 'connecting'
                      ? 'Connecting…'
                      : isBluetoothSupported()
                        ? 'Not connected. Pair in Chrome or Edge.'
                        : 'This browser does not support Web Bluetooth.'}
                </p>
              </div>
            </div>
            {bleState.status === 'connected' ? (
              <Button variant="outline" onClick={handleDisconnectBluetooth} className="text-xs shrink-0 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40">
                <Unplug size={14} className="mr-1.5" /> Disconnect
              </Button>
            ) : (
              <Button
                data-tour="printer-connect-btn"
                onClick={handleConnectBluetooth}
                disabled={connectingBle || !isBluetoothSupported()}
                className="text-xs shrink-0 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900"
              >
                <Bluetooth size={14} className="mr-1.5" /> {connectingBle ? 'Pairing…' : 'Connect'}
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Monitor size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <StatusDot on />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Browser print</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Always available. Used for A4 invoices and as a fallback when Bluetooth is off.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 overflow-x-auto">
        {([
          { key: 'receipt', label: 'Receipts', hint: 'Thermal bills', icon: FileText },
          { key: 'label', label: 'Labels', hint: 'Barcode stickers', icon: Tag },
          { key: 'invoice', label: 'A4 invoice', hint: 'Full-page bill', icon: Layers },
        ] as const).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
              activeTab === t.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <t.icon size={15} />
            <span>{t.label}</span>
            <span className={`hidden sm:inline text-[11px] font-medium ${activeTab === t.key ? 'text-slate-400' : 'text-slate-400/80'}`}>
              {t.hint}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: Thermal Receipt Settings & Live Preview */}
      {activeTab === 'receipt' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0">
          <div className="w-full lg:w-7/12 space-y-4 min-w-0">
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
                <p className="text-[11px] text-slate-500">Hides extra lines so a small bill uses less paper.</p>
              </div>
              <Switch
                checked={receiptConfig.compactMode ?? false}
                onChange={v => setReceiptConfig(prev => ({ ...prev, compactMode: v }))}
                label="Compact"
              />
            </div>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/70 dark:bg-slate-950/40">
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
            </Section>

            <Section
              eyebrow="Store"
              title="Name and header on the receipt"
              description="These fields are shared with Settings → Invoice."
              action={
                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-bold text-gray-900 dark:text-gray-100"
                />
                <select
                  value={receiptConfig.headerTitle ?? 'TAX INVOICE'}
                  onChange={e => setReceiptConfig(prev => ({ ...prev, headerTitle: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-semibold text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs"
                    placeholder="Company name"
                  />
                  <input
                    type="text"
                    value={receiptConfig.gstin}
                    onChange={(e) => setReceiptConfig(prev => ({ ...prev, gstin: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs"
                    placeholder="GSTIN"
                  />
                </div>
                <input
                  type="text"
                  value={receiptConfig.address}
                  onChange={(e) => setReceiptConfig(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs"
                  placeholder="Address"
                />
                <input
                  type="text"
                  value={receiptConfig.phone}
                  onChange={(e) => setReceiptConfig(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs"
                  placeholder="Phone number"
                />
                <textarea
                  rows={2}
                  value={receiptConfig.footerMessage}
                  onChange={(e) => setReceiptConfig(prev => ({ ...prev, footerMessage: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs resize-none"
                  placeholder="Footer message"
                />
                <div className="space-y-2">
                  <input
                    type="text"
                    value={receiptConfig.termsLine1}
                    onChange={(e) => setReceiptConfig(prev => ({ ...prev, termsLine1: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs"
                    placeholder="Terms line 1"
                  />
                  <input
                    type="text"
                    value={receiptConfig.termsLine2}
                    onChange={(e) => setReceiptConfig(prev => ({ ...prev, termsLine2: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs"
                    placeholder="Terms line 2"
                  />
                  <input
                    type="text"
                    value={receiptConfig.termsLine3}
                    onChange={(e) => setReceiptConfig(prev => ({ ...prev, termsLine3: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs"
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

              {/* Store Logo Graphic Section */}
              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <ImageIcon size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">Store Logo Graphic</span>
                      <p className="text-[11px] text-gray-500">Print business logo image at the top of receipts & invoices</p>
                    </div>
                  </div>
                  <Switch
                    label="Enable Store Logo Graphic"
                    checked={config.showLogo}
                    onChange={v => {
                      setConfig(prev => ({ ...prev, showLogo: v }))
                      setReceiptConfig(prev => ({ ...prev, showLogo: v }))
                    }}
                    info={<FieldInfo textKey="tip.printer.showLogo" />}
                  />
                </div>
                {config.showLogo && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                    <ImageUpload
                      label="Store Logo Image (PNG / JPG / WebP)"
                      value={receiptConfig.logoURL || settings?.businessLogoURL || ''}
                      onChange={(url) => {
                        setReceiptConfig(prev => ({ ...prev, logoURL: url, showLogo: true }))
                        setConfig(prev => ({ ...prev, showLogo: true }))
                      }}
                      previewSize="md"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    />
                    <p className="text-[11px] text-gray-400">
                      Upload your high-contrast brand logo. It will appear at the top of all thermal and full-sheet invoices.
                    </p>
                  </div>
                )}
              </div>

              {/* Content & Information Toggles */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl px-4 bg-white dark:bg-gray-800">
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

              {/* Payment QR Code (UPI / QR Pay) Section */}
              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <QrCode size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">Payment QR Code (UPI / QR Pay)</span>
                      <p className="text-[11px] text-gray-500">Print UPI QR code image on bills for direct customer payments</p>
                    </div>
                  </div>
                  <Switch
                    label="Enable Payment QR Code on Bills"
                    checked={receiptConfig.showPaymentQR ?? false}
                    onChange={v => {
                      setReceiptConfig(prev => ({ ...prev, showPaymentQR: v }))
                      setConfig(prev => ({ ...prev, invoiceShowPaymentQR: v }))
                    }}
                  />
                </div>
                {receiptConfig.showPaymentQR && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1 block">
                        UPI ID for live QR (recommended)
                      </label>
                      <input
                        type="text"
                        value={receiptConfig.upiId || ''}
                        onChange={(e) => setReceiptConfig(prev => ({ ...prev, upiId: e.target.value.trim() }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs"
                        placeholder="yourname@okhdfcbank"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Generates a real QR encoding the exact bill amount, live at checkout and on every printed
                        receipt — this is your actual UPI ID, not a phone number.
                      </p>
                    </div>
                    <ImageUpload
                      label="Or upload a static Payment QR Code image (PNG / JPG)"
                      value={receiptConfig.paymentQrURL || ''}
                      onChange={(url) => setReceiptConfig(prev => ({ ...prev, paymentQrURL: url, showPaymentQR: true }))}
                      previewSize="md"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                    />
                    <p className="text-[11px] text-gray-400">
                      Used only as a fallback when no UPI ID is set above — a fixed image (e.g. a GPay/PhonePe QR
                      screenshot) that doesn't encode the bill amount.
                    </p>
                  </div>
                )}
              </div>
            </Section>
          </div>

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
            />
            </Section>
          </div>
        </div>
      )}

      {/* Tab 2: Label Designer */}
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
                            ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                            : 'bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <span className="block font-semibold">{opt.title}</span>
                        <span className={`block text-[11px] mt-0.5 ${active ? 'text-white/80' : 'text-gray-500'}`}>{opt.hint}</span>
                      </button>
                    )
                  })}
                </div>
              </Section>

              <Section
                eyebrow="Hardware"
                title="Which printer prints stickers?"
                description="Sticker printers need TSPL so each label stops at the gap. Receipt rolls use ESC/POS."
                action={
                  <button
                    type="button"
                    onClick={handleCalibrateGap}
                    title="Makes a sticker printer find the gap between labels"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  >
                    Calibrate sticker gap
                  </button>
                }
              >

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, labelPrinterMode: 'tspl' }))}
                    className={`text-left py-2.5 px-3 rounded-xl text-xs border transition-colors ${
                      (config.labelPrinterMode || 'tspl') === 'tspl'
                        ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <span className="block font-bold">Label printer (TSPL)</span>
                    <span className={`block mt-0.5 ${(config.labelPrinterMode || 'tspl') === 'tspl' ? 'text-white/80' : 'text-gray-500'}`}>
                      Sticker rolls — Xprinter, TSC, Gprinter
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, labelPrinterMode: 'escpos' }))}
                    className={`text-left py-2.5 px-3 rounded-xl text-xs border transition-colors ${
                      config.labelPrinterMode === 'escpos'
                        ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <span className="block font-bold">Receipt printer (ESC/POS)</span>
                    <span className={`block mt-0.5 ${config.labelPrinterMode === 'escpos' ? 'text-white/80' : 'text-gray-500'}`}>
                      Continuous thermal roll, not stickers
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="flex items-center text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Shift left / right (mm)
                      <FieldInfo textKey="tip.printer.labelOffset" />
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={config.labelOffsetX ?? 0}
                      onChange={(e) => setConfig(prev => ({ ...prev, labelOffsetX: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Shift up / down (mm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={config.labelOffsetY ?? 0}
                      onChange={(e) => setConfig(prev => ({ ...prev, labelOffsetY: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <label className="flex items-center text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Barcode nudge (mm)
                    <FieldInfo textKey="tip.printer.labelBarcodeOffset" />
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={config.labelBarcodeOffsetX ?? 4}
                    onChange={(e) => setConfig(prev => ({ ...prev, labelBarcodeOffsetX: Number(e.target.value) || 0 }))}
                    placeholder="4"
                    className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-xs font-semibold"
                  />
                  <span className="text-[10px] text-gray-500">If the barcode is off-center, increase to shift right or go negative to shift left.</span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="flex items-center text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                    Print upside down
                    <FieldInfo textKey="tip.printer.labelDirection" />
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={(config.labelDirection ?? 0) === 1}
                    onClick={() => setConfig(prev => ({ ...prev, labelDirection: (prev.labelDirection ?? 0) === 1 ? 0 : 1 }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                      (config.labelDirection ?? 0) === 1 ? 'bg-[#0a0a2e]' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        (config.labelDirection ?? 0) === 1 ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </Section>

              <Section
                eyebrow="Size"
                title="Sticker size and barcode"
                description="50 mm wide labels: 50×30, 25, 50, 75, and 100 mm tall."
              >
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                  {LABEL_SIZE_PRESETS.map(size => {
                    const active = config.labelWidth === size.width && config.labelHeight === size.height
                    return (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, labelWidth: size.width, labelHeight: size.height }))}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold transition-colors ${
                          active
                            ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {size.label}
                      </button>
                    )
                  })}
                </div>

              <div>
                <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  Barcode on the label
                  <FieldInfo textKey="tip.printer.labelBarcodeType" />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { type: 'CODE128' as const, label: 'CODE128', hint: 'Any SKU / barcode' },
                    { type: 'EAN13' as const, label: 'EAN-13', hint: '13-digit product code' },
                    { type: 'QR' as const, label: 'QR code', hint: 'Scan as a square' },
                  ]).map(opt => (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, labelBarcodeType: opt.type }))}
                      className={`py-2 px-2 rounded-xl border text-xs transition-colors ${
                        config.labelBarcodeType === opt.type
                          ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="block font-bold">{opt.label}</span>
                      <span className={`block text-[10px] mt-0.5 ${config.labelBarcodeType === opt.type ? 'text-white/80' : 'text-gray-500'}`}>{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  Preview With Product
                  <FieldInfo textKey="tip.printer.previewProduct" />
                </label>
                <select
                  value={previewProductId}
                  onChange={(e) => setPreviewProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-medium"
                >
                  <option value="">Sample data</option>
                  {products?.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              </Section>

              <Section
                eyebrow="Fields"
                title="Fields on the label"
                description="Add, reorder, and format each line that prints on the sticker."
                action={
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) addLabelElement(e.target.value as LabelElementType) }}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5"
                  >
                    <option value="">+ Add field…</option>
                    {(Object.keys(LABEL_ELEMENT_META) as LabelElementType[]).map(type => (
                      <option key={type} value={type}>{LABEL_ELEMENT_META[type].label}</option>
                    ))}
                  </select>
                }
              >

                {labelTemplate.length === 0 && (
                  <p className="text-xs text-gray-400 italic py-4 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    No elements yet — add one above.
                  </p>
                )}

                <div className="space-y-3">
                  {labelTemplate.map((el, idx) => (
                    <div key={el.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2 bg-gray-50/50 dark:bg-gray-800/40">
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-5 text-center flex-shrink-0">{LABEL_ELEMENT_META[el.type]?.icon || '📄'}</span>

                        {el.type === 'custom' ? (
                          <input
                            type="text"
                            value={el.text ?? ''}
                            onChange={(e) => updateLabelElement(el.id, { text: e.target.value })}
                            placeholder="Enter text..."
                            className="flex-1 min-w-0 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs"
                          />
                        ) : el.type === 'mrpHeader' ? (
                          <input
                            type="text"
                            value={el.prefix ?? 'MRP (Incl. of all taxes)'}
                            onChange={(e) => updateLabelElement(el.id, { prefix: e.target.value })}
                            placeholder="MRP Label text..."
                            className="flex-1 min-w-0 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs font-semibold"
                          />
                        ) : (
                          <span className="flex-1 min-w-0 text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                            {LABEL_ELEMENT_META[el.type]?.label || el.type}
                          </span>
                        )}

                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {(['left', 'center', 'right'] as const).map(a => {
                            const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
                            return (
                              <button
                                key={a}
                                type="button"
                                title={`Align ${a}`}
                                onClick={() => updateLabelElement(el.id, { align: a })}
                                className={`p-1 rounded ${el.align === a ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                              >
                                <Icon size={13} />
                              </button>
                            )
                          })}
                          {el.type !== 'barcode' && el.type !== 'qrCode' && el.type !== 'sideBySideBarcodeQr' && el.type !== 'divider' && (
                            <>
                              <button
                                type="button"
                                title="Toggle Bold"
                                onClick={() => updateLabelElement(el.id, { bold: !el.bold })}
                                className={`p-1 rounded ${el.bold ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                              >
                                <Bold size={13} />
                              </button>
                              <select
                                value={el.fontSize || (el.large ? 'large' : 'medium')}
                                onChange={(e) => updateLabelElement(el.id, { fontSize: e.target.value as any })}
                                className="text-[10px] font-bold px-1 py-0.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                              >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                                <option value="xlarge">X-Large</option>
                              </select>
                            </>
                          )}
                          <button type="button" onClick={() => moveLabelElement(el.id, -1)} disabled={idx === 0} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30">
                            <ArrowUp size={13} />
                          </button>
                          <button type="button" onClick={() => moveLabelElement(el.id, 1)} disabled={idx === labelTemplate.length - 1} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30">
                            <ArrowDown size={13} />
                          </button>
                          <button type="button" onClick={() => removeLabelElement(el.id)} className="p-1 rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Optional Prefix/Suffix for price, business, product, custom */}
                      {(el.type === 'price' || el.type === 'businessName' || el.type === 'productName' || el.type === 'sku' || el.type === 'custom') && (
                        <div className="flex gap-2 text-[10px] pt-1">
                          <input
                            type="text"
                            placeholder="Prefix (e.g. Rs. )"
                            value={el.prefix ?? ''}
                            onChange={(e) => updateLabelElement(el.id, { prefix: e.target.value })}
                            className="flex-1 px-2 py-0.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          />
                          <input
                            type="text"
                            placeholder="Suffix (e.g. /-)"
                            value={el.suffix ?? ''}
                            onChange={(e) => updateLabelElement(el.id, { suffix: e.target.value })}
                            className="flex-1 px-2 py-0.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
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
                  className="bg-white text-gray-900 rounded-lg shadow-xl border border-gray-300 transition-all duration-300 relative overflow-hidden"
                  style={{
                    width: `${Math.min(config.labelWidth * 4.5, 280)}px`,
                    height: `${Math.min(config.labelHeight * 4.5, 220)}px`,
                  }}
                >
                <div
                  className="absolute inset-0 p-3.5 flex flex-col justify-center gap-1"
                  style={{
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
                    return (
                      <div
                        key={el.id}
                        className={`${alignClass} truncate ${el.bold ? 'font-bold' : ''} ${fontClass}`}
                      >
                        {text}
                      </div>
                    )
                  })}
                </div>
                </div>
              </div>
              {!selectedProduct && (
                <p className="text-[11px] text-slate-500 mt-1 text-center">Pick a product above to preview with real data.</p>
              )}
              </Section>
          </div>
        </div>
      )}

      {/* Tab 3: A4 Full Invoice Settings & Live Preview */}
      {activeTab === 'invoice' && (
        <A4InvoiceTab
          config={config}
          setConfig={setConfig}
          receiptConfig={receiptConfig}
          setReceiptConfig={setReceiptConfig}
          settings={settings}
        />
      )}

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
