import React, { useState, useMemo, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { PrinterConfig, ReceiptConfig, UserSettings } from '@/types/settings.types'
import {
  Printer,
  FileText,
  Copy,
  Trash2,
  Sparkles,
  QrCode,
  Layers,
  Store,
  User,
  ShoppingBag,
  CreditCard,
  Building,
  Tag,
  Plus,
  Eye,
  EyeOff,
  Check,
  X,
  Bluetooth,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  subscribeBlePrinter,
  requestAndConnectPrinter,
  printEscPos,
  isBluetoothSupported,
  type BlePrinterState,
} from '@/utils/blePrinter'
import { EscPosBuilder } from '@/utils/escpos'

interface TextToThermalPrintSectionProps {
  config: PrinterConfig
  setConfig: Dispatch<SetStateAction<PrinterConfig>>
  receiptConfig: ReceiptConfig
  setReceiptConfig: Dispatch<SetStateAction<ReceiptConfig>>
  settings?: UserSettings | null
}

interface ReceiptBlockOption {
  id: string
  label: string
  description: string
  icon: any
  enabled: boolean
}

export function TextToThermalPrintTab({
  config,
  setConfig,
  receiptConfig,
  settings,
}: TextToThermalPrintSectionProps) {
  const paperSize = config.paperSize || config.paperWidth || '58mm'
  const [showBlocksModal, setShowBlocksModal] = useState<boolean>(false)
  const [showPreview, setShowPreview] = useState<boolean>(false)
  const [connectingBle, setConnectingBle] = useState<boolean>(false)
  const [bleState, setBleState] = useState<BlePrinterState>({
    status: isBluetoothSupported() ? 'disconnected' : 'unsupported',
    deviceName: null,
    profileName: null,
  })

  useEffect(() => {
    const unsub = subscribeBlePrinter((s) => setBleState(s))
    return () => unsub()
  }, [])

  const storeName = settings?.businessName || receiptConfig?.companyName || 'SEZNIK STORE'
  const storePhone = settings?.businessPhone || receiptConfig?.phone || '+91 98765 00000'
  const storeAddress = settings?.businessAddress || receiptConfig?.address || 'Main Market Road, City'
  const storeGstin = settings?.businessGSTIN || receiptConfig?.gstin || ''
  const storeUpi = settings?.upiId || receiptConfig?.upiId || 'store@upi'
  const storeLogo = settings?.businessLogoURL || receiptConfig?.logoUrl || ''

  // Modular receipt blocks state
  const [blockOptions, setBlockOptions] = useState<ReceiptBlockOption[]>([
    { id: 'store_header', label: 'Store Header & Info', description: 'Store name, address, GSTIN and phone', icon: Store, enabled: true },
    { id: 'logo', label: 'Business Logo', description: 'Header bitmap logo from store settings', icon: Building, enabled: false },
    { id: 'meta_info', label: 'Bill / Token Meta', description: 'Date, time, order/bill number', icon: FileText, enabled: true },
    { id: 'customer_info', label: 'Customer Details', description: 'Customer name and phone number', icon: User, enabled: false },
    { id: 'items_table', label: 'Itemized Items Table', description: 'Clean formatted item, qty and rate lines', icon: ShoppingBag, enabled: true },
    { id: 'totals_summary', label: 'Totals & Tax Summary', description: 'Subtotal, discount, tax and grand total', icon: CreditCard, enabled: true },
    { id: 'upi_qr', label: 'UPI "Scan to Pay" QR', description: 'Scannable payment QR code with store UPI ID', icon: QrCode, enabled: false },
    { id: 'digital_bill_qr', label: 'Digital Bill Link QR', description: 'Instant online bill download link QR', icon: QrCode, enabled: false },
    { id: 'barcode', label: 'Custom Barcode (Code128)', description: 'Scannable 1D barcode with custom code', icon: Tag, enabled: false },
    { id: 'footer_terms', label: 'Footer & Terms', description: 'Thank you message & return policy', icon: Sparkles, enabled: true },
  ])

  // Presets
  const presets = useMemo(() => [
    {
      id: 'blank',
      title: 'Blank Note',
      icon: '📝',
      text: '',
    },
    {
      id: 'delivery',
      title: 'Delivery Slip',
      icon: '🚚',
      text: [
        '================================',
        '      EXPRESS DELIVERY SLIP     ',
        '================================',
        `Date: ${new Date().toLocaleDateString('en-GB')}  Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        'Order #: ORD-' + Math.floor(100000 + Math.random() * 900000),
        '--------------------------------',
        'CUSTOMER DETAILS:',
        'Name: Rajesh Verma',
        'Phone: +91 98765 43210',
        'Address: Flat 402, Green Meadows,',
        'MG Road, Bengaluru - 560001',
        '--------------------------------',
        'ITEMS IN PARCEL:',
        '1. Premium Roasted Almonds 500g',
        '2. Organic Wild Honey 250g (1x)',
        '3. Whole Grain Rolled Oats 1kg',
        '--------------------------------',
        'PAYMENT: CASH ON DELIVERY',
        'AMOUNT TO COLLECT: Rs. 1,450.00',
        '================================',
        'Handover with recipient signature:',
        '\n\n',
        'Signature: ____________________',
        'Thank you for shopping with us!',
      ].join('\n'),
    },
    {
      id: 'kitchen',
      title: 'Kitchen Ticket (KOT)',
      icon: '👨‍🍳',
      text: [
        '********************************',
        '          KITCHEN ORDER         ',
        '********************************',
        'Table: T-04        Type: DINE-IN',
        'Server: Rahul      KOT #: KOT-089',
        `Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        '--------------------------------',
        'QTY   ITEM DESCRIPTION',
        '--------------------------------',
        '2x    Paneer Butter Masala',
        '      [Spicy, Less Oil]',
        '4x    Butter Tandoori Roti',
        '1x    Jeera Rice (Full)',
        '2x    Sweet Fresh Lime Soda',
        '--------------------------------',
        'Rush order - Table waiting',
        '********************************',
      ].join('\n'),
    },
    {
      id: 'wifi',
      title: 'Store Wi-Fi',
      icon: '📶',
      text: [
        '================================',
        `    ${storeName.toUpperCase()}    `,
        '================================',
        'WELCOME GUEST! FREE WI-FI ACCESS',
        '--------------------------------',
        'Network SSID: Store_Guest_5G',
        'Password:     Welcome@2026',
        '--------------------------------',
        'Need assistance? Ask our counter',
        'team or call us at:',
        `Ph: ${storePhone}`,
        '--------------------------------',
        'Enjoy your visit!',
        '================================',
      ].join('\n'),
    },
    {
      id: 'coupon',
      title: 'Promo Voucher',
      icon: '🏷️',
      text: [
        '********************************',
        '     SPECIAL DISCOUNT VOUCHER   ',
        '********************************',
        `Issued: ${new Date().toLocaleDateString('en-GB')}`,
        'Valid Until: 30 Days from Issue',
        '--------------------------------',
        'FLAT 15% OFF ON NEXT PURCHASE',
        'Coupon Code: SEZNIK15',
        '--------------------------------',
        'Terms: Valid on minimum billing',
        'of Rs. 500. Not applicable with',
        'other ongoing clearance offers.',
        '********************************',
        'Show this slip at the cash counter',
      ].join('\n'),
    },
    {
      id: 'return',
      title: 'Return Slip',
      icon: '🔄',
      text: [
        '================================',
        '    CUSTOMER RETURN & REPAIR    ',
        '================================',
        `Date: ${new Date().toLocaleDateString('en-GB')}  Slip #: RET-${Math.floor(1000 + Math.random() * 9000)}`,
        '--------------------------------',
        'Customer: Priya Sundaram',
        'Contact:  +91 99001 12233',
        'Original Bill: INV-2026-0891',
        '--------------------------------',
        'Item: Wireless Bluetooth Speaker',
        'Issue: Charging port loose',
        'Action: Sent to service center',
        'Estimated Ready Date: In 3 days',
        '================================',
        'Please retain this slip for pickup',
      ].join('\n'),
    },
  ], [storeName, storePhone])

  const [text, setText] = useState<string>(presets[1].text)
  const maxCols = paperSize === '80mm' ? 48 : 32

  const insertSnippet = (snippet: string) => {
    setText((prev) => (prev ? `${prev}\n${snippet}` : snippet))
  }

  const insertDivider = (type: 'dash' | 'double' | 'star' | 'dot') => {
    const char = type === 'dash' ? '-' : type === 'double' ? '=' : type === 'star' ? '*' : '.'
    insertSnippet(char.repeat(maxCols))
  }

  const insertTag = (tag: string) => {
    let val = ''
    const now = new Date()
    if (tag === 'date') val = `Date: ${now.toLocaleDateString('en-GB')}`
    if (tag === 'time') val = `Time: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    if (tag === 'store') val = storeName
    if (tag === 'inv') val = 'INV-' + Math.floor(10000 + Math.random() * 90000)
    insertSnippet(val)
  }

  const centerText = (str: string, width: number) => {
    if (str.length >= width) return str.slice(0, width)
    const pad = Math.max(0, Math.floor((width - str.length) / 2))
    return ' '.repeat(pad) + str
  }

  const padTwo = (left: string, right: string, width: number) => {
    const space = Math.max(1, width - left.length - right.length)
    return left + ' '.repeat(space) + right
  }

  const padColumns = (col1: string, col2: string, col3: string, width: number) => {
    const c1W = Math.floor(width * 0.45)
    const c2W = Math.floor(width * 0.28)
    const c3W = width - c1W - c2W
    const p1 = col1.padEnd(c1W).slice(0, c1W)
    const p2 = col2.padEnd(c2W).slice(0, c2W)
    const p3 = col3.padStart(c3W).slice(0, c3W)
    return p1 + p2 + p3
  }

  const buildReceiptBlocksText = () => {
    const lines: string[] = []
    const div = '-'.repeat(maxCols)
    const doubleDiv = '='.repeat(maxCols)

    blockOptions.forEach((b) => {
      if (!b.enabled) return

      if (b.id === 'store_header') {
        lines.push(doubleDiv)
        lines.push(centerText(storeName, maxCols))
        if (storeAddress) lines.push(centerText(storeAddress, maxCols))
        if (storePhone) lines.push(centerText(`Ph: ${storePhone}`, maxCols))
        if (storeGstin) lines.push(centerText(`GSTIN: ${storeGstin}`, maxCols))
        lines.push(doubleDiv)
      }

      if (b.id === 'meta_info') {
        const now = new Date()
        const dateStr = now.toLocaleDateString('en-GB')
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        lines.push(`Date: ${dateStr}   Time: ${timeStr}`)
        lines.push(`Bill No: INV-${Math.floor(1000 + Math.random() * 9000)}   Counter: 01`)
        lines.push(div)
      }

      if (b.id === 'customer_info') {
        lines.push('CUSTOMER: Walk-in Customer')
        lines.push('Phone:    +91 98765 43210')
        lines.push(div)
      }

      if (b.id === 'items_table') {
        lines.push(padColumns('Item', 'Qty x Rate', 'Total', maxCols))
        lines.push(div)
        lines.push(padColumns('Organic Green Tea 100g', '1 x 180.00', '180.00', maxCols))
        lines.push(padColumns('Almond Butter 250g', '2 x 260.00', '520.00', maxCols))
        lines.push(padColumns('Cold Pressed Mustard 1L', '1 x 195.00', '195.00', maxCols))
        lines.push(div)
      }

      if (b.id === 'totals_summary') {
        lines.push(padTwo('Subtotal:', 'Rs. 895.00', maxCols))
        lines.push(padTwo('Discount (5%):', '- Rs. 44.75', maxCols))
        lines.push(padTwo('CGST (2.5%):', 'Rs. 21.26', maxCols))
        lines.push(padTwo('SGST (2.5%):', 'Rs. 21.26', maxCols))
        lines.push(div)
        lines.push(padTwo('GRAND TOTAL:', 'Rs. 892.77', maxCols))
        lines.push(doubleDiv)
      }

      if (b.id === 'upi_qr') {
        lines.push(centerText('*** SCAN TO PAY VIA UPI ***', maxCols))
        if (storeUpi) lines.push(centerText(`UPI ID: ${storeUpi}`, maxCols))
        lines.push(div)
      }

      if (b.id === 'digital_bill_qr') {
        lines.push(centerText('Scan QR for Digital Tax Invoice', maxCols))
        lines.push(div)
      }

      if (b.id === 'barcode') {
        lines.push(centerText('* BARCODE: 8901234567890 *', maxCols))
        lines.push(div)
      }

      if (b.id === 'footer_terms') {
        lines.push(centerText('Thank you! Visit Again', maxCols))
        lines.push(centerText('Goods once sold cannot be returned', maxCols))
        lines.push(doubleDiv)
      }
    })

    return lines.join('\n')
  }

  const handleApplyBlocks = (mode: 'append' | 'replace') => {
    const blockText = buildReceiptBlocksText()
    if (mode === 'replace') {
      setText(blockText)
    } else {
      setText((prev) => (prev ? `${prev}\n\n${blockText}` : blockText))
    }
    setShowBlocksModal(false)
  }

  const handlePrintBle = async () => {
    if (!text.trim()) {
      toast.error('Please enter text to print')
      return
    }

    try {
      if (bleState.status !== 'connected') {
        setConnectingBle(true)
        toast('Opening Bluetooth device scanner...', { icon: '🔍' })
        await requestAndConnectPrinter()
      }

      const effectivePaper = paperSize === '80mm' ? '80mm' : '58mm'
      const b = new EscPosBuilder()
      b.init(effectivePaper)

      const logoEnabled = blockOptions.find((b) => b.id === 'logo' && b.enabled)
      if (logoEnabled && storeName) {
        b.align('center').bold(true).line(storeName.toUpperCase()).bold(false).feed(1)
      }

      const lines = text.split('\n')
      lines.forEach((l) => b.line(l))

      const upiQrEnabled = blockOptions.find((b) => b.id === 'upi_qr' && b.enabled)
      if (upiQrEnabled && storeUpi) {
        b.feed(1).align('center').bold(true).line('SCAN TO PAY VIA UPI').bold(false)
        b.qr(`upi://pay?pa=${encodeURIComponent(storeUpi)}&pn=${encodeURIComponent(storeName)}&am=0.00&cu=INR`, 6)
        b.line(storeUpi)
      }

      b.feed(3).cut()
      await printEscPos(b.toBytes())
      toast.success('Sent directly to Bluetooth thermal printer!')
    } catch (err: any) {
      console.error('BLE Print error:', err)
      toast.error(err?.message || 'Failed to print via Bluetooth')
    } finally {
      setConnectingBle(false)
    }
  }

  const handlePrint = () => {
    if (!text.trim()) {
      toast.error('Please enter text to print')
      return
    }

    toast('Print dialog opened: Select your thermal printer under Destination (instead of Save as PDF)', {
      icon: '🖨️',
      duration: 5000,
    })

    const widthPx = paperSize === '80mm' ? '380px' : '280px'
    const fontSize = paperSize === '58mm' ? '12px' : '14px'
    const lines = text.split('\n')
    const upiQrEnabled = blockOptions.find((b) => b.id === 'upi_qr' && b.enabled)
    const logoEnabled = blockOptions.find((b) => b.id === 'logo' && b.enabled)

    const upiImgUrl = upiQrEnabled && storeUpi
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&data=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(storeUpi)}&pn=${encodeURIComponent(storeName)}&am=0.00&cu=INR`)}`
      : ''

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Thermal Print</title>
          <style>
            @page { size: ${paperSize} auto; margin: 2mm 1mm 6mm 1mm; }
            * { box-sizing: border-box; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: ${fontSize};
              line-height: 1.3;
              margin: 0 auto;
              padding: 4px;
              width: 100%;
              max-width: ${widthPx};
              color: #000;
              background: #fff;
            }
          </style>
        </head>
        <body>
          ${logoEnabled && storeLogo ? `
          <div style="text-align: center; margin-bottom: 8px;">
            <img src="${storeLogo}" style="max-height: 100px; max-width: ${widthPx}; width: auto; height: auto; object-fit: contain; margin: 0 auto; display: block;" />
          </div>` : ''}
          ${lines.map((l) => `<div style="white-space: pre-wrap; word-break: break-word; width: 100%; font-family: 'Courier New', Courier, monospace;">${l.replace(/ /g, '&nbsp;') || '&nbsp;'}</div>`).join('')}
          ${upiImgUrl ? `
          <div style="text-align: center; margin-top: 10px; padding: 6px 0; border-top: 1px dashed #000; display: block;">
            <div style="font-size: 10px; font-weight: 800; margin-bottom: 4px;">SCAN TO PAY VIA UPI</div>
            <img src="${upiImgUrl}" alt="UPI QR" style="width: 110px; height: 110px; object-fit: contain; margin: 0 auto; display: block;" />
            <div style="font-size: 9px; margin-top: 2px;">${storeUpi}</div>
          </div>` : ''}
        </body>
      </html>
    `

    const printFrame = document.createElement('iframe')
    printFrame.style.position = 'fixed'
    printFrame.style.right = '0'
    printFrame.style.bottom = '0'
    printFrame.style.width = '0'
    printFrame.style.height = '0'
    printFrame.style.border = '0'
    document.body.appendChild(printFrame)

    const frameDoc = printFrame.contentWindow?.document
    if (frameDoc) {
      frameDoc.open()
      frameDoc.write(html)
      frameDoc.close()
      setTimeout(() => {
        printFrame.contentWindow?.focus()
        printFrame.contentWindow?.print()
        setTimeout(() => {
          document.body.removeChild(printFrame)
        }, 1000)
      }, 300)
    }
  }

  const handleCopy = () => {
    if (!text.trim()) return
    navigator.clipboard.writeText(text)
    toast.success('Thermal text copied to clipboard!')
  }

  return (
    <div className="space-y-3.5 w-full">
      {/* PRESET CHIPS ROW */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mr-1">Presets:</span>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setText(p.text)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 border border-slate-200/80 dark:border-dark-border-strong whitespace-nowrap transition-colors flex items-center gap-1"
          >
            <span>{p.icon}</span>
            <span>{p.title}</span>
          </button>
        ))}
      </div>

      {/* QUICK TOOLS & BLOCKS ROW */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-dark-elevated/40 border border-slate-200/80 dark:border-dark-border">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowBlocksModal(true)}
            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Layers size={13} />
            <span>+ Choose Blocks</span>
          </button>

          <button
            type="button"
            onClick={() => insertDivider('dash')}
            className="px-2 py-1 rounded-md bg-white dark:bg-dark-elevated text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border hover:bg-slate-100"
          >
            --- Dashes
          </button>
          <button
            type="button"
            onClick={() => insertDivider('double')}
            className="px-2 py-1 rounded-md bg-white dark:bg-dark-elevated text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border hover:bg-slate-100"
          >
            === Double
          </button>
          <button
            type="button"
            onClick={() => insertTag('date')}
            className="px-2 py-1 rounded-md bg-white dark:bg-dark-elevated text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border hover:bg-slate-100"
          >
            + Date
          </button>
          <button
            type="button"
            onClick={() => insertTag('time')}
            className="px-2 py-1 rounded-md bg-white dark:bg-dark-elevated text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-border hover:bg-slate-100"
          >
            + Time
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy Text"
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-dark-elevated"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={() => setText('')}
            title="Clear"
            className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={`px-2 py-1 rounded-md text-[11px] font-bold border flex items-center gap-1 transition-all ${
              showPreview
                ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-dark-elevated border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{showPreview ? 'Hide Slip' : 'Preview Slip'}</span>
          </button>
        </div>
      </div>

      {/* COMPACT TEXTAREA */}
      <div className="relative">
        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste custom thermal receipt text..."
          className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated text-slate-900 dark:text-white font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[110px]"
        />
        <div className="absolute bottom-2 right-2 text-[10px] font-mono text-slate-400 bg-white/80 dark:bg-dark-card/80 px-1.5 py-0.5 rounded pointer-events-none">
          {paperSize} · {maxCols} cols
        </div>
      </div>

      {/* LIVE PREVIEW ROLL (OPTIONAL TOGGLE) */}
      {showPreview && (
        <div className="w-full flex justify-center py-3 bg-slate-200/60 dark:bg-dark-elevated/40 rounded-xl border border-slate-200 dark:border-dark-border">
          <div
            style={{ maxWidth: paperSize === '80mm' ? '360px' : '280px' }}
            className="w-full bg-white text-black p-3.5 rounded shadow-sm border-t-2 border-slate-300 relative font-mono text-xs leading-tight select-none"
          >
            <div className="whitespace-pre-wrap break-words font-mono text-[11px] leading-tight">
              {text || 'Empty Document\nType text or choose receipt blocks to preview output.'}
            </div>

            {blockOptions.find((b) => b.id === 'upi_qr' && b.enabled) && (
              <div className="mt-3 pt-2 border-t border-dashed border-black text-center space-y-1">
                <div className="text-[9px] font-extrabold">SCAN TO PAY VIA UPI</div>
                <div className="flex justify-center py-1">
                  <div className="w-16 h-16 bg-slate-100 border border-slate-300 flex items-center justify-center">
                    <QrCode size={40} className="text-black" />
                  </div>
                </div>
                <div className="text-[9px] text-slate-600">{storeUpi}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DUAL PRINT BUTTONS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {isBluetoothSupported() && (
          <button
            type="button"
            onClick={handlePrintBle}
            disabled={connectingBle}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-xs cursor-pointer"
          >
            <Bluetooth size={16} className="text-white shrink-0" />
            <span className="truncate">
              {connectingBle
                ? 'Connecting...'
                : bleState.status === 'connected'
                ? `Print Bluetooth (${bleState.deviceName || 'Ready'})`
                : 'Print via Bluetooth (ESC/POS)'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handlePrint}
          className={`w-full ${
            isBluetoothSupported() ? 'bg-emerald-600 hover:bg-emerald-500' : 'sm:col-span-2 bg-emerald-600 hover:bg-emerald-500'
          } active:scale-[0.99] text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all text-xs cursor-pointer`}
        >
          <Printer size={16} className="text-white shrink-0" />
          <span>Print via System Driver ({paperSize})</span>
        </button>
      </div>

      {/* RECEIPT BLOCKS MODAL */}
      {showBlocksModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-border pb-3">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Select Receipt Blocks</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBlocksModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-elevated text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Pick modular blocks to insert formatted store info, totals, tables or QR codes into your thermal text.
            </p>

            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {blockOptions.map((b) => (
                <div
                  key={b.id}
                  onClick={() => {
                    setBlockOptions((prev) =>
                      prev.map((item) => (item.id === b.id ? { ...item, enabled: !item.enabled } : item))
                    )
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    b.enabled
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-dark-elevated border-slate-200 dark:border-dark-border opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${b.enabled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      <b.icon size={15} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{b.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{b.description}</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      b.enabled ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white dark:bg-dark-card'
                    }`}
                  >
                    {b.enabled && <Check size={12} />}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-dark-border flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleApplyBlocks('append')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs"
              >
                + Append to Text
              </button>
              <button
                type="button"
                onClick={() => handleApplyBlocks('replace')}
                className="flex-1 bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold py-2 rounded-xl text-xs border border-slate-200 dark:border-dark-border"
              >
                Replace All Text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
