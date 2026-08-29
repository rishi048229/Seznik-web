import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Printer, FileText, Bluetooth, Edit3, RotateCcw,
  Sparkles, Building2, Hash, Plus, Trash2, Eye, Download
} from 'lucide-react'
import QRCode from 'qrcode'
import { formatINR } from '@/utils/currency'
import { generateReceiptHTML, generateReceiptEscPos, printReceipt, resolveEffectiveReceiptConfig } from '@/utils/receipt'
import { downloadA4InvoicePdf } from '@/utils/a4Invoice'
import { shouldPrintThermalOverBle } from '@/utils/printTarget'
import { buildUpiPayLink } from '@/utils/upiQr'
import type { Sale, SaleItem } from '@/types/sale.types'
import type { UserSettings } from '@/types/settings.types'
import toast from 'react-hot-toast'

export interface EditableReceiptItem {
  id?: string
  productId?: string
  productName: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate?: number
  total: number
}

export interface EditableReceiptState {
  businessName: string
  storeName: string
  businessAddress: string
  businessPhone: string
  businessGSTIN: string
  logoURL: string
  invoiceNumber: string
  date: string
  customerName: string
  customerPhone: string
  items: EditableReceiptItem[]
  orderDiscount: number
  taxAmount: number
  grandTotal: number
  paymentMethod: 'cash' | 'card' | 'upi' | 'credit'
  amountPaid: number
  change: number
  upiId: string
  footerMessage: string
  showTaxBreakdown: boolean
  showUpiQr: boolean
  paperSize: '58mm' | '80mm'
}

export interface RealisticReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  sale?: Partial<Sale> | null
  settings?: UserSettings | null
  initialCustomerName?: string
  initialCustomerPhone?: string
  onDone?: () => void
  blePrinter?: {
    status: string
    deviceName: string | null
    isSupported: boolean
    connect: () => Promise<void>
    print: (bytes: Uint8Array) => Promise<void>
  }
}

