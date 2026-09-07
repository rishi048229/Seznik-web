import React, { useState, useMemo } from 'react'
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
  Check,
  X,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from 'react-hot-toast'

interface TextToThermalPrintTabProps {
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
}: TextToThermalPrintTabProps) {
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(config.paperSize || config.paperWidth || '58mm')
  const [copies, setCopies] = useState<number>(1)
  const [showBlocksModal, setShowBlocksModal] = useState<boolean>(false)

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
        'Signature: _____________________',
        'Thank you for shopping with us!',
      ].join('\n'),
    },
    {
      id: 'token',
      title: 'Kitchen Ticket',
      icon: '🎫',
      text: [
        '================================',
        '        KITCHEN ORDER TICKET    ',
        '================================',
        `Date: ${new Date().toLocaleDateString('en-GB')}  Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        'Token No: #T-042  Table: T-4',
        'Waiter: Anand K.',
        '--------------------------------',
        'ITEMS ORDERED:',
        '2x Paneer Butter Masala (Spicy)',
        '4x Butter Garlic Naan',
        '1x Jeera Rice (Large Bowl)',
        '2x Fresh Lime Soda (Sweet)',
        '--------------------------------',
        'SPECIAL INSTRUCTION:',
        '• Less oil in paneer curry',
        '• Serve drinks first immediately',
        '================================',
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

  const insertText = (snippet: string) => {
    setText((prev) => (prev ? `${prev}\n${snippet}` : snippet))
  }

  const insertDivider = (type: 'dash' | 'double' | 'star' | 'dot') => {
    const char = type === 'dash' ? '-' : type === 'double' ? '=' : type === 'star' ? '*' : '.'
    insertText(char.repeat(maxCols))
  }

  const insertTag = (tag: string) => {
    let val = ''
    const now = new Date()
    if (tag === 'date') val = now.toLocaleDateString('en-GB')
    if (tag === 'time') val = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (tag === 'store') val = storeName
    if (tag === 'phone') val = storePhone
    if (tag === 'inv') val = 'INV-' + Math.floor(10000 + Math.random() * 90000)
    insertText(val)
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

  const handlePrint = () => {
    if (!text.trim()) {
      toast.error('Please enter text to print')
      return
    }

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
    <div className="space-y-6 w-full min-w-0">
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0">
        {/* LEFT COLUMN: EDITOR & CONTROLS */}
        <div className="w-full lg:w-7/12 space-y-4 min-w-0">
          {/* Header Controls Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 dark:text-white">Text to Thermal Print</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  Instant Print
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter freeform text, announcements, courier slips or insert structured receipt blocks.
              </p>
            </div>

            {/* Paper Size Selector */}
            <div className="flex items-center gap-2 bg-slate-200/70 dark:bg-dark-elevated p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setPaperSize('58mm')
                  setConfig((c) => ({ ...c, paperSize: '58mm', paperWidth: '58mm' }))
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  paperSize === '58mm'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                58mm (2")
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaperSize('80mm')
                  setConfig((c) => ({ ...c, paperSize: '80mm', paperWidth: '80mm' }))
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  paperSize === '80mm'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                80mm (3")
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <Sparkles size={13} className="text-blue-600" />
              <span>Quick Preset Slips</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setText(p.text)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:shadow-sm transition-all whitespace-nowrap"
                >
                  <span>{p.icon}</span>
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Block Selector Banner */}
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-950 dark:text-blue-100">Select Receipt Blocks</p>
                <p className="text-xs text-blue-800/80 dark:text-blue-300 mt-0.5">
                  Insert Header, Items Table, Totals & Tax, or UPI QR from your store
                </p>
              </div>
            </div>
            <Button type="button" size="sm" onClick={() => setShowBlocksModal(true)} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus size={14} className="mr-1" />
              Choose Blocks
            </Button>
          </div>

          {/* Formatting Toolbar */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="uppercase tracking-wider">Formatting Helpers</span>
              <span>Width: {maxCols} chars/line</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => insertDivider('dash')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-dark-elevated text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                --- Dashes
              </button>
              <button
                type="button"
                onClick={() => insertDivider('double')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-dark-elevated text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                === Double
              </button>
              <button
                type="button"
                onClick={() => insertDivider('star')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-dark-elevated text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                *** Stars
              </button>
              <button
                type="button"
                onClick={() => insertDivider('dot')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-dark-elevated text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                ... Dots
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-dark-border/60">
              <button
                type="button"
                onClick={() => insertTag('date')}
                className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100"
              >
                + Today's Date
              </button>
              <button
                type="button"
                onClick={() => insertTag('time')}
                className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100"
              >
                + Time
              </button>
              <button
                type="button"
                onClick={() => insertTag('store')}
                className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100"
              >
                + Store Name
              </button>
              <button
                type="button"
                onClick={() => insertTag('inv')}
                className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100"
              >
                + Invoice #
              </button>
            </div>
          </div>

          {/* Multi-line Editor */}
          <div className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-white">Thermal Receipt Text</label>
              <button
                type="button"
                onClick={() => setText('')}
                className="text-xs text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            </div>

            <textarea
              rows={14}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste custom thermal receipt text..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-elevated text-slate-900 dark:text-white font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE THERMAL PREVIEW */}
        <div className="w-full lg:w-5/12 space-y-4 min-w-0 lg:sticky lg:top-6">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-card border border-slate-200 dark:border-dark-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-blue-600" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Live Simulation ({paperSize})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-white dark:bg-dark-elevated border border-slate-200 dark:border-dark-border text-slate-600 dark:text-slate-300 hover:text-slate-900"
                title="Copy Text"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>

          {/* Authentic White Paper Roll */}
          <div className="w-full flex justify-center py-4 bg-slate-200/50 dark:bg-dark-elevated/40 rounded-2xl border border-slate-200 dark:border-dark-border">
            <div
              style={{ maxWidth: paperSize === '80mm' ? '380px' : '290px' }}
              className="w-full bg-white text-black p-4 rounded shadow-md border-t-4 border-slate-300 relative font-mono text-xs leading-tight select-none"
            >
              {blockOptions.find((b) => b.id === 'logo' && b.enabled) && (
                <div className="text-center mb-3">
                  <div className="font-extrabold text-sm tracking-wide text-slate-900">
                    {storeName.toUpperCase()}
                  </div>
                </div>
              )}

              <div className="whitespace-pre-wrap break-words font-mono text-[11px] leading-tight">
                {text || 'Empty Document\nType text or choose receipt blocks to preview output.'}
              </div>

              {blockOptions.find((b) => b.id === 'upi_qr' && b.enabled) && (
                <div className="mt-3 pt-2 border-t border-dashed border-black text-center space-y-1">
                  <div className="text-[9px] font-extrabold">SCAN TO PAY VIA UPI</div>
                  <div className="flex justify-center py-1">
                    <div className="w-20 h-20 bg-slate-100 border border-slate-300 flex items-center justify-center">
                      <QrCode size={52} className="text-black" />
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-600">{storeUpi}</div>
                </div>
              )}

              {/* Bottom Serrated Edge */}
              <div className="absolute -bottom-2 left-0 right-0 h-2 bg-slate-300/40 rounded-b" />
            </div>
          </div>

          {/* Print CTA */}
          <div className="p-4 rounded-2xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border flex items-center gap-3">
            <Button
              type="button"
              onClick={handlePrint}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Printer size={18} />
              <span>Print to Thermal ({paperSize})</span>
            </Button>
          </div>
        </div>
      </div>

      {/* RECEIPT BLOCKS MODAL */}
      {showBlocksModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border p-5 space-y-4 max-h-[85vh] flex flex-col">
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

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toggle the receipt blocks you want to format and insert into your thermal print:
            </p>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {blockOptions.map((b) => {
                const IconComp = b.icon
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBlockOptions((prev) =>
                        prev.map((item) => (item.id === b.id ? { ...item, enabled: !item.enabled } : item))
                      )
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      b.enabled
                        ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-500 dark:border-blue-700'
                        : 'bg-slate-50 dark:bg-dark-elevated/50 border-slate-200 dark:border-dark-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          b.enabled ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-dark-border text-slate-500'
                        }`}
                      >
                        <IconComp size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{b.label}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{b.description}</p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center ${
                        b.enabled ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-dark-border'
                      }`}
                    >
                      {b.enabled && <Check size={12} />}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-dark-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleApplyBlocks('append')}
                className="flex-1"
              >
                Append to Text
              </Button>
              <Button
                type="button"
                onClick={() => handleApplyBlocks('replace')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Replace & Insert
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function centerText(text: string, width: number): string {
  const clean = text.trim()
  if (clean.length >= width) return clean.slice(0, width)
  const totalPad = width - clean.length
  const leftPad = Math.floor(totalPad / 2)
  const rightPad = totalPad - leftPad
  return ' '.repeat(leftPad) + clean + ' '.repeat(rightPad)
}

function padTwo(left: string, right: string, width: number): string {
  const l = left.trim()
  const r = right.trim()
  const space = width - l.length - r.length
  if (space <= 0) return `${l} ${r}`.slice(0, width)
  return l + ' '.repeat(space) + r
}

function padColumns(col1: string, col2: string, col3: string, width: number): string {
  const c1Width = Math.floor(width * 0.44)
  const c2Width = Math.floor(width * 0.32)
  const c3Width = width - c1Width - c2Width

  const c1 = col1.slice(0, c1Width).padEnd(c1Width, ' ')
  const c2 = col2.slice(0, c2Width).padStart(c2Width, ' ')
  const c3 = col3.slice(0, c3Width).padStart(c3Width, ' ')
  return c1 + c2 + c3
}
