import React, { useState, useRef, useMemo, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { QRCodeSVG } from 'qrcode.react'
import {
  Printer,
  FileText,
  Bluetooth,
  Share2,
  Download,
  Edit3,
  Eye,
  Check,
  X,
  Plus,
  Trash2,
  Store,
  User,
  ShoppingBag,
  CreditCard,
  QrCode,
  Sparkles,
  Smartphone,
  RefreshCw,
} from 'lucide-react'
import { formatINR } from '@/utils/currency'
import {
  generateReceiptHTML,
  generateReceiptEscPos,
  printReceipt,
  resolveEffectiveReceiptConfig,
} from '@/utils/receipt'
import { buildUpiPayLink, isValidUpiVpa } from '@/utils/upiQr'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { useSettings } from '@/hooks/useSettings'
import type { Sale, SaleItem, AppliedBillCharge } from '@/types/sale.types'
import type { ReceiptConfig } from '@/types/settings.types'
import toast from 'react-hot-toast'

export interface RealisticReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale | null
  onSaleUpdated?: (updatedSale: Sale) => void
}

export const RealisticReceiptModal: React.FC<RealisticReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSaleUpdated,
}) => {
  const { data: settings } = useSettings()
  const {
    status: bleStatus,
    deviceName: bleDeviceName,
    isSupported: isBleSupported,
    connect: connectBlePrinter,
    print: sendBleData,
  } = useBlePrinter()

  // Active View Mode: Preview vs Inline Edit
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview')
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm')
  const [isPrinting, setIsPrinting] = useState(false)
  const [isBlePrinting, setIsBlePrinting] = useState(false)

  // Local Editable State cloned from incoming sale & store settings
  const [editableSale, setEditableSale] = useState<Sale | null>(null)
  const [editableStore, setEditableStore] = useState({
    name: '',
    phone: '',
    address: '',
    gstin: '',
    headerTitle: 'TAX INVOICE',
    logoURL: '',
    upiId: '',
    footerMessage: 'Thank you for shopping with us!',
    termsLine1: '1. Goods once sold cannot be returned.',
    termsLine2: '2. All disputes subject to local jurisdiction.',
    showLogo: true,
    showPaymentQR: true,
    showTaxBreakdown: true,
    showBarcode: true,
  })

  // Sync state whenever modal opens or sale changes
  useEffect(() => {
    if (isOpen && sale) {
      setEditableSale(JSON.parse(JSON.stringify(sale)))
      const eff = resolveEffectiveReceiptConfig(settings)
      setEditableStore({
        name: eff.companyName || settings?.businessName || 'SEZNIK RETAIL STORE',
        phone: eff.phone || settings?.businessPhone || '+91 98765 43210',
        address: eff.address || settings?.businessAddress || 'Main Market, City Center',
        gstin: eff.gstin || settings?.businessGSTIN || '',
        headerTitle: eff.headerTitle || 'TAX INVOICE',
        logoURL: eff.logoURL || settings?.businessLogoURL || '',
        upiId: eff.upiId || settings?.upiId || '',
        footerMessage: eff.footerMessage || 'Thank you for shopping with us! Please visit again.',
        termsLine1: eff.termsLine1 || '1. Goods once sold cannot be returned or exchanged.',
        termsLine2: eff.termsLine2 || '2. All disputes subject to local jurisdiction.',
        showLogo: eff.showLogo ?? true,
        showPaymentQR: Boolean(eff.showPaymentQR && (eff.upiId || settings?.upiId)),
        showTaxBreakdown: eff.showTaxBreakdown ?? true,
        showBarcode: eff.showBarcode ?? true,
      })
      setActiveTab('preview')
    }
  }, [isOpen, sale, settings])

  const receiptRef = useRef<HTMLDivElement>(null)

  // Computed Totals based on current editableSale items
  const computedTotals = useMemo(() => {
    if (!editableSale || !editableSale.items) {
      return { subtotal: 0, taxTotal: 0, discountTotal: 0, otherCharges: 0, grandTotal: 0 }
    }
    let sub = 0
    let tax = 0
    let disc = 0

    editableSale.items.forEach((item) => {
      const lineBase = (item.sellingPrice || 0) * (item.quantity || 1)
      const lineDisc = item.discount || 0
      const taxable = Math.max(0, lineBase - lineDisc)
      const taxRate = item.taxRate || 0
      const lineTax = (taxable * taxRate) / 100

      sub += lineBase
      disc += lineDisc
      tax += lineTax
    })

    const charges = (editableSale.billCharges || editableSale.appliedCharges || []) as AppliedBillCharge[]
    const otherCharges = charges.reduce((acc, c) => acc + (c.amount || 0), 0)
    const grand = Math.max(0, sub - disc + tax + otherCharges)

    return {
      subtotal: sub,
      taxTotal: tax,
      discountTotal: disc,
      otherCharges,
      grandTotal: grand,
    }
  }, [editableSale])

  if (!isOpen || !editableSale) return null

  // Helper to update item in editableSale
  const handleItemChange = (index: number, field: keyof SaleItem, value: any) => {
    if (!editableSale) return
    const nextItems = [...editableSale.items]
    const current = { ...nextItems[index], [field]: value }
    const unitPrice = Number(current.sellingPrice ?? 0)
    const qty = Number(current.quantity ?? 1)
    const discount = Number(current.discount ?? 0)
    const taxRate = Number(current.taxRate ?? 0)
    const taxable = Math.max(0, unitPrice * qty - discount)
    current.total = taxable + (taxable * taxRate) / 100

    nextItems[index] = current
    const updated = {
      ...editableSale,
      items: nextItems,
      subtotal: computedTotals.subtotal,
      grandTotal: computedTotals.grandTotal,
      finalTotal: computedTotals.grandTotal,
    }
    setEditableSale(updated)
    onSaleUpdated?.(updated)
  }

  const handleAddItem = () => {
    if (!editableSale) return
    const newItem: SaleItem = {
      productId: `custom-${Date.now()}`,
      productName: 'New Item',
      quantity: 1,
      sellingPrice: 100,
      discount: 0,
      taxRate: 0,
      taxAmount: 0,
      total: 100,
    }
    setEditableSale({
      ...editableSale,
      items: [...editableSale.items, newItem],
    })
  }

  const handleRemoveItem = (index: number) => {
    if (!editableSale || editableSale.items.length <= 1) {
      toast.error('Receipt must contain at least one item')
      return
    }
    const nextItems = editableSale.items.filter((_, i) => i !== index)
    setEditableSale({
      ...editableSale,
      items: nextItems,
    })
  }

  // Multi-Channel Printing Handlers
  const handleThermalPrint = async () => {
    setIsPrinting(true)
    try {
      const customReceiptConfig: Partial<ReceiptConfig> = {
        companyName: editableStore.name,
        phone: editableStore.phone,
        address: editableStore.address,
        gstin: editableStore.gstin,
        headerTitle: editableStore.headerTitle,
        logoURL: editableStore.logoURL,
        upiId: editableStore.upiId,
        footerMessage: editableStore.footerMessage,
        termsLine1: editableStore.termsLine1,
        termsLine2: editableStore.termsLine2,
        showLogo: editableStore.showLogo,
        showPaymentQR: editableStore.showPaymentQR,
        showTaxBreakdown: editableStore.showTaxBreakdown,
        showBarcode: editableStore.showBarcode,
      }

      const paperWidthCode: '50mm' | '80mm' = paperWidth === '58mm' ? '50mm' : '80mm'
      const receiptHTML = generateReceiptHTML({
        sale: {
          ...editableSale,
          grandTotal: computedTotals.grandTotal,
          finalTotal: computedTotals.grandTotal,
        },
        receiptConfig: customReceiptConfig,
        businessName: editableStore.name,
        businessAddress: editableStore.address,
        customerName: editableSale.customerName,
        width: paperWidthCode,
        logoURL: editableStore.logoURL,
        invoiceConfig: settings?.invoiceConfig,
      })

      printReceipt(receiptHTML, paperWidthCode, editableSale.invoiceNumber, () => setIsPrinting(false))
      toast.success(`Thermal Receipt sent to printer (${paperWidth})`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to print thermal receipt')
      setIsPrinting(false)
    }
  }

  const handleA4Print = () => {
    setIsPrinting(true)
    try {
      const customReceiptConfig: Partial<ReceiptConfig> = {
        companyName: editableStore.name,
        phone: editableStore.phone,
        address: editableStore.address,
        gstin: editableStore.gstin,
        headerTitle: editableStore.headerTitle,
        logoURL: editableStore.logoURL,
        upiId: editableStore.upiId,
        footerMessage: editableStore.footerMessage,
        termsLine1: editableStore.termsLine1,
        termsLine2: editableStore.termsLine2,
      }

      const receiptHTML = generateReceiptHTML({
        sale: {
          ...editableSale,
          grandTotal: computedTotals.grandTotal,
          finalTotal: computedTotals.grandTotal,
        },
        receiptConfig: customReceiptConfig,
        businessName: editableStore.name,
        businessAddress: editableStore.address,
        customerName: editableSale.customerName,
        width: '210mm',
        logoURL: editableStore.logoURL,
        invoiceConfig: settings?.invoiceConfig,
      })

      printReceipt(receiptHTML, '210mm', editableSale.invoiceNumber, () => setIsPrinting(false))
      toast.success('A4 Tax Invoice sent to system printer')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate A4 invoice')
      setIsPrinting(false)
    }
  }

  const handleBluetoothPrint = async () => {
    if (!isBleSupported) {
      toast.error('Bluetooth printing is not supported in this browser')
      return
    }
    if (bleStatus !== 'connected') {
      try {
        await connectBlePrinter()
      } catch {
        toast.error('Could not connect to Bluetooth printer')
        return
      }
    }
    setIsBlePrinting(true)
    try {
      const customReceiptConfig: Partial<ReceiptConfig> = {
        companyName: editableStore.name,
        phone: editableStore.phone,
        address: editableStore.address,
        gstin: editableStore.gstin,
        headerTitle: editableStore.headerTitle,
        logoURL: editableStore.logoURL,
        upiId: editableStore.upiId,
        footerMessage: editableStore.footerMessage,
        termsLine1: editableStore.termsLine1,
        termsLine2: editableStore.termsLine2,
        showLogo: editableStore.showLogo,
        showPaymentQR: editableStore.showPaymentQR,
        showBarcode: editableStore.showBarcode,
      }

      const bytes = await generateReceiptEscPos({
        sale: {
          ...editableSale,
          grandTotal: computedTotals.grandTotal,
          finalTotal: computedTotals.grandTotal,
        },
        receiptConfig: customReceiptConfig,
        paperSize: paperWidth,
        businessName: editableStore.name,
        businessAddress: editableStore.address,
        customerName: editableSale.customerName,
        businessLogoURL: editableStore.logoURL,
      })
      await sendBleData(bytes)
      toast.success(`Sent to Bluetooth Printer: ${bleDeviceName || 'Thermal Printer'}`)
    } catch (err: any) {
      toast.error(err?.message || 'Bluetooth ESC/POS print failed')
    } finally {
      setIsBlePrinting(false)
    }
  }

  const handleWhatsAppShare = () => {
    const custPhone = editableSale.customerPhone?.replace(/\D/g, '') || ''
    const lines = [
      `*${editableStore.name.toUpperCase()}*`,
      `${editableStore.address}`,
      `Phone: ${editableStore.phone}`,
      `---------------------------------`,
      `*INVOICE: ${editableSale.invoiceNumber}*`,
      `Date: ${new Date(editableSale.createdAt || Date.now()).toLocaleDateString('en-GB')}`,
      `Customer: ${editableSale.customerName || 'Cash Customer'}`,
      `---------------------------------`,
      ...editableSale.items.map(
        (it) => `${it.productName} x ${it.quantity} = Rs. ${((it.sellingPrice || 0) * (it.quantity || 1)).toFixed(2)}`
      ),
      `---------------------------------`,
      `*Total Amount: Rs. ${computedTotals.grandTotal.toFixed(2)}*`,
      `Payment: ${editableSale.paymentMethod?.toUpperCase() || 'CASH'}`,
      `---------------------------------`,
      `${editableStore.footerMessage}`,
    ]
    const text = encodeURIComponent(lines.join('\n'))
    const url = custPhone ? `https://wa.me/91${custPhone}?text=${text}` : `https://wa.me/?text=${text}`
    window.open(url, '_blank')
  }

  const upiQrString = useMemo(() => {
    if (!editableStore.upiId || !isValidUpiVpa(editableStore.upiId)) return ''
    return buildUpiPayLink({
      upiId: editableStore.upiId,
      payeeName: editableStore.name,
      amount: computedTotals.grandTotal,
      note: editableSale.invoiceNumber || 'Bill Payment',
    })
  }, [editableStore.upiId, editableStore.name, computedTotals.grandTotal, editableSale.invoiceNumber])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
    >
      <div className="bg-slate-900 border border-slate-700/80 shadow-2xl rounded-2xl overflow-hidden -m-4 sm:-m-6">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Realistic Receipt & Invoice Preview
                </h2>
                <Badge variant="info" className="text-xs">
                  Live Interactive
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Invoice #{editableSale.invoiceNumber} • {editableSale.customerName || 'Cash Sale'}
              </p>
            </div>
          </div>

          {/* View Toggle Tabs */}
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'preview'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Realistic Preview
              </button>
              <button
                onClick={() => setActiveTab('edit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'edit'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Receipt Details
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[75vh] overflow-y-auto bg-slate-900/60">
          {/* Left / Main Workspace Area */}
          <div
            className={`${
              activeTab === 'edit' ? 'lg:col-span-6 border-r border-slate-800' : 'lg:col-span-8'
            } p-6 flex flex-col items-center justify-start bg-slate-950/40`}
          >
            {/* Paper Width & Visual Controls */}
            <div className="flex items-center justify-between w-full max-w-sm mb-4 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Paper Size:
                </span>
                <div className="flex gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
                  <button
                    onClick={() => setPaperWidth('58mm')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      paperWidth === '58mm'
                        ? 'bg-slate-700 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    58 mm
                  </button>
                  <button
                    onClick={() => setPaperWidth('80mm')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      paperWidth === '80mm'
                        ? 'bg-slate-700 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    80 mm
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Thermal Ready
                </span>
              </div>
            </div>

            {/* THE PHOTOREALISTIC THERMAL RECEIPT CONTAINER */}
            <div
              ref={receiptRef}
              style={{
                width: paperWidth === '58mm' ? '300px' : '360px',
                fontFamily: "'Courier New', Courier, 'Lucida Console', monospace",
              }}
              className="relative bg-[#FAF9F5] text-slate-900 shadow-2xl rounded-sm p-5 border border-amber-900/10 transition-all select-none overflow-hidden"
            >
              {/* Realistic Top Serrated Paper Edge */}
              <div
                className="absolute top-0 left-0 right-0 h-2.5 bg-repeat-x pointer-events-none opacity-20"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 5px 0px, transparent 4px, #FAF9F5 4px)',
                  backgroundSize: '10px 10px',
                }}
              />

              {/* Merchant Logo */}
              {editableStore.showLogo && editableStore.logoURL && (
                <div className="flex justify-center mb-3">
                  <img
                    src={editableStore.logoURL}
                    alt="Logo"
                    className="max-h-12 max-w-[160px] object-contain filter grayscale contrast-150"
                    crossOrigin="anonymous"
                  />
                </div>
              )}

              {/* Store Header Info */}
              <div className="text-center pb-2">
                <h3 className="text-base font-black tracking-wider uppercase text-black leading-tight">
                  {editableStore.name}
                </h3>
                {editableStore.address && (
                  <p className="text-[11px] font-bold text-slate-700 mt-0.5 leading-snug">
                    {editableStore.address}
                  </p>
                )}
                {editableStore.phone && (
                  <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                    Tel: {editableStore.phone}
                  </p>
                )}
                {editableStore.gstin && (
                  <p className="text-[11px] font-bold text-slate-900 mt-0.5 tracking-wider">
                    GSTIN: {editableStore.gstin}
                  </p>
                )}
              </div>

              {/* Perforated Divider */}
              <div className="border-b-2 border-dashed border-slate-900 my-2" />

              {/* Invoice Meta */}
              <div className="text-center my-1">
                <span className="inline-block px-2 py-0.5 text-xs font-black uppercase tracking-widest border border-slate-900">
                  {editableStore.headerTitle}
                </span>
              </div>

              <div className="text-[11px] text-slate-800 space-y-0.5 my-1.5 font-bold">
                <div className="flex justify-between">
                  <span>INVOICE NO:</span>
                  <span className="font-black text-black">#{editableSale.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE / TIME:</span>
                  <span>
                    {new Date(editableSale.createdAt || Date.now()).toLocaleDateString('en-GB')}{' '}
                    {new Date(editableSale.createdAt || Date.now()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {editableSale.customerName && (
                  <div className="flex justify-between">
                    <span>CUSTOMER:</span>
                    <span className="text-black uppercase">{editableSale.customerName}</span>
                  </div>
                )}
                {editableSale.customerPhone && (
                  <div className="flex justify-between">
                    <span>CUST PHONE:</span>
                    <span>{editableSale.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>PAYMENT MODE:</span>
                  <span className="font-black text-black uppercase">
                    {editableSale.paymentMethod || 'CASH'}
                  </span>
                </div>
              </div>

              {/* Perforated Divider */}
              <div className="border-b-2 border-dashed border-slate-900 my-2" />

              {/* Itemized Table Header */}
              <div className="text-[11px] font-black text-black grid grid-cols-12 pb-1 uppercase border-b border-slate-900">
                <span className="col-span-6">ITEM / DESC</span>
                <span className="col-span-2 text-center">QTY</span>
                <span className="col-span-2 text-right">RATE</span>
                <span className="col-span-2 text-right">AMT</span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-dashed divide-slate-300 py-1">
                {editableSale.items.map((item, idx) => {
                  const rate = item.sellingPrice || 0
                  const lineTotal = rate * item.quantity - (item.discount || 0)
                  return (
                    <div key={idx} className="py-1 text-[11px] font-bold text-slate-900">
                      <div className="grid grid-cols-12 items-center">
                        <span className="col-span-6 truncate pr-1 font-black">{item.productName}</span>
                        <span className="col-span-2 text-center">{item.quantity}</span>
                        <span className="col-span-2 text-right">{rate.toFixed(1)}</span>
                        <span className="col-span-2 text-right font-black">
                          {lineTotal.toFixed(2)}
                        </span>
                      </div>
                      {item.discount > 0 && (
                        <div className="text-[10px] text-slate-600 pl-1">
                          Disc: -₹{item.discount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Perforated Divider */}
              <div className="border-b-2 border-dashed border-slate-900 my-2" />

              {/* Calculations Breakdown */}
              <div className="text-[11px] font-bold text-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span>SUBTOTAL ({editableSale.items.length} Items):</span>
                  <span className="text-black">₹{computedTotals.subtotal.toFixed(2)}</span>
                </div>
                {computedTotals.discountTotal > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>DISCOUNT SAVINGS:</span>
                    <span>-₹{computedTotals.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                {editableStore.showTaxBreakdown && computedTotals.taxTotal > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>TOTAL GST:</span>
                    <span>+₹{computedTotals.taxTotal.toFixed(2)}</span>
                  </div>
                )}
                {computedTotals.otherCharges > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>ADDITIONAL CHARGES:</span>
                    <span>+₹{computedTotals.otherCharges.toFixed(2)}</span>
                  </div>
                )}

                {/* Grand Total Box */}
                <div className="border-2 border-slate-900 p-1.5 my-2 flex justify-between items-center font-black text-sm bg-slate-100/60">
                  <span className="text-black">GRAND TOTAL:</span>
                  <span className="text-base text-black font-black">
                    ₹{computedTotals.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* UPI QR Code Section */}
              {editableStore.showPaymentQR && upiQrString && (
                <div className="text-center my-3 pt-1 flex flex-col items-center">
                  <p className="text-[10px] font-black tracking-wider uppercase text-black mb-1">
                    •• SCAN TO PAY VIA UPI ••
                  </p>
                  <div className="p-1.5 bg-white border border-slate-900 rounded-sm inline-block shadow-sm">
                    <QRCodeSVG value={upiQrString} size={paperWidth === '58mm' ? 84 : 100} />
                  </div>
                  <p className="text-[9px] font-bold text-slate-700 mt-1">UPI ID: {editableStore.upiId}</p>
                </div>
              )}

              {/* Barcode */}
              {editableStore.showBarcode && (
                <div className="text-center my-2 pt-1 flex flex-col items-center">
                  <div className="font-mono text-xs tracking-widest font-black text-black">
                    *#{editableSale.invoiceNumber}*
                  </div>
                  <div
                    className="w-44 h-8 bg-repeat-x my-0.5 opacity-80"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 7px, transparent 7px, transparent 9px)',
                    }}
                  />
                </div>
              )}

              {/* Footer Notes & Terms */}
              <div className="text-center text-[10px] font-bold text-slate-700 border-t border-dashed border-slate-400 pt-2 mt-2 space-y-0.5">
                <p className="font-black text-black text-[11px]">{editableStore.footerMessage}</p>
                {editableStore.termsLine1 && <p>{editableStore.termsLine1}</p>}
                {editableStore.termsLine2 && <p>{editableStore.termsLine2}</p>}
              </div>

              {/* Realistic Bottom Tear Edge */}
              <div
                className="absolute bottom-0 left-0 right-0 h-2 bg-repeat-x pointer-events-none opacity-25"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 5px 8px, transparent 4px, #FAF9F5 4px)',
                  backgroundSize: '10px 10px',
                }}
              />
            </div>
          </div>

          {/* Right Panel: Inline Editor (when tab === 'edit') OR Quick Action Triggers */}
          <div
            className={`${
              activeTab === 'edit' ? 'lg:col-span-6' : 'lg:col-span-4'
            } p-6 flex flex-col justify-between bg-slate-900 border-t lg:border-t-0 border-slate-800`}
          >
            {activeTab === 'edit' ? (
              /* LIVE INLINE EDITOR CONTROLS */
              <div className="space-y-4 pr-1">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-400" />
                    Live Receipt Customizer
                  </h4>
                  <span className="text-[11px] text-slate-400">Edits reflect in print instantly</span>
                </div>

                {/* Store Details Section */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-400" /> Store Header
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold">Business Name</span>
                      <Input
                        value={editableStore.name}
                        onChange={(e) => setEditableStore({ ...editableStore, name: e.target.value })}
                        placeholder="Store Name"
                        className="bg-slate-950 border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold">Phone</span>
                      <Input
                        value={editableStore.phone}
                        onChange={(e) => setEditableStore({ ...editableStore, phone: e.target.value })}
                        placeholder="Contact No"
                        className="bg-slate-950 border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold">Address</span>
                      <Input
                        value={editableStore.address}
                        onChange={(e) => setEditableStore({ ...editableStore, address: e.target.value })}
                        placeholder="Store Address"
                        className="bg-slate-950 border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold">GSTIN</span>
                      <Input
                        value={editableStore.gstin}
                        onChange={(e) => setEditableStore({ ...editableStore, gstin: e.target.value })}
                        placeholder="27AAAAA0000A1Z5"
                        className="bg-slate-950 border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Invoice & Customer Info */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" /> Customer & Bill Info
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold">Invoice No</span>
                      <Input
                        value={editableSale.invoiceNumber}
                        onChange={(e) => setEditableSale({ ...editableSale, invoiceNumber: e.target.value })}
                        className="bg-slate-950 border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold">Customer Name</span>
                      <Input
                        value={editableSale.customerName || ''}
                        onChange={(e) => setEditableSale({ ...editableSale, customerName: e.target.value })}
                        placeholder="Cash Customer"
                        className="bg-slate-950 border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Line Items Editor */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-blue-400" /> Items List
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddItem}
                      className="h-6 text-[11px] border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Line
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {editableSale.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={item.productName}
                            onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                            placeholder="Item Name"
                            className="h-7 text-xs bg-slate-900 border-slate-700 text-white flex-1"
                          />
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-400 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500">Qty</span>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                              className="h-7 text-xs bg-slate-900 border-slate-700 text-white"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500">Rate (₹)</span>
                            <Input
                              type="number"
                              value={item.sellingPrice || 0}
                              onChange={(e) =>
                                handleItemChange(idx, 'sellingPrice', Number(e.target.value))
                              }
                              className="h-7 text-xs bg-slate-900 border-slate-700 text-white"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500">Disc (₹)</span>
                            <Input
                              type="number"
                              value={item.discount || 0}
                              onChange={(e) => handleItemChange(idx, 'discount', Number(e.target.value))}
                              className="h-7 text-xs bg-slate-900 border-slate-700 text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* UPI & Footer Controls */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold">UPI VPA for QR</span>
                      <Input
                        value={editableStore.upiId}
                        onChange={(e) => setEditableStore({ ...editableStore, upiId: e.target.value })}
                        placeholder="merchant@upi"
                        className="bg-slate-950 border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold">Footer Message</span>
                      <Input
                        value={editableStore.footerMessage}
                        onChange={(e) =>
                          setEditableStore({ ...editableStore, footerMessage: e.target.value })
                        }
                        className="bg-slate-950 border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* QUICK ACTIONS & SUMMARY PANEL */
              <div className="space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                    <Printer className="w-4 h-4 text-blue-400" />
                    Print & Share Hub
                  </h4>
                  <p className="text-xs text-slate-400">
                    Ready to print to any Thermal Roll, Desktop Printer, or Bluetooth device.
                  </p>
                </div>

                {/* Bill Highlights Card */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Total Items:</span>
                    <span className="font-bold text-slate-200">
                      {editableSale.items.reduce((acc, i) => acc + (i.quantity || 1), 0)} Units
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Payment Mode:</span>
                    <span className="font-bold text-slate-200 uppercase">
                      {editableSale.paymentMethod || 'Cash'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
                    <span>Payable Amount:</span>
                    <span className="text-emerald-400 text-base">
                      ₹{computedTotals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Bluetooth Printer Status Indicator */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        bleStatus === 'connected'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Bluetooth className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {bleStatus === 'connected'
                          ? bleDeviceName || 'Thermal Bluetooth Printer'
                          : 'Bluetooth Thermal Printer'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {bleStatus === 'connected' ? 'Ready to stream raw ESC/POS' : 'Not Connected'}
                      </p>
                    </div>
                  </div>

                  {isBleSupported && (
                    <Button
                      size="sm"
                      variant={bleStatus === 'connected' ? 'outline' : 'primary'}
                      onClick={connectBlePrinter}
                      className={`h-7 text-xs font-semibold ${
                        bleStatus === 'connected'
                          ? 'border-emerald-500/30 text-emerald-400'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {bleStatus === 'connected' ? 'Re-pair' : 'Connect'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Action Triggers Bar */}
            <div className="pt-4 mt-4 border-t border-slate-800 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  onClick={handleThermalPrint}
                  disabled={isPrinting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-11 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {isPrinting ? 'Sending...' : `Thermal Print (${paperWidth})`}
                </Button>

                <Button
                  onClick={handleBluetoothPrint}
                  disabled={isBlePrinting}
                  variant="outline"
                  className="w-full border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-200 font-bold h-11 rounded-xl flex items-center justify-center gap-2"
                >
                  <Bluetooth className="w-4 h-4 text-emerald-400" />
                  {isBlePrinting ? 'Streaming...' : 'Bluetooth ESC/POS'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  onClick={handleA4Print}
                  variant="outline"
                  className="w-full border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300 font-semibold h-9 text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  A4 Tax Invoice
                </Button>

                <Button
                  onClick={handleWhatsAppShare}
                  variant="outline"
                  className="w-full border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 font-semibold h-9 text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  WhatsApp Bill
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
