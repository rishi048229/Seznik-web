import { useState, useEffect, useMemo } from 'react'
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
import { compileReceiptTextLines } from '@/utils/receiptEngine'
import { getUpiQrImageUrl } from '@/utils/upiQr'
import type { Sale } from '@/types/sale.types'
import { formatINR } from '@/utils/currency'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Switch } from '@/components/ui/Switch'
import { FieldInfo } from '@/components/ui/FieldInfo'
import { SettingsPageSkeleton } from '@/components/ui/PageSkeleton'
import { trackUserAction } from '@/utils/analytics'
import toast from 'react-hot-toast'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { ImageUpload } from '@/components/forms/ImageUpload'
import {
  Printer,
  QrCode,
  FileText,
  Tag,
  Video,
  Save,
  Bluetooth,
  Monitor,
  Scissors,
  Layers,
  Unplug,
  ArrowUp,
  ArrowDown,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Lock,
  Sparkles,
  Zap,
  Check,
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
  const { data: settings, isLoading } = useSettings()
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

    const fullPayload = {
      businessName: settings?.businessName ?? user.displayName ?? '',
      businessAddress: settings?.businessAddress ?? '',
      businessPhone: settings?.businessPhone ?? '',
      businessGSTIN: settings?.businessGSTIN ?? '',
      businessLogoURL: receiptConfig.logoURL || settings?.businessLogoURL || '',
      personalInfo: settings?.personalInfo ?? { ownerName: '', ownerPhone: '', ownerAddress: '' },
      invoiceConfig: settings?.invoiceConfig ?? { prefix: 'INV', footerText: '' },
      notificationConfig: settings?.notificationConfig ?? { lowStockThreshold: 10, overdueDays: 30 },
      receiptConfig,
      printerConfig: config,
    }

    if (settings?.id) {
      updateSettingsMutation(
        { settingsId: settings.id, data: fullPayload },
        {
          onSuccess: () => {
            trackUserAction('feature_printer_settings_saved', { mode: config.connectionType })
            toast.success('Printer settings saved!')
          },
          onError: (err) => {
            console.error('Save printer config error:', err)
            toast.error('Failed to save printer settings')
          },
        }
      )
    } else {
      createSettingsMutation(fullPayload as Omit<UserSettings, 'id'>, {
        onSuccess: () => {
          trackUserAction('feature_printer_settings_saved', { mode: config.connectionType })
          toast.success('Printer settings saved!')
        },
        onError: (err) => {
          console.error('Create settings error:', err)
          toast.error('Failed to save printer settings')
        },
      })
    }
  }

  // Keep the connection-type setting truthful: whenever the real BLE link
  // comes up or drops (including the printer being switched off, which fires
  // 'gattserverdisconnected' with no button click involved), reflect that in
  // config rather than leaving it pointed at a printer that's no longer there.
  useEffect(() => {
    if (bleState.status === 'connected') {
      setConfig(prev => (prev.connectionType === 'bluetooth' ? prev : { ...prev, connectionType: 'bluetooth' }))
    } else if (bleState.status === 'disconnected') {
      setConfig(prev => (prev.connectionType === 'bluetooth' ? { ...prev, connectionType: 'system_driver' } : prev))
    }
  }, [bleState.status])

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
      if ((err as Error).name !== 'NotFoundError') {
        toast.error((err as Error).message || 'Bluetooth connection failed')
      }
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
    if (config.connectionType === 'bluetooth' && bleState.status === 'connected') {
      try {
        const bytes = generateGapCalibrationBytes()
        await printEscPos(bytes)
        toast.success('Sent Gap Auto-Calibration command to printer!')
      } catch {
        toast.error('Failed to send gap calibration command')
      }

    } else {
      toast.error('Please connect your Bluetooth printer first to calibrate gap')
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

      if (config.connectionType === 'bluetooth' && bleState.status === 'connected') {
        try {
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
          toast.error('BLE print error. Falling back to browser print.')
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
      if (config.connectionType === 'bluetooth' && bleState.status === 'connected') {
        try {
          const bytes = mode === 'tspl'
            ? generateLabelTspl(
                config.labelTemplate,
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
            : generateLabelEscPos(config.labelTemplate, config.labelBarcodeType, labelData)
          await printEscPos(bytes)
          toast.success(`Label sent to printer in ${mode.toUpperCase()} mode!`)
          return
        } catch (err) {
          console.error('BLE Print error:', err)
          toast.error('BLE print error. Falling back to browser print.')
        }
      }

      // Browser label fallback
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
    const testInvoiceSale: Sale = {
      id: 'test_invoice',
      invoiceNumber: 'INV-2026-0089',
      items: [
        { productId: 'p1', productName: 'Seznik POS Terminal Machine', quantity: 1, sellingPrice: 25000.00, discount: 0, taxRate: 18, taxAmount: 4500.00, total: 29500.00 },
        { productId: 'p2', productName: 'Thermal Paper Roll 80mm (Pack of 10)', quantity: 5, sellingPrice: 450.00, discount: 0, taxRate: 18, taxAmount: 405.00, total: 2655.00 },
      ],
      subtotal: 27250.00,
      totalDiscount: 0,
      totalTax: 4905.00,
      grandTotal: 32155.00,
      paymentMethod: 'cash',
      amountPaid: 32155.00,
      changeReturned: 0,
      isQuickBill: false,
      createdAt: new Date().toISOString(),
    }
    const invoiceHTML = generateReceiptHTML({
      sale: testInvoiceSale,
      receiptConfig: effectiveReceiptConfig,
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      customerName: 'Sample Corporate Client',
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
    <div className="space-y-5 pb-12 w-full max-w-full overflow-hidden">
      {/* Top Header & Quick Actions */}
      <div data-tour="printers-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
            <Printer size={22} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">Printers</h1>
              <button
                onClick={pageTutorial.openTutorial}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm shrink-0"
              >
                <Video size={14} className="animate-pulse" />
                <span>Video Guide</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Receipts, labels, and invoices — all from one place.</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            data-tour="printer-test-btn"
            variant="outline"
            onClick={handleTestPrint}
            className="flex items-center gap-2 border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs sm:text-sm"
          >
            <Printer size={16} />
            {activeTab === 'label' ? 'Print Label' : `Test Print`}
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            className="bg-[#0a0a2e] hover:bg-[#1e1b6e] text-white flex items-center gap-2 shadow-lg shadow-[#0a0a2e]/20 text-xs sm:text-sm"
          >
            <Save size={16} />
            Save
          </Button>
        </div>
      </div>

      {/* Printer connection status — two real, honest cards */}
      <div data-tour="printers-status" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`p-4 rounded-2xl border transition-all ${
            bleState.status === 'connected'
              ? 'bg-gradient-to-b from-purple-50/80 to-indigo-50/40 border-purple-500 dark:from-purple-900/30 dark:to-indigo-900/20'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-lg">
                <Bluetooth size={18} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate max-w-[200px]">
                  {bleState.status === 'connected' ? (bleState.deviceName || 'Bluetooth Printer') : 'Bluetooth Printer'}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {bleState.status === 'connected' ? 'Connected' : bleState.status === 'connecting' ? 'Connecting…' : 'Not connected'}
                </p>
              </div>
            </div>
            {bleState.status === 'connected' ? (
              <button onClick={handleDisconnectBluetooth} className="text-red-600 hover:underline text-xs font-semibold flex items-center gap-1">
                <Unplug size={12} /> Disconnect
              </button>
            ) : (
              <button
                data-tour="printer-connect-btn"
                onClick={handleConnectBluetooth}
                disabled={connectingBle || !isBluetoothSupported()}
                className="text-purple-600 hover:underline text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                <Bluetooth size={12} /> {connectingBle ? 'Pairing…' : 'Connect'}
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 pl-11">
            Supports Seznik Veer, the Caysn label printer, and other compatible BLE thermal/label printers.
          </p>
        </div>

        <div className="p-4 rounded-2xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 rounded-lg">
              <Monitor size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Browser / System Print</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Always available — used for A4 invoices and as a fallback.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation Header */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {([
          { key: 'receipt', label: 'Receipt', icon: FileText },
          { key: 'label', label: 'Labels', icon: Tag },
          { key: 'invoice', label: 'A4 Invoice', icon: Layers },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 whitespace-nowrap transition-all ${
              activeTab === t.key
                ? 'border-[#0a0a2e] text-[#0a0a2e] dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Thermal Receipt Settings & Live Preview */}
      {activeTab === 'receipt' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          <div className="w-full lg:w-7/12 space-y-5 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
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
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        config.paperSize === size
                          ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 rounded-lg p-2 flex items-start gap-1.5 leading-relaxed">
                  <Sparkles size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <span><strong>Note:</strong> For best print quality, use <strong>58mm</strong> for 2-inch printers.</span>
                </p>
              </div>

              <div>
                <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  Print Destination
                  <FieldInfo textKey="tip.printer.printDestination" />
                </label>
                <select
                  value={config.connectionType}
                  onChange={(e) => setConfig(prev => ({ ...prev, connectionType: e.target.value as 'bluetooth' | 'system_driver' }))}
                  disabled={bleState.status !== 'connected'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-medium text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  <option value="bluetooth">Bluetooth Printer</option>
                  <option value="system_driver">Browser Print Dialog</option>
                </select>
              </div>
            </div>

            {/* Ultra-Compact Paper Saver Mode Banner */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-900/10 via-teal-900/10 to-blue-900/10 dark:from-emerald-900/30 dark:via-teal-900/30 dark:to-blue-900/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>⚡ Compact Paper Saver Mode (Reduces 1-product & batch receipts by 50-70% height)</span>
              </div>
              <Switch
                checked={receiptConfig.compactMode ?? false}
                onChange={v => setReceiptConfig(prev => ({ ...prev, compactMode: v }))}
                label="Compact Mode"
              />
            </div>

            {/* Custom Header Title Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Receipt Header Title
              </label>
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
            </div>

            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Invoice & Receipt Details
                  <FieldInfo textKey="tip.printer.receiptDetails" />
                </label>
                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                  Synced with Settings → Invoice
                </span>
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
            </div>

            {/* Fully Customizable Section Include / Exclude Checkboxes */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  Customizable Receipt Sections (Include / Exclude)
                </span>
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
                    className="text-purple-600 dark:text-purple-400 hover:underline font-bold"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
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
                    className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                  >
                    Ultra-Compact Paper Saver Preset
                  </button>
                </div>
              </div>

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

              {/* Hardware Actions */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl px-4 bg-white dark:bg-gray-800">
                <Switch checked={config.autoPrintOnSale} onChange={v => setConfig(prev => ({ ...prev, autoPrintOnSale: v }))} label="Auto-print on checkout" info={<FieldInfo textKey="tip.printer.autoPrintOnSale" />} />
                <Switch checked={config.cutPaper} onChange={v => setConfig(prev => ({ ...prev, cutPaper: v }))} label="Auto cut paper" info={<FieldInfo textKey="tip.printer.cutPaper" />} />
                <Switch checked={config.openCashDrawer} onChange={v => setConfig(prev => ({ ...prev, openCashDrawer: v }))} label="Open cash drawer" info={<FieldInfo textKey="tip.printer.openCashDrawer" />} />
              </div>
            </div>
          </div>

          {/* Live Preview Panel — 100% Reactive to all Section Toggles */}
          <div className="w-full lg:w-5/12 flex flex-col items-center lg:sticky lg:top-6 min-w-0 max-w-full overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Live Preview — {config.paperSize}</span>
              {receiptConfig.compactMode && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  ⚡ Compact Mode
                </span>
              )}
            </div>

            {/* Scrollable Receipt Preview Container */}
            <div className="w-full max-w-[400px] flex flex-col items-center max-h-[calc(100vh-140px)] overflow-y-auto no-scrollbar p-1 pb-4 max-w-full">
              <div
                className={`bg-white text-gray-900 p-4 rounded-t-xl shadow-xl border-t-8 border-blue-600 font-mono transition-all duration-300 max-w-full overflow-hidden ${
                  config.paperSize === '58mm' ? 'w-[280px]' : 'w-[360px]'
                }`}
                style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}
              >
                {/* Live Store Logo Preview */}
                {config.showLogo && (receiptConfig.logoURL || settings?.businessLogoURL) && (
                  <div className="flex justify-center mb-3 pb-2 border-b border-dashed border-gray-300">
                    <img
                      src={receiptConfig.logoURL || settings?.businessLogoURL}
                      alt="Store Logo"
                      className="max-h-12 max-w-[160px] object-contain"
                    />
                  </div>
                )}

                <pre className="whitespace-pre font-mono text-[11px] leading-[1.3] text-gray-900 overflow-x-auto no-scrollbar">
                  {compileReceiptTextLines({
                    sale: {
                      id: 'preview-1',
                      invoiceNumber: 'INV/2026/00142',
                      items: [
                        { productId: 'p1', productName: 'Wireless Keyboard', quantity: 1, sellingPrice: 1499, discount: 0, taxRate: 18, taxAmount: 228.66, total: 1499 },
                        { productId: 'p2', productName: 'Optical Mouse Pro', quantity: 2, sellingPrice: 600, discount: 0, taxRate: 18, taxAmount: 183.05, total: 1200 },
                        { productId: 'p3', productName: 'Fresh Milk 1L', quantity: 2, sellingPrice: 30, discount: 0, taxRate: 0, taxAmount: 0, total: 60 },
                      ],
                      subtotal: 2759,
                      totalDiscount: 0,
                      totalTax: 411.71,
                      grandTotal: 2759,
                      paymentMethod: 'cash',
                      amountPaid: 2759,
                      changeReturned: 0,
                      isQuickBill: false,
                      createdAt: new Date().toISOString(),
                    },
                    receiptConfig,
                    businessName: settings?.businessName || 'SEZNIK POS STORE',
                    businessAddress: receiptConfig.address || settings?.businessAddress || '123 MG Road, Kothrud',
                    businessPhone: receiptConfig.phone || '9876543210',
                    businessGSTIN: receiptConfig.gstin || '27AAAAA0000A1Z5',
                    customerName: 'Rahul Sharma',
                    paperSize: config.paperSize === '80mm' ? '80mm' : '58mm',
                  }).join('\n')}
                </pre>

                {/* Live Payment QR Code Preview */}
                {receiptConfig.showPaymentQR && (receiptConfig.upiId || receiptConfig.paymentQrURL) && (
                  <div className="mt-3 pt-3 border-t border-dashed border-gray-300 text-center flex flex-col items-center">
                    <span className="text-[10px] font-bold tracking-wider text-gray-800 mb-1">SCAN TO PAY ₹2,759.00 (UPI / QR)</span>
                    <img
                      src={receiptConfig.upiId ? getUpiQrImageUrl({ upiId: receiptConfig.upiId, payeeName: settings?.businessName || 'SEZNIK POS STORE', amount: 2759, note: 'INV/2026/00142' }, 140) : receiptConfig.paymentQrURL}
                      alt="Payment QR Code"
                      className="w-28 h-28 object-contain border border-gray-200 rounded p-1 bg-white"
                    />
                  </div>
                )}
              </div>
              <div
                className={`h-3 bg-white dark:bg-gray-800 ${config.paperSize === '58mm' ? 'w-[280px]' : 'w-[360px]'} max-w-full rounded-b-sm`}
                style={{ backgroundImage: 'radial-gradient(circle, transparent, transparent 50%, #f1f5f9 50%, #f1f5f9 100%)', backgroundSize: '12px 12px' }}
              />
              {config.cutPaper && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold mt-2.5">
                  <Scissors size={12} /> Auto paper cutter enabled
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Label Designer */}
      {activeTab === 'label' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
            {/* Controls */}
            <div className="w-full lg:w-7/12 space-y-5 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              {/* Preset Templates */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <label className="flex items-center text-xs font-bold text-slate-800 dark:text-slate-200">
                  Quick Layout Presets
                  <FieldInfo textKey="tip.printer.labelPresets" />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, labelTemplate: PRESET_RETAIL_DUAL_CODE }))}
                    className="py-1.5 px-2 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold transition-all"
                  >
                    Image 1 Dual-Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, labelTemplate: PRESET_CENTERED_STANDARD }))}
                    className="py-1.5 px-2 bg-white dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-all"
                  >
                    Centered Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, labelTemplate: PRESET_MINIMAL_TAG }))}
                    className="py-1.5 px-2 bg-white dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-all"
                  >
                    Minimal Tag
                  </button>
                </div>
              </div>

              {/* Hardware Alignment & Gap Calibration Box */}
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="flex items-center text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      Label Command Protocol & Calibration
                      <FieldInfo textKey="tip.printer.labelMode" />
                    </h4>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      Select <strong>TSPL Mode</strong> for label printers (Xprinter/TSC/Gprinter) to lock print inside 1 sticker gap.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCalibrateGap}
                    title="Sends a command that makes the printer auto-detect the gap between stickers"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex-shrink-0"
                  >
                    Calibrate Paper Gap
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, labelPrinterMode: 'tspl' }))}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                      (config.labelPrinterMode || 'tspl') === 'tspl'
                        ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    TSPL Mode (Gap Sensing)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, labelPrinterMode: 'escpos' }))}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                      config.labelPrinterMode === 'escpos'
                        ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    ESC/POS Compact Mode
                  </button>
                </div>

                {/* Printer Calibration Offsets */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-indigo-200/60 dark:border-indigo-800/40">
                  <div>
                    <label className="flex items-center text-[11px] font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                      Printer Offset X (mm)
                      <FieldInfo textKey="tip.printer.labelOffset" />
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={config.labelOffsetX ?? 0}
                      onChange={(e) => setConfig(prev => ({ ...prev, labelOffsetX: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-800 text-xs font-semibold"
                    />
                    <span className="text-[10px] text-gray-500">Shift left/right on paper</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                      Printer Offset Y (mm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={config.labelOffsetY ?? 0}
                      onChange={(e) => setConfig(prev => ({ ...prev, labelOffsetY: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-800 text-xs font-semibold"
                    />
                    <span className="text-[10px] text-gray-500">Shift up/down on paper</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/40">
                  <label className="flex items-center text-[11px] font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                    Barcode Center Nudge (mm)
                    <FieldInfo textKey="tip.printer.labelBarcodeOffset" />
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={config.labelBarcodeOffsetX ?? 4}
                    onChange={(e) => setConfig(prev => ({ ...prev, labelBarcodeOffsetX: Number(e.target.value) || 0 }))}
                    placeholder="4"
                    className="w-full px-2.5 py-1.5 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-gray-800 text-xs font-semibold"
                  />
                  <span className="text-[10px] text-gray-500">If the barcode prints off-center, increase (shift right) or decrease/go negative (shift left) until it's centered</span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-indigo-200/60 dark:border-indigo-800/40">
                  <span className="flex items-center text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                    Label Upside Down? Flip 180°
                    <FieldInfo textKey="tip.printer.labelDirection" />
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={(config.labelDirection ?? 0) === 1}
                    onClick={() => setConfig(prev => ({ ...prev, labelDirection: (prev.labelDirection ?? 0) === 1 ? 0 : 1 }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                      (config.labelDirection ?? 0) === 1 ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        (config.labelDirection ?? 0) === 1 ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                    Width (mm)
                    <FieldInfo textKey="tip.printer.labelSize" />
                  </label>
                  <input
                    type="number"
                    value={config.labelWidth}
                    onChange={(e) => setConfig(prev => ({ ...prev, labelWidth: Number(e.target.value) || 50 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Height (mm)</label>
                  <input
                    type="number"
                    value={config.labelHeight}
                    onChange={(e) => setConfig(prev => ({ ...prev, labelHeight: Number(e.target.value) || 30 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  Default Barcode Type
                  <FieldInfo textKey="tip.printer.labelBarcodeType" />
                </label>
                <div className="flex gap-2">
                  {(['CODE128', 'EAN13', 'QR'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, labelBarcodeType: type }))}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        config.labelBarcodeType === type
                          ? 'bg-[#0a0a2e] text-white border-[#0a0a2e]'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {type}
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Label Contents & Formatting
                    <FieldInfo textKey="tip.printer.addElement" />
                  </label>
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) addLabelElement(e.target.value as LabelElementType) }}
                    className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg px-2 py-1"
                  >
                    <option value="">+ Add element…</option>
                    {(Object.keys(LABEL_ELEMENT_META) as LabelElementType[]).map(type => (
                      <option key={type} value={type}>{LABEL_ELEMENT_META[type].label}</option>
                    ))}
                  </select>
                </div>

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
              </div>
            </div>

            {/* Live Preview */}
            <div className="w-full lg:w-5/12 flex flex-col items-center lg:sticky lg:top-6 min-w-0 max-w-full overflow-hidden">
              <span className="text-xs font-semibold text-gray-400 mb-3">
                Live Preview — {config.labelWidth}mm × {config.labelHeight}mm
              </span>
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
                <p className="text-[11px] text-gray-400 mt-3 text-center">Pick a product above to preview with real data.</p>
              )}
          </div>
        </div>
      )}

      {/* Tab 3: A4 Full Invoice Settings & Live Preview */}
      {activeTab === 'invoice' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          <div className="w-full lg:w-7/12 space-y-5 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  Document Size
                  <FieldInfo textKey="tip.printer.invoiceSize" />
                </label>
                <select
                  value={config.invoicePaperSize}
                  onChange={(e) => setConfig(prev => ({ ...prev, invoicePaperSize: e.target.value as PrinterConfig['invoicePaperSize'] }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-medium"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">US Letter</option>
                </select>
              </div>

              <div>
                <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  Color Theme
                  <FieldInfo textKey="tip.printer.invoiceTheme" />
                </label>
                <select
                  value={config.invoiceColorTheme}
                  onChange={(e) => setConfig(prev => ({ ...prev, invoiceColorTheme: e.target.value as PrinterConfig['invoiceColorTheme'] }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-medium"
                >
                  <option value="navy">Deep Navy</option>
                  <option value="emerald">Emerald</option>
                  <option value="slate">Slate</option>
                  <option value="royal">Royal Blue</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                Terms & Conditions
                <FieldInfo textKey="tip.printer.invoiceTerms" />
              </label>
              <textarea
                rows={3}
                value={config.invoiceTermsText}
                onChange={(e) => setConfig(prev => ({ ...prev, invoiceTermsText: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-mono"
              />
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl px-4">
              <Switch checked={config.invoiceShowHeader} onChange={v => setConfig(prev => ({ ...prev, invoiceShowHeader: v }))} label="Header banner" info={<FieldInfo textKey="tip.printer.invoiceShowHeader" />} />
              <Switch checked={config.invoiceShowTerms} onChange={v => setConfig(prev => ({ ...prev, invoiceShowTerms: v }))} label="Print terms & conditions" info={<FieldInfo textKey="tip.printer.invoiceShowTerms" />} />
              <Switch checked={config.invoiceShowPaymentQR} onChange={v => setConfig(prev => ({ ...prev, invoiceShowPaymentQR: v }))} label="UPI payment QR code" info={<FieldInfo textKey="tip.printer.invoiceShowPaymentQR" />} />
            </div>
          </div>

          <div className="w-full lg:w-5/12 flex flex-col items-center lg:sticky lg:top-6 min-w-0 max-w-full overflow-hidden">
            <span className="text-xs font-semibold text-gray-400 mb-3">Live Preview</span>
            <div className="w-full max-w-[320px] bg-white text-gray-900 p-5 sm:p-6 rounded-xl shadow-2xl border border-gray-200 text-xs min-h-[420px] flex flex-col justify-between overflow-hidden">
              <div>
                <div className="flex justify-between items-start pb-4 border-b-2" style={{ borderColor: config.invoiceColorTheme === 'emerald' ? '#059669' : config.invoiceColorTheme === 'royal' ? '#2563eb' : '#0a0a2e' }}>
                  <div>
                    <h4 className="font-extrabold text-sm" style={{ color: config.invoiceColorTheme === 'emerald' ? '#059669' : config.invoiceColorTheme === 'royal' ? '#2563eb' : '#0a0a2e' }}>
                      {receiptConfig.companyName || settings?.businessName || 'SEZNIK ENTERPRISES'}
                    </h4>
                    <p className="text-[10px] text-gray-500">GSTIN: {receiptConfig.gstin || '27AAAAA0000A1Z5'}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-xs block">TAX INVOICE</span>
                    <span className="text-[9px] text-gray-500">INV-2026-0089</span>
                  </div>
                </div>

                <table className="w-full mt-4 text-[10px] text-left border-collapse">
                  <thead>
                    <tr style={{ background: config.invoiceColorTheme === 'emerald' ? '#059669' : config.invoiceColorTheme === 'royal' ? '#2563eb' : '#0a0a2e', color: '#fff' }}>
                      <th className="p-1">Description</th>
                      <th className="p-1 text-center">Qty</th>
                      <th className="p-1 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="p-1 font-medium">Smart POS Terminal</td>
                      <td className="p-1 text-center">1</td>
                      <td className="p-1 text-right">₹24,999</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="p-1 font-medium">Barcode Scanner 2D</td>
                      <td className="p-1 text-center">2</td>
                      <td className="p-1 text-right">₹3,800</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-end">
                  {config.invoiceShowPaymentQR ? (
                    <div className="flex items-center gap-2">
                      <QrCode size={28} className="text-slate-800" />
                      <span className="text-[9px] font-semibold text-gray-600">Scan & Pay via UPI</span>
                    </div>
                  ) : <div />}
                  <div className="text-right font-bold text-xs">Total: ₹28,799.00</div>
                </div>
                {config.invoiceShowTerms && (
                  <p className="text-[8px] text-gray-400 mt-3 whitespace-pre-line border-t pt-2">
                    {config.invoiceTermsText}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
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