export const RealisticReceiptModal = ({
  isOpen,
  onClose,
  sale,
  settings,
  initialCustomerName = '',
  initialCustomerPhone = '',
  onDone,
  blePrinter,
}: RealisticReceiptModalProps) => {
  const receiptConfig = resolveEffectiveReceiptConfig(settings)

  // Initialize receipt editable state from sale & settings
  const defaultState = useMemo<EditableReceiptState>(() => {
    const rawItems: any[] = (sale?.items as any[]) || []
    const mappedItems: EditableReceiptItem[] = rawItems.map((item, idx) => {
      const uPrice = Number(item.sellingPrice ?? item.unitPrice ?? item.price ?? 0)
      const q = Number(item.quantity) || 1
      const d = Number(item.discount || 0)
      return {
        id: item.id || `item-${idx}`,
        productId: item.productId,
        productName: item.productName || 'Item',
        quantity: q,
        unitPrice: uPrice,
        discount: d,
        taxRate: Number(item.taxRate || 0),
        total: Number(item.total ?? Math.max(0, q * uPrice - d)),
      }
    })

    const subtotal = mappedItems.reduce((sum, it) => sum + (it.quantity * it.unitPrice - it.discount), 0)
    const discount = Number(sale?.totalDiscount ?? (sale as any)?.discount ?? 0)
    const tax = Number(sale?.totalTax ?? (sale as any)?.tax ?? 0)
    const grand = Number(sale?.grandTotal ?? Math.max(0, subtotal - discount + tax))
    const paid = Number(sale?.amountPaid ?? grand)
    const changeAmt = Math.max(0, paid - grand)

    return {
      businessName: receiptConfig?.companyName || settings?.businessName || 'SEZNIK ENTERPRISES',
      storeName: (settings as any)?.storeName || '',
      businessAddress: receiptConfig?.address || settings?.businessAddress || 'Main Market Road, City Center',
      businessPhone: receiptConfig?.phone || settings?.businessPhone || '+91 98765 43210',
      businessGSTIN: receiptConfig?.gstin || settings?.businessGSTIN || '',
      logoURL: settings?.businessLogoURL || receiptConfig?.logoURL || '',
      invoiceNumber: sale?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      date: sale?.createdAt ? new Date(sale.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      customerName: initialCustomerName || (sale as any)?.customer?.name || 'Walk-in Customer',
      customerPhone: initialCustomerPhone || (sale as any)?.customer?.phone || '',
      items: mappedItems.length > 0 ? mappedItems : [
        { productName: 'Standard Item', quantity: 1, unitPrice: grand || 100, discount: 0, taxRate: 0, total: grand || 100 }
      ],
      orderDiscount: discount,
      taxAmount: tax,
      grandTotal: grand,
      paymentMethod: (sale?.paymentMethod as any) || 'cash',
      amountPaid: paid,
      change: changeAmt,
      upiId: settings?.receiptConfig?.upiId || '',
      footerMessage: receiptConfig?.footerMessage || 'Thank you for your visit! Goods once sold can be exchanged within 7 days.',
      showTaxBreakdown: receiptConfig?.showTaxBreakdown ?? true,
      showUpiQr: !!settings?.receiptConfig?.upiId,
      paperSize: (settings?.printerConfig?.paperSize === '80mm' ? '80mm' : '58mm'),
    }
  }, [sale, settings, receiptConfig, initialCustomerName, initialCustomerPhone])

  const [receipt, setReceipt] = useState<EditableReceiptState>(defaultState)
  const [isEditing, setIsEditing] = useState(false)
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('')
  const [isPrintingBle, setIsPrintingBle] = useState(false)

  // Re-sync when modal opens
  useEffect(() => {
    if (isOpen) {
      setReceipt(defaultState)
      setIsEditing(false)
    }
  }, [isOpen, defaultState])

  // Recalculate totals whenever items or discount changes
  const recalcTotals = (itemsList: EditableReceiptItem[], orderDisc: number) => {
    const sub = itemsList.reduce((acc, it) => acc + (it.quantity * it.unitPrice - it.discount), 0)
    let taxSum = 0
    itemsList.forEach(it => {
      if (it.taxRate && it.taxRate > 0) {
        const itemNet = it.quantity * it.unitPrice - it.discount
        taxSum += (itemNet * it.taxRate) / 100
      }
    })
    const finalG = Math.max(0, sub - orderDisc + taxSum)
    const paid = receipt.paymentMethod === 'credit' ? 0 : (receipt.amountPaid > 0 ? receipt.amountPaid : finalG)
    const chg = Math.max(0, paid - finalG)

    setReceipt(prev => ({
      ...prev,
      items: itemsList,
      orderDiscount: orderDisc,
      taxAmount: taxSum,
      grandTotal: finalG,
      amountPaid: paid,
      change: chg,
    }))
  }

  // Generate dynamic QR Code for the exact grand total
  useEffect(() => {
    if (receipt.upiId && receipt.grandTotal > 0) {
      const upiUrl = buildUpiPayLink({
        upiId: receipt.upiId,
        payeeName: receipt.businessName,
        amount: receipt.grandTotal,
        note: `Bill ${receipt.invoiceNumber}`,
      })
      QRCode.toDataURL(upiUrl, { width: 140, margin: 1 })
        .then(url => setUpiQrDataUrl(url))
        .catch(() => setUpiQrDataUrl(''))
    } else {
      setUpiQrDataUrl('')
    }
  }, [receipt.upiId, receipt.businessName, receipt.grandTotal, receipt.invoiceNumber])

  // Handlers for item modifications
  const handleItemChange = (index: number, field: keyof EditableReceiptItem, value: any) => {
    const updated = [...receipt.items]
    const item = { ...updated[index], [field]: value }
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    const disc = Number(item.discount) || 0
    item.total = Math.max(0, qty * price - disc)
    updated[index] = item
    recalcTotals(updated, receipt.orderDiscount)
  }

  const handleAddItem = () => {
    const newItem: EditableReceiptItem = {
      id: `new-${Date.now()}`,
      productName: 'New Item',
      quantity: 1,
      unitPrice: 100,
      discount: 0,
      taxRate: 0,
      total: 100,
    }
    recalcTotals([...receipt.items, newItem], receipt.orderDiscount)
  }

  const handleRemoveItem = (index: number) => {
    if (receipt.items.length <= 1) {
      toast.error('Bill must contain at least one item')
      return
    }
    const updated = receipt.items.filter((_, idx) => idx !== index)
    recalcTotals(updated, receipt.orderDiscount)
  }

  // Construct updated Sale object with all edits
  const buildEditedSale = (): Sale => {
    const subtotal = receipt.items.reduce((s, it) => s + (it.quantity * it.unitPrice - it.discount), 0)
    const saleItems: SaleItem[] = receipt.items.map((it, idx) => ({
      productId: it.productId || `prod-${idx}`,
      productName: it.productName,
      quantity: it.quantity,
      sellingPrice: it.unitPrice,
      discount: it.discount,
      taxRate: it.taxRate || 0,
      taxAmount: ((it.quantity * it.unitPrice - it.discount) * (it.taxRate || 0)) / 100,
      total: it.total,
    }))

    return {
      id: sale?.id || `sale-${Date.now()}`,
      invoiceNumber: receipt.invoiceNumber,
      createdAt: sale?.createdAt || new Date().toISOString(),
      subtotal,
      totalDiscount: receipt.orderDiscount,
      totalTax: receipt.taxAmount,
      grandTotal: receipt.grandTotal,
      paymentMethod: receipt.paymentMethod,
      amountPaid: receipt.amountPaid,
      changeReturned: receipt.change,
      isQuickBill: Boolean(sale?.isQuickBill),
      items: saleItems,
      customerId: sale?.customerId,
    }
  }

  const editedReceiptConfig = () => ({
    ...receiptConfig,
    companyName: receipt.storeName ? `${receipt.businessName} — ${receipt.storeName}` : receipt.businessName,
    address: receipt.businessAddress,
    phone: receipt.businessPhone,
    gstin: receipt.businessGSTIN,
    footerMessage: receipt.footerMessage,
    showTaxBreakdown: receipt.showTaxBreakdown,
    showPaymentQR: receipt.showUpiQr,
    upiId: receipt.upiId,
  })

  const printPayload = () => ({
    sale: buildEditedSale(),
    receiptConfig: editedReceiptConfig(),
    printerConfig: settings?.printerConfig,
    businessName: receipt.businessName,
    businessAddress: receipt.businessAddress,
    customerName: receipt.customerName,
    customerPhone: receipt.customerPhone,
    dateLabel: receipt.date,
    logoURL: receipt.logoURL,
    settingsTaxName: 'GST' as const,
  })

  const handlePrintThermal = async () => {
    const payload = printPayload()
    const width: '50mm' | '80mm' = receipt.paperSize === '80mm' ? '80mm' : '50mm'
    const useBle = shouldPrintThermalOverBle(settings, blePrinter)

    if (useBle && blePrinter) {
      setIsPrintingBle(true)
      try {
        if (blePrinter.status !== 'connected') {
          await blePrinter.connect()
        }
        const bytes = await generateReceiptEscPos({
          sale: payload.sale,
          receiptConfig: payload.receiptConfig,
          paperSize: receipt.paperSize,
          businessName: receipt.businessName,
          businessAddress: receipt.businessAddress,
          customerName: receipt.customerName,
          customerPhone: receipt.customerPhone,
          dateLabel: receipt.date,
        })
        await blePrinter.print(bytes)
        toast.success(`Printed to ${blePrinter.deviceName || 'Bluetooth printer'}`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Bluetooth printing failed'
        toast.error(`${msg}. Connect the printer on the Printers page.`)
      } finally {
        setIsPrintingBle(false)
      }
      return
    }

    const html = generateReceiptHTML({ ...payload, width })
    printReceipt(html, width, payload.sale.invoiceNumber)
  }

  const handlePrintA4 = () => {
    const payload = printPayload()
    const html = generateReceiptHTML({ ...payload, width: '210mm' })
    printReceipt(html, '210mm', payload.sale.invoiceNumber)
  }

  const handleDownloadA4Pdf = () => {
    const payload = printPayload()
    const html = generateReceiptHTML({ ...payload, width: '210mm' })
    downloadA4InvoicePdf(html, `${payload.sale.invoiceNumber}.pdf`, settings?.printerConfig?.invoicePaperSize || 'A4')
    toast.success('Invoice opened — click Save as PDF')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? '✏️ Edit Receipt Details' : '🖨️ Receipt & Bill Preview'}
      size="xl"
      footer={
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isEditing ? 'primary' : 'outline'}
              size="sm"
              leftIcon={isEditing ? <Eye size={15} /> : <Edit3 size={15} />}
              onClick={() => setIsEditing(!isEditing)}
              className={`flex-1 sm:flex-none ${isEditing ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border-indigo-200 text-indigo-700 dark:text-indigo-300 dark:border-indigo-800'}`}
            >
              {isEditing ? 'View bill' : 'Edit bill'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw size={14} />}
              onClick={() => setReceipt(defaultState)}
              className="text-gray-500 text-xs"
            >
              Reset
            </Button>
            <div className="hidden sm:flex items-center gap-2 ml-auto text-[11px] text-slate-500">
              Edits apply to print, PDF, and A4
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileText size={15} />}
              onClick={handlePrintA4}
              className="font-semibold"
            >
              Print A4
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download size={15} />}
              onClick={handleDownloadA4Pdf}
              className="font-semibold"
            >
              Download PDF
            </Button>
            <Button
              size="sm"
              leftIcon={shouldPrintThermalOverBle(settings, blePrinter) ? <Bluetooth size={16} /> : <Printer size={16} />}
              onClick={handlePrintThermal}
              loading={isPrintingBle}
              className="col-span-2 sm:col-span-1 sm:ml-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
            >
              {blePrinter?.status === 'connected'
                ? `Print to ${blePrinter.deviceName || 'printer'}`
                : shouldPrintThermalOverBle(settings, blePrinter)
                  ? 'Connect & print receipt'
                  : `Print receipt (${receipt.paperSize})`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[480px]">
        {/* LEFT COLUMN: EDIT CONTROLS */}
        {isEditing && (
          <div className="lg:col-span-6 space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
            <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600" />
                Live Receipt Editor Active
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Changes sync instantly to print</span>
            </div>

            {/* Store & Merchant Details */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Building2 size={14} /> Store &amp; Merchant Info
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Business / Store Name</label>
                  <Input
                    value={receipt.businessName}
                    onChange={e => setReceipt(prev => ({ ...prev, businessName: e.target.value }))}
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Branch / Store Tag</label>
                  <Input
                    value={receipt.storeName}
                    onChange={e => setReceipt(prev => ({ ...prev, storeName: e.target.value }))}
                    placeholder="e.g. Main Branch"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Phone Number</label>
                  <Input
                    value={receipt.businessPhone}
                    onChange={e => setReceipt(prev => ({ ...prev, businessPhone: e.target.value }))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">GSTIN</label>
                  <Input
                    value={receipt.businessGSTIN}
                    onChange={e => setReceipt(prev => ({ ...prev, businessGSTIN: e.target.value }))}
                    placeholder="27AAAAA0000A1Z5"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Address</label>
                <Input
                  value={receipt.businessAddress}
                  onChange={e => setReceipt(prev => ({ ...prev, businessAddress: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Bill Meta & Customer */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Hash size={14} /> Bill &amp; Customer
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Invoice Number</label>
                  <Input
                    value={receipt.invoiceNumber}
                    onChange={e => setReceipt(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Date &amp; Time Text</label>
                  <Input
                    value={receipt.date}
                    onChange={e => setReceipt(prev => ({ ...prev, date: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Customer Name</label>
                  <Input
                    value={receipt.customerName}
                    onChange={e => setReceipt(prev => ({ ...prev, customerName: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Customer Phone</label>
                  <Input
                    value={receipt.customerPhone}
                    onChange={e => setReceipt(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="Optional"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Itemized Lines Editor */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Bill Items ({receipt.items.length})
                </h4>
                <Button size="sm" variant="outline" leftIcon={<Plus size={12} />} onClick={handleAddItem} className="h-7 text-xs">
                  Add Item
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {receipt.items.map((it, idx) => (
                  <div key={it.id || idx} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={it.productName}
                        onChange={e => handleItemChange(idx, 'productName', e.target.value)}
                        placeholder="Item Name"
                        className="h-7 text-xs font-bold flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-gray-500 text-[10px] block">Qty</span>
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value) || 1)}
                          className="w-full h-7 px-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block">Price (₹)</span>
                        <input
                          type="number"
                          step="0.01"
                          value={it.unitPrice}
                          onChange={e => handleItemChange(idx, 'unitPrice', Number(e.target.value) || 0)}
                          className="w-full h-7 px-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block">Total</span>
                        <div className="h-7 flex items-center font-bold text-gray-800 dark:text-gray-200">
                          {formatINR(it.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Discount & UPI ID & Footer */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Payment &amp; Footer Notes
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={receipt.orderDiscount}
                    onChange={e => recalcTotals(receipt.items, Number(e.target.value) || 0)}
                    className="w-full h-8 px-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">UPI ID (for QR)</label>
                  <Input
                    value={receipt.upiId}
                    onChange={e => setReceipt(prev => ({ ...prev, upiId: e.target.value }))}
                    placeholder="merchant@upi"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
              <label className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Show GST on bill
                <input
                  type="checkbox"
                  checked={receipt.showTaxBreakdown}
                  onChange={e => setReceipt(prev => ({ ...prev, showTaxBreakdown: e.target.checked }))}
                  className="h-4 w-4"
                />
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Footer Message / Policy</label>
                <textarea
                  rows={2}
                  value={receipt.footerMessage}
                  onChange={e => setReceipt(prev => ({ ...prev, footerMessage: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* RIGHT / MAIN COLUMN: HYPER-REALISTIC THERMAL RECEIPT CONTAINER */}
        <div className={`${isEditing ? 'lg:col-span-6' : 'lg:col-span-12'} flex flex-col items-center justify-start p-2 sm:p-4 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 min-w-0`}>
          {/* Realistic Thermal Paper Component */}
          <div className="relative w-full max-w-[340px] transition-all duration-300">
            {/* Serrated Top Edge */}
            <div className="h-2.5 w-full bg-[radial-gradient(circle,transparent_4px,#ffffff_4px)] bg-[length:12px_12px] bg-[position:0_-6px] dark:bg-[radial-gradient(circle,transparent_4px,#ffffff_4px)]" />

            {/* Paper Body */}
            <div
              className="bg-[#ffffff] text-slate-900 px-5 py-6 shadow-2xl rounded-sm border-x border-slate-200/80 font-mono text-xs select-text relative"
              style={{
                fontFamily: '"Courier New", Courier, monospace',
                backgroundImage: 'linear-gradient(rgba(0,0,0,0.01) 1px, transparent 1px)',
                backgroundSize: '100% 4px',
              }}
            >
              {/* Paper Header Pin / Watermark */}
              <div className="text-center pb-3 mb-3 border-b-2 border-dashed border-slate-400">
                {receipt.logoURL && (
                  <div className="flex justify-center mb-2">
                    <img src={receipt.logoURL} alt="Logo" className="max-h-12 max-w-[120px] object-contain filter grayscale contrast-150" />
                  </div>
                )}
                <h2 className="font-extrabold text-base tracking-wider uppercase text-slate-950 font-sans leading-tight">
                  {receipt.businessName}
                </h2>
                {receipt.storeName && (
                  <div className="text-[11px] font-bold text-slate-700 uppercase mt-0.5 font-sans">
                    {receipt.storeName}
                  </div>
                )}
                <p className="text-[10px] text-slate-600 mt-1 leading-snug">
                  {receipt.businessAddress}
                </p>
                <div className="text-[10px] text-slate-700 font-semibold mt-1">
                  {receipt.businessPhone && <span>TEL: {receipt.businessPhone}</span>}
                </div>
                {receipt.businessGSTIN && (
                  <div className="text-[10px] font-bold text-slate-900 mt-0.5 tracking-wider font-mono">
                    GSTIN: {receipt.businessGSTIN}
                  </div>
                )}
              </div>

              {/* Bill Details */}
              <div className="text-[10px] text-slate-700 space-y-0.5 pb-2 mb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>TAX INVOICE</span>
                  <span>#{receipt.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE: {receipt.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>CUST: {receipt.customerName}</span>
                  {receipt.customerPhone && <span>PH: {receipt.customerPhone}</span>}
                </div>
              </div>

              {/* Table Column Headers */}
              <div className="flex justify-between text-[10px] font-black border-y border-slate-900 py-1 uppercase tracking-wider text-slate-950">
                <span className="w-1/2 text-left">ITEM</span>
                <span className="w-1/6 text-center">QTY</span>
                <span className="w-1/6 text-right">RATE</span>
                <span className="w-1/6 text-right">AMT</span>
              </div>

              {/* Items List */}
              <div className="py-2 divide-y divide-dashed divide-slate-200">
                {receipt.items.map((it, idx) => (
                  <div key={it.id || idx} className="py-1 text-[11px] leading-tight">
                    <div className="font-bold text-slate-950">{it.productName}</div>
                    <div className="flex justify-between text-[10px] text-slate-600 mt-0.5 font-mono">
                      <span className="w-1/2"></span>
                      <span className="w-1/6 text-center">{it.quantity}</span>
                      <span className="w-1/6 text-right">{it.unitPrice.toFixed(2)}</span>
                      <span className="w-1/6 text-right font-bold text-slate-900">{it.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotals & Taxes */}
              <div className="border-t-2 border-dashed border-slate-400 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-700">
                  <span>SUBTOTAL:</span>
                  <span>{formatINR(receipt.items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0))}</span>
                </div>

                {receipt.orderDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>DISCOUNT:</span>
                    <span>- {formatINR(receipt.orderDiscount)}</span>
                  </div>
                )}

                {receipt.showTaxBreakdown && receipt.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>GST TAX:</span>
                    <span>{formatINR(receipt.taxAmount)}</span>
                  </div>
                )}

                {/* Grand Total Highlight */}
                <div className="flex justify-between items-center text-sm font-extrabold border-y-2 border-slate-900 py-1.5 mt-1.5 text-slate-950 font-sans">
                  <span>TOTAL PAYABLE:</span>
                  <span className="text-base font-black">{formatINR(receipt.grandTotal)}</span>
                </div>

                {/* Payment Breakdown */}
                <div className="pt-1 text-[10px] text-slate-600 flex justify-between font-bold uppercase">
                  <span>PAYMENT MODE:</span>
                  <span className="text-slate-900">{receipt.paymentMethod}</span>
                </div>
                {receipt.amountPaid > 0 && (
                  <div className="text-[10px] text-slate-600 flex justify-between">
                    <span>AMOUNT PAID:</span>
                    <span>{formatINR(receipt.amountPaid)}</span>
                  </div>
                )}
                {receipt.change > 0 && (
                  <div className="text-[10px] text-slate-600 flex justify-between font-bold">
                    <span>CHANGE RETURNED:</span>
                    <span>{formatINR(receipt.change)}</span>
                  </div>
                )}
              </div>

              {/* Dynamic UPI QR Code */}
              {upiQrDataUrl && receipt.showUpiQr && (
                <div className="mt-4 pt-3 border-t border-dashed border-slate-300 text-center flex flex-col items-center">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-700 mb-1 font-sans">
                    Scan &amp; Pay Exact Bill Amount
                  </span>
                  <img src={upiQrDataUrl} alt="UPI QR" className="w-28 h-28 border border-slate-300 rounded p-1 bg-white" />
                  <span className="text-[9px] text-slate-500 mt-1 font-mono">{receipt.upiId}</span>
                </div>
              )}

              {/* Barcode Simulation */}
              <div className="mt-3 pt-2 text-center border-t border-dashed border-slate-300">
                <div className="inline-block tracking-tighter text-slate-800 text-[18px] font-mono leading-none select-none">
                  ||||| | |||| ||| || |||||| |||| ||
                </div>
                <div className="text-[8px] tracking-widest text-slate-500 font-mono mt-0.5">
                  *{receipt.invoiceNumber}*
                </div>
              </div>

              {/* Footer Note */}
              {receipt.footerMessage && (
                <div className="mt-3 text-center text-[9px] text-slate-500 leading-snug font-sans italic border-t border-dashed border-slate-200 pt-2">
                  {receipt.footerMessage}
                </div>
              )}
            </div>

            {/* Serrated Bottom Edge */}
            <div className="h-2.5 w-full bg-[radial-gradient(circle,transparent_4px,#ffffff_4px)] bg-[length:12px_12px] bg-[position:0_0] dark:bg-[radial-gradient(circle,transparent_4px,#ffffff_4px)]" />
          </div>
        </div>
      </div>
    </Modal>
  )
}
