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
import { generateLabelEscPos, generateLabelTspl, generateGapCalibrationBytes, defaultLabelTemplate, type LabelData } from '@/utils/labelPrint'
import { generateReceiptEscPos } from '@/utils/receipt'
import type { Sale } from '@/types/sale.types'
import { formatINR } from '@/utils/currency'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Switch } from '@/components/ui/Switch'
import toast from 'react-hot-toast'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
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

  paperSize: '80mm',
  showLogo: true,
  showGSTIN: true,
  showCustomerDetails: true,
  showBarcode: true,
  fontSize: 'medium',

  labelWidth: 50,
  labelHeight: 30,
  labelBarcodeType: 'CODE128',
  labelDensity: 10,
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
  companyName: '',
  address: '',
  phone: '',
  gstin: '',
  logoURL: '',
  footerMessage: 'Thank you for your purchase!',
  termsLine1: '1. Goods once sold will not be taken back or exchanged',
  termsLine2: '2. All disputes are subject to local jurisdiction only',
  termsLine3: '',
}

const LABEL_ELEMENT_META: Record<LabelElementType, { label: string; icon: string }> = {
  businessName: { label: 'Business Name', icon: '🏬' },
  productName: { label: 'Product Name', icon: '📦' },
  price: { label: 'Price', icon: '💰' },
  barcode: { label: 'Barcode / QR', icon: '▥' },
  custom: { label: 'Custom Text', icon: '✎' },
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

    setReceiptConfig({ ...defaultReceiptConfig, ...settings.receiptConfig })
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
      businessLogoURL: settings?.businessLogoURL ?? '',
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
          onSuccess: () => toast.success('Printer settings saved!'),
          onError: (err) => {
            console.error('Save printer config error:', err)
            toast.error('Failed to save printer settings')
          },
        }
      )
    } else {
      createSettingsMutation(fullPayload as Omit<UserSettings, 'id'>, {
        onSuccess: () => toast.success('Printer settings saved!'),
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
    if (config.connectionType === 'bluetooth' && bleState.status === 'connected') {
      try {
        if (activeTab === 'receipt') {
          const testSale: Sale = {
            id: 'test_sale',
            invoiceNumber: 'INV-TEST01',
            items: [
              { productId: 'p1', productName: 'Sample Wireless Mouse', quantity: 1, sellingPrice: 750.00, discount: 0, taxRate: 18, taxAmount: 135.00, total: 885.00 }
            ],
            subtotal: 750.00,
            totalDiscount: 0,
            totalTax: 135.00,
            grandTotal: 885.00,
            paymentMethod: 'cash',
            amountPaid: 1000.00,
            changeReturned: 115.00,
            isQuickBill: false,
            createdAt: new Date().toISOString(),

          }
          const bytes = generateReceiptEscPos({
            sale: testSale,
            receiptConfig,
            paperSize: config.paperSize,
            businessName: settings?.businessName,
            businessAddress: settings?.businessAddress,
          })
          await printEscPos(bytes)
          toast.success('Test receipt sent to Bluetooth printer!')
          return
        }
        if (activeTab === 'label') {
          const mode = config.labelPrinterMode || 'tspl'
          const bytes = mode === 'tspl'
            ? generateLabelTspl(config.labelTemplate, config.labelBarcodeType, labelData, config.labelWidth, config.labelHeight)
            : generateLabelEscPos(config.labelTemplate, config.labelBarcodeType, labelData)
          await printEscPos(bytes)
          toast.success(`Label sent to printer in ${mode.toUpperCase()} mode!`)
          return
        }
        // Invoice tab falls through to the browser dialog below — no thermal
        // printer can render an A4 sheet.
      } catch (err) {
        console.error('BLE Print error:', err)
        toast.error('BLE print error. Falling back to browser print.')
      }
    }

    // Fallback: Browser Print Dialog
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to test printing')
      return
    }

    let htmlContent = ''
    if (activeTab === 'receipt') {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Receipt Print</title>
          <style>
            body { font-family: monospace; width: ${config.paperSize === '58mm' ? '58mm' : '80mm'}; margin: 0 auto; padding: 10px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 16px;">${receiptConfig.companyName || settings?.businessName || 'SEZNIK POS STORE'}</div>
          ${config.showGSTIN && receiptConfig.gstin ? `<div class="center">GSTIN: ${receiptConfig.gstin}</div>` : ''}
          <div class="line"></div>
          <div class="row"><span>Inv #: TEST-001</span><span>Date: ${new Date().toLocaleDateString()}</span></div>
          ${config.showCustomerDetails ? `<div class="row"><span>Customer: John Doe</span><span>Phone: 9876543210</span></div>` : ''}
          <div class="line"></div>
          <div class="row bold"><span>Item</span><span>Qty</span><span>Amt</span></div>
          <div class="row"><span>Wireless Mouse</span><span>1</span><span>₹750.00</span></div>
          <div class="row"><span>USB-C Hub</span><span>2</span><span>₹1,800.00</span></div>
          <div class="line"></div>
          <div class="row bold"><span>Grand Total</span><span>₹2,550.00</span></div>
          <div class="line"></div>
          <div class="center">${receiptConfig.footerMessage}</div>
          ${config.showBarcode ? `<div class="center" style="margin-top:10px; font-weight:bold;">||||||||||||||||||||||||||</div><div class="center" style="font-size:10px;">TEST-001</div>` : ''}
        </body>
        </html>
      `
    } else if (activeTab === 'label') {
      htmlContent = renderLabelHtml()
    } else {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test A4 Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0a0a2e; padding-bottom: 20px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th, .table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            .table th { background: #0a0a2e; color: #fff; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="color:#0a0a2e; margin:0;">${receiptConfig.companyName || settings?.businessName || 'SEZNIK ENTERPRISES'}</h1>
              <p style="margin:5px 0;">Retail & Wholesale Inventory Solutions</p>
            </div>
            <div style="text-align:right;">
              <h2>INVOICE</h2>
              <p>Invoice #: INV-2026-0089</p>
              <p>Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
          <table class="table">
            <thead>
              <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th>Total</th></tr>
            </thead>
            <tbody>
              <tr><td>Seznik POS Terminal Machine</td><td>1</td><td>₹25,000.00</td><td>18%</td><td>₹29,500.00</td></tr>
              <tr><td>Thermal Paper Roll 80mm (Pack of 10)</td><td>5</td><td>₹450.00</td><td>18%</td><td>₹2,655.00</td></tr>
            </tbody>
          </table>
          <h3 style="text-align:right; margin-top:20px;">Grand Total: ₹32,155.00</h3>
        </body>
        </html>
      `
    }

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
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
          { key: 'receipt', label: 'Receipt', icon: FileText, isLocked: false },
          { key: 'label', label: 'Labels', icon: Tag, isLocked: true },
          { key: 'invoice', label: 'A4 Invoice', icon: Layers, isLocked: false },
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
            {t.isLocked && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-extrabold flex items-center gap-0.5">
                <Lock size={10} /> Soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: Thermal Receipt Settings & Live Preview */}
      {activeTab === 'receipt' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          <div className="w-full lg:w-7/12 space-y-5 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Paper Width</label>
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
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Print Destination</label>
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

            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Invoice & Receipt Details</label>
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

            <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl px-4">
              <Switch checked={config.showLogo} onChange={v => setConfig(prev => ({ ...prev, showLogo: v }))} label="Store logo" />
              <Switch checked={config.showGSTIN} onChange={v => setConfig(prev => ({ ...prev, showGSTIN: v }))} label="GSTIN / Tax number" />
              <Switch checked={config.showCustomerDetails} onChange={v => setConfig(prev => ({ ...prev, showCustomerDetails: v }))} label="Customer details" />
              <Switch checked={config.showBarcode} onChange={v => setConfig(prev => ({ ...prev, showBarcode: v }))} label="Invoice barcode" />
              <Switch checked={config.autoPrintOnSale} onChange={v => setConfig(prev => ({ ...prev, autoPrintOnSale: v }))} label="Auto-print on checkout" />
              <Switch checked={config.cutPaper} onChange={v => setConfig(prev => ({ ...prev, cutPaper: v }))} label="Auto cut paper" />
              <Switch checked={config.openCashDrawer} onChange={v => setConfig(prev => ({ ...prev, openCashDrawer: v }))} label="Open cash drawer" />
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="w-full lg:w-5/12 flex flex-col items-center sticky top-6">
            <span className="text-xs font-semibold text-gray-400 mb-3">Live Preview — {config.paperSize}</span>
            <div
              className={`bg-white text-gray-900 p-6 rounded-t-xl shadow-2xl border-t-8 border-blue-600 font-mono text-xs transition-all duration-300 ${
                config.paperSize === '58mm' ? 'w-[240px]' : 'w-[300px]'
              }`}
              style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
            >
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-gray-400">
                {config.showLogo && (
                  <div className="w-10 h-10 bg-indigo-950 text-white rounded-lg flex items-center justify-center font-extrabold mx-auto mb-1">
                    S
                  </div>
                )}
                <h4 className="font-extrabold text-sm uppercase tracking-tight text-slate-900">
                  {receiptConfig.companyName || settings?.businessName || 'SEZNIK POS STORE'}
                </h4>
                {receiptConfig.address && <p className="text-[10px] text-gray-600">{receiptConfig.address}</p>}
                {config.showGSTIN && (
                  <p className="text-[10px] font-semibold text-gray-700">
                    GSTIN: {receiptConfig.gstin || '27AAAAA0000A1Z5'}
                  </p>
                )}
              </div>

              <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>Inv: #INV-2026-9042</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                {config.showCustomerDetails && (
                  <div className="flex justify-between text-gray-600">
                    <span>Cust: Rahul Sharma</span>
                    <span>Ph: +91 98765 43210</span>
                  </div>
                )}
              </div>

              <div className="py-3 border-b border-dashed border-gray-400">
                <div className="flex justify-between font-bold pb-1 text-[11px]">
                  <span>Item</span>
                  <div className="space-x-3">
                    <span>Qty</span>
                    <span>Amt</span>
                  </div>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="truncate max-w-[110px]">Wireless Keyboard</span>
                    <div className="space-x-3">
                      <span>1</span>
                      <span>₹1,499</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="truncate max-w-[110px]">Optical Mouse Pro</span>
                    <div className="space-x-3">
                      <span>2</span>
                      <span>₹1,200</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹2,699.00</span>
                </div>
                <div className="flex justify-between text-gray-600 text-[10px]">
                  <span>GST (18%)</span>
                  <span>₹485.82</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-gray-300">
                  <span>GRAND TOTAL</span>
                  <span>₹3,184.82</span>
                </div>
              </div>

              <div className="pt-3 text-center space-y-2">
                <p className="text-[10px] text-gray-600 italic">{receiptConfig.footerMessage}</p>
                {config.showBarcode && (
                  <div className="pt-1">
                    <div className="font-extrabold tracking-widest text-sm text-gray-800">||||| | |||| |||| |||||</div>
                    <span className="text-[9px] font-mono text-gray-500">INV-2026-9042</span>
                  </div>
                )}
              </div>
            </div>
            <div
              className={`h-3 bg-white dark:bg-gray-800 ${config.paperSize === '58mm' ? 'w-[240px]' : 'w-[300px]'}`}
              style={{ backgroundImage: 'radial-gradient(circle, transparent, transparent 50%, #f1f5f9 50%, #f1f5f9 100%)', backgroundSize: '12px 12px' }}
            />
            {config.cutPaper && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold mt-2">
                <Scissors size={12} /> Auto paper cutter enabled
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Label Designer */}
      {activeTab === 'label' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
            {/* Controls */}
            <div className="w-full lg:w-7/12 space-y-5 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              {/* Hardware Alignment & Gap Calibration Box */}
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Label Command Protocol</h4>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      Select <strong>TSPL Mode</strong> for sticker rolls to lock output inside 1 sticker gap.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCalibrateGap}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Width (mm)</label>
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
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Barcode Type</label>
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
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Preview With Product</label>
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
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Label Contents</label>
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

                <div className="space-y-2">
                  {labelTemplate.map((el, idx) => (
                    <div key={el.id} className="p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center gap-2">
                      <span className="text-sm w-5 text-center flex-shrink-0">{LABEL_ELEMENT_META[el.type].icon}</span>

                      {el.type === 'custom' ? (
                        <input
                          type="text"
                          value={el.text ?? ''}
                          onChange={(e) => updateLabelElement(el.id, { text: e.target.value })}
                          className="flex-1 min-w-0 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs"
                        />
                      ) : (
                        <span className="flex-1 min-w-0 text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                          {LABEL_ELEMENT_META[el.type].label}
                        </span>
                      )}

                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {(['left', 'center', 'right'] as const).map(a => {
                          const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
                          return (
                            <button
                              key={a}
                              type="button"
                              onClick={() => updateLabelElement(el.id, { align: a })}
                              className={`p-1 rounded ${el.align === a ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                              <Icon size={13} />
                            </button>
                          )
                        })}
                        {el.type !== 'barcode' && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateLabelElement(el.id, { bold: !el.bold })}
                              className={`p-1 rounded ${el.bold ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                              <Bold size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateLabelElement(el.id, { large: !el.large })}
                              className={`px-1.5 py-1 rounded text-[10px] font-black ${el.large ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                              2×
                            </button>
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
                  ))}
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="w-full lg:w-5/12 flex flex-col items-center sticky top-6">
              <span className="text-xs font-semibold text-gray-400 mb-3">
                Live Preview — {config.labelWidth}mm × {config.labelHeight}mm
              </span>
              <div className="p-8 bg-slate-900 rounded-2xl flex items-center justify-center w-full min-h-[220px]">
                <div
                  className="bg-white text-gray-900 p-3 rounded-lg shadow-xl flex flex-col justify-center gap-1 border border-gray-300 transition-all duration-300"
                  style={{
                    width: `${Math.min(config.labelWidth * 4.5, 270)}px`,
                    minHeight: `${Math.min(config.labelHeight * 4.5, 170)}px`,
                  }}
                >
                  {labelTemplate.map(el => {
                    const alignClass = el.align === 'left' ? 'text-left' : el.align === 'right' ? 'text-right' : 'text-center'
                    if (el.type === 'barcode') {
                      return (
                        <div key={el.id} className={alignClass}>
                          {config.labelBarcodeType === 'QR' ? (
                            <QrCode size={32} className="inline-block text-slate-900" />
                          ) : (
                            <>
                              <div className="font-extrabold text-xs tracking-widest leading-none">|||||| ||||| |||||||</div>
                              <span className="text-[9px] font-mono text-gray-600">{labelData.barcodeValue}</span>
                            </>
                          )}
                        </div>
                      )
                    }
                    const text = el.type === 'custom' ? el.text : el.type === 'businessName' ? labelData.businessName : el.type === 'productName' ? labelData.productName : labelData.price
                    return (
                      <div
                        key={el.id}
                        className={`${alignClass} truncate ${el.bold ? 'font-bold' : ''} ${el.large ? 'text-sm' : 'text-[11px]'}`}
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
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Document Size</label>
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
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Color Theme</label>
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
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Terms & Conditions</label>
              <textarea
                rows={3}
                value={config.invoiceTermsText}
                onChange={(e) => setConfig(prev => ({ ...prev, invoiceTermsText: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-mono"
              />
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl px-4">
              <Switch checked={config.invoiceShowHeader} onChange={v => setConfig(prev => ({ ...prev, invoiceShowHeader: v }))} label="Header banner" />
              <Switch checked={config.invoiceShowTerms} onChange={v => setConfig(prev => ({ ...prev, invoiceShowTerms: v }))} label="Print terms & conditions" />
              <Switch checked={config.invoiceShowPaymentQR} onChange={v => setConfig(prev => ({ ...prev, invoiceShowPaymentQR: v }))} label="UPI payment QR code" />
            </div>
          </div>

          <div className="w-full lg:w-5/12 flex flex-col items-center sticky top-6">
            <span className="text-xs font-semibold text-gray-400 mb-3">Live Preview</span>
            <div className="w-[320px] bg-white text-gray-900 p-6 rounded-xl shadow-2xl border border-gray-200 text-xs min-h-[420px] flex flex-col justify-between">
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
