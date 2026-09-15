import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchApi } from '@/services/api'
import { toUserMessage } from '@/utils/userMessage'
import { Printer, Share2, FileText, CheckCircle, AlertCircle, Phone, MapPin, Building2, Download } from 'lucide-react'

interface SaleItem {
  id?: string
  name?: string
  productName?: string
  quantity?: number
  qty?: number
  price?: number
  sellingPrice?: number
  taxRate?: number
  taxAmount?: number
  discount?: number
  total?: number
  unit?: string
  sku?: string
}

interface PublicInvoiceData {
  sale: {
    id: string
    invoiceNumber: string
    createdAt: string
    paymentMethod: string
    subtotal: number
    totalDiscount: number
    totalTax: number
    grandTotal: number
    amountPaid?: number
    changeReturned?: number
    billCharges?: any[]
    extraChargesTotal?: number
    items: SaleItem[]
  }
  customer: {
    name: string
    phone?: string
    email?: string
    address?: string
    gstin?: string
  } | null
  store: {
    storeName: string
    storeAddress?: string
    storePhone?: string
    storeGstin?: string
    storeLogoUrl?: string
    upiId?: string
    footerMessage?: string
    terms?: string[]
    invoiceTerms?: string
  }
}

export function PublicInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PublicInvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let isMounted = true

    const loadInvoice = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetchApi(`/public/receipt/${encodeURIComponent(id)}`)
        if (isMounted) {
          setData(res)
        }
      } catch (err: any) {
        if (isMounted) {
          setError(toUserMessage(err, 'Invoice could not be loaded. Please verify the link or try again later.'))
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadInvoice()
    return () => {
      isMounted = false
    }
  }, [id])

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Tax Invoice #${data?.sale.invoiceNumber || id}`,
          text: `View Tax Invoice from ${data?.store.storeName || 'Store'}`,
          url: window.location.href,
        })
      } catch {
        // User dismissed share dialog
      }
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert('Invoice link copied to clipboard!')
    }
  }

  const formatMoney = (n?: number) => {
    const val = typeof n === 'number' && !isNaN(n) ? n : 0
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-base font-bold text-slate-800">Loading Invoice...</h2>
          <p className="text-xs text-slate-500 mt-1">Retrieving official digital bill</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Invoice Not Found</h2>
          <p className="text-xs text-slate-500 mb-6">{error || 'The requested invoice is unavailable or has expired.'}</p>
        </div>
      </div>
    )
  }

  const { sale, customer, store } = data
  const dateStr = new Date(sale.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const timeStr = new Date(sale.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white print:p-0">
      {/* Action Header - Hidden on Print */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block leading-tight">Digital Tax Invoice</span>
              <span className="text-[11px] text-slate-500">#{sale.invoiceNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition"
            >
              <Share2 size={14} />
              Share
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition"
            >
              <Download size={14} />
              Print / Save PDF
            </button>
          </div>
        </div>
      </header>

      {/* Main A4 Document Body */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 print:border-none print:shadow-none print:p-0">
          
          {/* Header Row: Store Info & Tax Invoice Badge */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-100 pb-6 mb-6">
            <div className="flex items-start gap-4">
              {store.storeLogoUrl ? (
                <img
                  src={store.storeLogoUrl}
                  alt="Store Logo"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl border border-slate-200 p-1"
                />
              ) : null}
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{store.storeName}</h1>
                {store.storeAddress && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-600 mt-1">
                    <MapPin size={13} className="shrink-0 mt-0.5 text-slate-400" />
                    <span>{store.storeAddress}</span>
                  </div>
                )}
                {store.storePhone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                    <Phone size={13} className="text-slate-400" />
                    <span>{store.storePhone}</span>
                  </div>
                )}
                {store.storeGstin && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 mt-0.5 font-medium">
                    <Building2 size={13} className="text-slate-400" />
                    <span>GSTIN: <strong>{store.storeGstin}</strong></span>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:text-right w-full sm:w-auto bg-slate-50 sm:bg-transparent p-4 sm:p-0 rounded-xl border sm:border-none border-slate-100">
              <span className="text-sm font-extrabold text-blue-600 tracking-wider uppercase block mb-1">
                TAX INVOICE
              </span>
              <div className="text-xs text-slate-600">
                Invoice No: <strong className="text-slate-900 font-bold">#{sale.invoiceNumber}</strong>
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Date: <strong className="text-slate-900">{dateStr}</strong> at {timeStr}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Mode: <strong className="text-slate-900 uppercase">{sale.paymentMethod}</strong>
              </div>
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle size={11} />
                  PAID
                </span>
              </div>
            </div>
          </div>

          {/* Customer / Bill To Details */}
          {customer ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                  Billed To (Customer)
                </span>
                <div className="text-sm font-bold text-slate-900">{customer.name}</div>
                {customer.phone && <div className="text-xs text-slate-600 mt-0.5">Phone: {customer.phone}</div>}
                {customer.email && <div className="text-xs text-slate-600">Email: {customer.email}</div>}
              </div>
              {(customer.address || customer.gstin) && (
                <div className="sm:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Customer Tax & Address
                  </span>
                  {customer.address && <div className="text-xs text-slate-600">{customer.address}</div>}
                  {customer.gstin && <div className="text-xs text-slate-700 font-medium">GSTIN: <strong>{customer.gstin}</strong></div>}
                </div>
              )}
            </div>
          ) : null}

          {/* Items Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-y-2 border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-right">Price</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Discount</th>
                  <th className="py-2.5 px-3 text-center">Tax %</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sale.items.map((item, idx) => {
                  const name = item.productName || item.name || 'Item'
                  const qty = item.quantity ?? item.qty ?? 1
                  const price = item.sellingPrice ?? item.price ?? 0
                  const discount = item.discount || 0
                  const taxRate = item.taxRate || 0
                  const total = item.total ?? (price * qty - discount)

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{name}</div>
                        {item.sku ? <div className="text-[10px] text-slate-400">SKU: {item.sku}</div> : null}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">{formatMoney(price)}</td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-900">{qty}</td>
                      <td className="py-3 px-3 text-right text-slate-500">
                        {discount > 0 ? <span className="text-red-600 font-medium">-{formatMoney(discount)}</span> : '—'}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500">
                        {taxRate > 0 ? `${taxRate}%` : '0%'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">{formatMoney(total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
            <div className="text-xs text-slate-500 space-y-1">
              <div className="font-bold text-slate-800">Thank you for your business!</div>
              <p>{store.footerMessage}</p>
              {sale.amountPaid !== undefined && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <div>Paid: <strong>{formatMoney(sale.amountPaid)}</strong> via {sale.paymentMethod.toUpperCase()}</div>
                  {sale.changeReturned && sale.changeReturned > 0 ? (
                    <div>Change Returned: <strong>{formatMoney(sale.changeReturned)}</strong></div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatMoney(sale.subtotal)}</span>
              </div>
              {sale.totalDiscount > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Total Discount</span>
                  <span>-{formatMoney(sale.totalDiscount)}</span>
                </div>
              )}
              {sale.totalTax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>GST / Tax Total</span>
                  <span>+{formatMoney(sale.totalTax)}</span>
                </div>
              )}
              {sale.extraChargesTotal && sale.extraChargesTotal > 0 ? (
                <div className="flex justify-between text-slate-600">
                  <span>Add-ons / Surcharges</span>
                  <span>+{formatMoney(sale.extraChargesTotal)}</span>
                </div>
              ) : null}
              <div className="border-t-2 border-dashed border-slate-300 pt-2 flex justify-between text-sm font-black text-slate-900">
                <span>Grand Total</span>
                <span className="text-blue-600">{formatMoney(sale.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          {store.terms && store.terms.length > 0 ? (
            <div className="mt-8 pt-4 border-t border-slate-200 text-[11px] text-slate-500">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                Terms & Conditions
              </h4>
              <ol className="list-decimal pl-4 space-y-0.5">
                {store.terms.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* Computer Generated Footer */}
          <div className="mt-8 text-center text-[10px] text-slate-400">
            This is an authentic computer-generated digital tax invoice verified by Seznik POS.
          </div>
        </div>
      </main>
    </div>
  )
}
