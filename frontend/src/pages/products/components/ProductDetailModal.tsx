import { useRef, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatINR } from '@/utils/currency'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  Package, Pencil, Trash2, Tag, Download, QrCode, Barcode as BarcodeIcon,
  Layers, Truck, IndianRupee, TrendingUp, AlertTriangle, ShieldCheck, Box, CheckCircle2
} from 'lucide-react'
import { drawBarcodeToCanvas, drawQrCodeToCanvas, downloadCanvasAsPng } from '@/utils/barcodeGenerator'
import type { Product } from '@/types/product.types'

interface ProductDetailModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  categoryName?: string
  supplierName?: string
  onEdit?: (product: Product) => void
  onDelete?: (product: Product) => void
  onPrintLabel?: (product: Product) => void
}

export const ProductDetailModal = ({
  isOpen,
  onClose,
  product,
  categoryName = 'Uncategorised',
  supplierName = 'None',
  onEdit,
  onDelete,
  onPrintLabel,
}: ProductDetailModalProps) => {
  const { t } = useLanguage()
  const barcodeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (isOpen && product) {
      const barcodeText = product.barcode || product.sku || '0000000000'
      if (barcodeCanvasRef.current) {
        drawBarcodeToCanvas(barcodeCanvasRef.current, barcodeText, { height: 70, quietZone: 16 })
      }
      if (qrCanvasRef.current) {
        const qrPayload = JSON.stringify({
          name: product.name,
          sku: product.sku,
          barcode: barcodeText,
          price: product.sellingPrice,
        })
        drawQrCodeToCanvas(qrCanvasRef.current, qrPayload, 160)
      }
    }
  }, [isOpen, product])

  if (!product) return null

  const isOutOfStock = product.currentStock <= 0
  const isLowStock = product.currentStock > 0 && product.currentStock <= product.lowStockThreshold
  const costPrice = product.costPrice || 0
  const profitMargin = product.sellingPrice - costPrice
  const profitMarginPercent = costPrice > 0 ? ((profitMargin / costPrice) * 100).toFixed(1) : '100'
  const totalInventoryValue = product.currentStock * (costPrice || product.sellingPrice)

  const handleDownloadBarcode = () => {
    if (barcodeCanvasRef.current) {
      downloadCanvasAsPng(barcodeCanvasRef.current, `${product.sku || 'product'}-barcode`)
    }
  }

  const handleDownloadQr = () => {
    if (qrCanvasRef.current) {
      downloadCanvasAsPng(qrCanvasRef.current, `${product.sku || 'product'}-qrcode`)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('products.productDetail') || 'Product Details'}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onClose(); onDelete(product) }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800 transition-all active:scale-95"
                leftIcon={<Trash2 size={15} />}
              >
                {t('action.delete') || 'Delete'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {onPrintLabel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onClose(); onPrintLabel(product) }}
                leftIcon={<Tag size={15} />}
                className="transition-all active:scale-95"
              >
                {t('products.restock') || 'Print Label'}
              </Button>
            )}
            {onEdit && (
              <Button
                size="sm"
                onClick={() => { onClose(); onEdit(product) }}
                leftIcon={<Pencil size={15} />}
                className="bg-[#0a0a2e] hover:bg-[#1a1555] text-white transition-all active:scale-95 shadow-md"
              >
                {t('action.edit') || 'Edit Product'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6 max-h-[72vh] overflow-y-auto pr-1">
        {/* Header Banner Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10">
            <div className="w-20 h-20 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner group">
              {product.imageURL ? (
                <img
                  src={product.imageURL}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <Package size={36} className="text-white/70 transition-transform duration-300 group-hover:scale-110" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {categoryName}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white/90">
                  Unit: {product.unit}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isOutOfStock ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                  isLowStock ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock Warning' : 'In Stock'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight truncate">{product.name}</h2>
              <p className="text-xs text-slate-300 mt-1 font-mono flex items-center gap-2">
                <span>SKU: {product.sku}</span>
                {product.barcode && <span>• Barcode: {product.barcode}</span>}
              </p>
            </div>

            <div className="text-right sm:text-right mt-2 sm:mt-0 flex-shrink-0">
              <p className="text-2xl font-extrabold text-blue-400">{formatINR(product.sellingPrice)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {product.priceIncludesGst ? 'Incl. GST' : 'Excl. GST'} ({product.taxRate}% GST)
              </p>
            </div>
          </div>
        </div>

        {/* 2-Column Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Item Information Card */}
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Box size={14} /> Item Information
            </h4>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Item Name</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{product.name}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Category</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{categoryName}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Supplier</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{supplierName}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Product Code (SKU)</span>
                <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{product.sku}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Barcode</span>
                <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{product.barcode || 'No barcode added'}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Barcode Format</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{product.barcodeType || 'CODE128'}</span>
              </div>
            </div>
          </div>

          {/* Pricing & Financial Details Card */}
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <IndianRupee size={14} /> Pricing & Tax Details
            </h4>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Selling Price</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{formatINR(product.sellingPrice)}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Cost Price</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{formatINR(costPrice)}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Tax Type</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {product.priceIncludesGst ? 'Price includes Tax (Incl.)' : 'Price excludes Tax (Excl.)'}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">GST Slab Rate</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{product.taxRate}%</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Profit Margin per Unit</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatINR(profitMargin)} ({profitMarginPercent}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stock Management Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <Layers size={14} /> Stock Management
            </h4>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <CheckCircle2 size={13} className="text-emerald-500" /> Auto Stock Sync Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Current Stock</p>
              <p className={`text-xl font-bold mt-1 ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'}`}>
                {product.currentStock} {product.unit}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Low Stock Threshold</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {product.lowStockThreshold} {product.unit}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Total Stock Value</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {formatINR(totalInventoryValue)}
              </p>
            </div>
          </div>
        </div>

        {/* Barcode & QR Code Section with Direct Download Options */}
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <BarcodeIcon size={16} /> Product Barcode & QR Code Labels
            </h4>
            <span className="text-[11px] text-slate-400">PNG Export & Printing Ready</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Barcode Download Container */}
            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-between gap-3 shadow-inner">
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Code 128 Barcode</p>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">{product.barcode || product.sku}</p>
              </div>

              <div className="py-2 flex items-center justify-center overflow-x-auto w-full">
                <canvas ref={barcodeCanvasRef} className="max-w-full h-auto rounded" />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadBarcode}
                leftIcon={<Download size={14} />}
                className="w-full text-xs transition-all active:scale-95"
              >
                Download Barcode PNG
              </Button>
            </div>

            {/* QR Code Download Container */}
            <div className="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-between gap-3 shadow-inner">
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Quick Scan QR Code</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Contains Product SKU & Price</p>
              </div>

              <div className="py-2 flex items-center justify-center">
                <canvas ref={qrCanvasRef} className="w-36 h-36 rounded shadow-sm" />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadQr}
                leftIcon={<QrCode size={14} />}
                className="w-full text-xs transition-all active:scale-95"
              >
                Download QR Code PNG
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
