import React, { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import type { Product } from '@/types/product.types'
import { useSettings } from '@/hooks/useSettings'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { formatINR } from '@/utils/currency'
import { generateLabelEscPos, generateLabelTspl, defaultLabelTemplate, resolveElementText, type LabelData } from '@/utils/labelPrint'
import { drawBarcodeToCanvas, drawQrCodeToCanvas } from '@/utils/barcodeGenerator'
import {
  Printer,
  Bluetooth,
  Hash,
  CheckCircle2,
  Trash2,
  Edit3,
  Layers,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckSquare,
  Square,
  RotateCcw,
  Sliders,
  Tag,
  Sparkles,
  Plus,
  Filter,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'

export interface ConsecutiveProductConfig {
  product: Product
  copies: number
  prefix: string
  startNum: number
  padZeroes: number
  selected: boolean
  /** Individual custom sequence overrides per label index (0-indexed) */
  customLabels: string[]
}

interface ConsecutiveLabelModalProps {
  isOpen: boolean
  onClose: () => void
  selectedProducts: Product[]
  allProducts?: Product[]
}

export const ConsecutiveLabelModal: React.FC<ConsecutiveLabelModalProps> = ({
  isOpen,
  onClose,
  selectedProducts,
  allProducts = []
}) => {
  const { data: settings } = useSettings()
  const { status: bleStatus, deviceName: bleDeviceName, isSupported: isBleSupported, connect: connectBlePrinter, print: sendBleData } = useBlePrinter()

  const [productConfigs, setProductConfigs] = useState<ConsecutiveProductConfig[]>([])
  
  // Global Sequence & Formatting Controls
  const [globalPrefix, setGlobalPrefix] = useState('No.')
  const [globalStartNum, setGlobalStartNum] = useState(1)
  const [globalPadZeroes, setGlobalPadZeroes] = useState(2)
  const [globalCopies, setGlobalCopies] = useState(1)
  const [isContinuousBatchSeq, setIsContinuousBatchSeq] = useState(true)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)

  const [labelFormat, setLabelFormat] = useState<'CODE128' | 'EAN13' | 'QR'>('CODE128')
  const [previewIndex, setPreviewIndex] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Initialize product configurations when modal opens or selectedProducts changes
  useEffect(() => {
    if (isOpen) {
      const sourceList = selectedProducts.length > 0 ? selectedProducts : allProducts
      if (sourceList.length > 0) {
        const initial = sourceList.map(p => ({
          product: p,
          copies: globalCopies > 0 ? globalCopies : 1,
          prefix: globalPrefix,
          startNum: globalStartNum,
          padZeroes: globalPadZeroes,
          selected: true,
          customLabels: []
        }))
        const recomputed = recalculateSequences(initial, globalPrefix, globalStartNum, globalPadZeroes, isContinuousBatchSeq)
        setProductConfigs(recomputed)
        setPreviewIndex(0)
      }
    }
  }, [isOpen, selectedProducts])

  // Helper to format a sequence number string
  const formatSeqNo = (prefix: string, num: number, padZeroes: number): string => {
    const numStr = num.toString().padStart(padZeroes, '0')
    const pfx = prefix ? prefix.trim() : ''
    return pfx ? `${pfx} ${numStr}` : numStr
  }

  // Recalculates sequence strings across all products (continuous or per-product)
  const recalculateSequences = (
    configs: ConsecutiveProductConfig[],
    prefix: string,
    startNum: number,
    padZeroes: number,
    isContinuous: boolean
  ): ConsecutiveProductConfig[] => {
    let runningNum = startNum

    return configs.map(item => {
      if (!item.selected) {
        return { ...item, customLabels: [] }
      }

      const itemStartNum = isContinuous ? runningNum : item.startNum
      const customLabels = Array.from({ length: item.copies }, (_, i) => {
        const curNum = isContinuous ? (runningNum + i) : (itemStartNum + i)
        return formatSeqNo(isContinuous ? prefix : item.prefix, curNum, padZeroes)
      })

      if (isContinuous) {
        runningNum += item.copies
      }

      return {
        ...item,
        prefix: isContinuous ? prefix : item.prefix,
        startNum: itemStartNum,
        padZeroes,
        customLabels
      }
    })
  }

  const handleUpdateGlobalSettings = (newPrefix: string, newStart: number, newPad: number, newCopies: number, newContinuous: boolean) => {
    setGlobalPrefix(newPrefix)
    setGlobalStartNum(newStart)
    setGlobalPadZeroes(newPad)
    setGlobalCopies(newCopies)
    setIsContinuousBatchSeq(newContinuous)

    setProductConfigs(prev => {
      const updated = prev.map(item => ({
        ...item,
        copies: newCopies > 0 ? newCopies : item.copies,
        prefix: newPrefix,
        startNum: newStart,
        padZeroes: newPad
      }))
      return recalculateSequences(updated, newPrefix, newStart, newPad, newContinuous)
    })
  }

  const handleToggleProductSelection = (configIdx: number, selected: boolean) => {
    setProductConfigs(prev => {
      const updated = prev.map((item, idx) => idx === configIdx ? { ...item, selected } : item)
      return recalculateSequences(updated, globalPrefix, globalStartNum, globalPadZeroes, isContinuousBatchSeq)
    })
  }

  const handleToggleSelectAll = (checked: boolean) => {
    setProductConfigs(prev => {
      const updated = prev.map(item => ({ ...item, selected: checked }))
      return recalculateSequences(updated, globalPrefix, globalStartNum, globalPadZeroes, isContinuousBatchSeq)
    })
  }

  const handleUpdateProductCopies = (configIdx: number, copies: number) => {
    const safeCopies = Math.max(1, copies)
    setProductConfigs(prev => {
      const updated = prev.map((item, idx) => idx === configIdx ? { ...item, copies: safeCopies } : item)
      return recalculateSequences(updated, globalPrefix, globalStartNum, globalPadZeroes, isContinuousBatchSeq)
    })
  }

  const handleUpdateProductStartNum = (configIdx: number, startNum: number) => {
    setProductConfigs(prev => {
      const updated = prev.map((item, idx) => idx === configIdx ? { ...item, startNum } : item)
      return recalculateSequences(updated, globalPrefix, globalStartNum, globalPadZeroes, isContinuousBatchSeq)
    })
  }

  const handleUpdateProductPrefix = (configIdx: number, prefix: string) => {
    setProductConfigs(prev => {
      const updated = prev.map((item, idx) => idx === configIdx ? { ...item, prefix } : item)
      return recalculateSequences(updated, globalPrefix, globalStartNum, globalPadZeroes, isContinuousBatchSeq)
    })
  }

  const handleUpdateIndividualLabelSeq = (configIdx: number, labelIdx: number, val: string) => {
    setProductConfigs(prev =>
      prev.map((item, idx) => {
        if (idx !== configIdx) return item
        const updatedLabels = [...item.customLabels]
        updatedLabels[labelIdx] = val
        return { ...item, customLabels: updatedLabels }
      })
    )
  }

  const handleRemoveProduct = (configIdx: number) => {
    setProductConfigs(prev => {
      const updated = prev.filter((_, idx) => idx !== configIdx)
      return recalculateSequences(updated, globalPrefix, globalStartNum, globalPadZeroes, isContinuousBatchSeq)
    })
  }

  const handleAddProductToBatch = (prod: Product) => {
    if (productConfigs.some(c => c.product.id === prod.id)) {
      toast.error(`"${prod.name}" is already in the batch list.`)
      return
    }

    const newConfig: ConsecutiveProductConfig = {
      product: prod,
      copies: globalCopies > 0 ? globalCopies : 1,
      prefix: globalPrefix,
      startNum: globalStartNum,
      padZeroes: globalPadZeroes,
      selected: true,
      customLabels: []
    }

    setProductConfigs(prev => {
      const updated = [...prev, newConfig]
      return recalculateSequences(updated, globalPrefix, globalStartNum, globalPadZeroes, isContinuousBatchSeq)
    })
    toast.success(`Added "${prod.name}" to consecutive label batch!`)
  }

  // Filter product configs by search query
  const filteredConfigs = productConfigs.filter(cfg =>
    cfg.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cfg.product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cfg.product.barcode && cfg.product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Calculate total expanded label stickers across SELECTED products
  const flatLabelsList = productConfigs
    .filter(cfg => cfg.selected)
    .flatMap(cfg =>
      cfg.customLabels.map((seqNo, labelIdx) => ({
        product: cfg.product,
        seqNo,
        labelIdx: labelIdx + 1,
        totalCopies: cfg.copies,
        configId: cfg.product.id
      }))
    )

  const selectedProductsCount = productConfigs.filter(c => c.selected).length
  const totalStickersCount = flatLabelsList.length
  const currentPreviewLabel = flatLabelsList[previewIndex] || flatLabelsList[0]

  // Render canvas barcode preview
  useEffect(() => {
    if (canvasRef.current && currentPreviewLabel) {
      const code = currentPreviewLabel.product.barcode || currentPreviewLabel.product.sku || '0000000000'
      if (labelFormat === 'QR') {
        drawQrCodeToCanvas(canvasRef.current, code, 90)
      } else {
        drawBarcodeToCanvas(canvasRef.current, code, { height: 42, barWidth: 2 })
      }
    }
  }, [currentPreviewLabel, labelFormat, previewIndex])

  // Bluetooth Thermal Label Print (TSPL/ESC-POS)
  const handlePrintToBlePrinter = async () => {
    if (flatLabelsList.length === 0) {
      toast.error('Please select at least 1 product to print.')
      return
    }

    if (bleStatus !== 'connected') {
      toast.error('Bluetooth label printer is not connected. Please connect your printer first.')
      return
    }

    const businessName = settings?.businessName || 'SEZNIK RETAIL'
    const template = settings?.printerConfig?.labelTemplate || defaultLabelTemplate
    const mode = settings?.printerConfig?.labelPrinterMode || 'tspl'
    const w = settings?.printerConfig?.labelWidth || 50
    const h = settings?.printerConfig?.labelHeight || 30
    const offX = settings?.printerConfig?.labelOffsetX || 0
    const offY = settings?.printerConfig?.labelOffsetY || 0
    const dir = settings?.printerConfig?.labelDirection || 0

    try {
      toast.loading(`Printing ${flatLabelsList.length} consecutive sticker labels...`, { id: 'ble-print' })

      for (let i = 0; i < flatLabelsList.length; i++) {
        const item = flatLabelsList[i]
        const labelData: LabelData = {
          businessName,
          productName: item.product.name,
          price: formatINR(item.product.sellingPrice),
          barcodeValue: item.product.barcode || item.product.sku || '0000000000',
          sku: item.product.sku,
          sequenceNo: item.seqNo
        }

        let bytes: Uint8Array
        if (mode === 'escpos') {
          bytes = generateLabelEscPos(template, labelFormat, labelData)
        } else {
          bytes = generateLabelTspl(template, labelFormat, labelData, w, h, offX, offY, 38, dir, 0)
        }

        await sendBleData(bytes)
      }

      toast.success(`Printed all ${flatLabelsList.length} consecutive labels successfully!`, { id: 'ble-print' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bluetooth label print error'
      toast.error(msg, { id: 'ble-print' })
    }
  }

  // Browser Standard Print / Grid PDF Print
  const handleBrowserPrintLabels = () => {
    if (flatLabelsList.length === 0) {
      toast.error('Please select at least 1 product to print.')
      return
    }

    const printWin = window.open('', '_blank', 'width=900,height=700')
    if (!printWin) {
      toast.error('Browser blocked print window popup. Please allow popups.')
      return
    }

    const businessName = settings?.businessName || 'SEZNIK RETAIL'

    const stickerCardsHtml = flatLabelsList.map((item) => `
      <div className="label-card">
        <div className="seq-badge">${item.seqNo}</div>
        <div className="biz-name">${businessName}</div>
        <div className="prod-name">${item.product.name}</div>
        <div className="barcode-box">
          <div className="barcode-code">${item.product.barcode || item.product.sku || '000000'}</div>
        </div>
        <div className="price-tag">MRP: ${formatINR(item.product.sellingPrice)}</div>
      </div>
    `).join('')

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Consecutive Sticker Labels - SEZ AI</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 10px;
              background: #fff;
              color: #000;
            }
            .header-bar {
              text-align: center;
              margin-bottom: 15px;
              font-size: 14px;
              font-weight: bold;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8mm;
            }
            .label-card {
              border: 1.5px dashed #333;
              border-radius: 6px;
              padding: 8px;
              text-align: center;
              position: relative;
              background: #fff;
              page-break-inside: avoid;
              min-height: 120px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .seq-badge {
              position: absolute;
              top: 4px;
              right: 6px;
              background: #000;
              color: #fff;
              font-size: 10px;
              font-weight: bold;
              padding: 2px 6px;
              border-radius: 4px;
            }
            .biz-name {
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .prod-name {
              font-size: 12px;
              font-weight: 700;
              margin: 4px 0;
            }
            .barcode-box {
              margin: 4px 0;
              border: 1px solid #ddd;
              padding: 4px;
              border-radius: 4px;
            }
            .barcode-code {
              font-family: monospace;
              font-size: 12px;
              font-weight: bold;
              letter-spacing: 1px;
            }
            .price-tag {
              font-size: 13px;
              font-weight: bold;
            }
            @media print {
              .no-print { display: none; }
              .grid-container { gap: 6mm; }
            }
          </style>
        </head>
        <body>
          <div className="header-bar no-print">
            Consecutive Billing Labels (${flatLabelsList.length} Stickers) - Click Print below
            <br>
            <button onclick="window.print()" style="margin-top:8px; padding:6px 16px; background:#4f46e5; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Print All Labels Now</button>
          </div>
          <div className="grid-container">
            ${stickerCardsHtml}
          </div>
          <script>
            setTimeout(() => { window.print(); }, 500);
          </script>
        </body>
      </html>
    `)
    printWin.document.close()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🏷️ Consecutive Label Billing & Sticker Printing"
      size="xl"
    >
      <div className="space-y-5">
        {/* Printer Bluetooth Connection Status Banner */}
        <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
          bleStatus === 'connected'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
            : bleStatus === 'connecting'
            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              bleStatus === 'connected'
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                : bleStatus === 'connecting'
                ? 'bg-blue-500 text-white animate-spin'
                : 'bg-amber-500 text-white'
            }`}>
              <Bluetooth size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {bleStatus === 'connected' ? 'Connected Printer' : bleStatus === 'connecting' ? 'Connecting Printer...' : 'No Printer Connected'}
                </span>
                {bleStatus === 'connected' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100 text-[10px] font-bold">
                    READY
                  </span>
                )}
              </div>
              <p className="text-xs font-medium opacity-90 mt-0.5">
                {bleStatus === 'connected'
                  ? (bleDeviceName || 'Seznik Dev Dual Mode Printer')
                  : 'Connect your Bluetooth Thermal Label Printer to print consecutive stickers directly.'}
              </p>
            </div>
          </div>

          {bleStatus !== 'connected' && isBleSupported && (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Bluetooth size={14} />}
              onClick={() => connectBlePrinter()}
              loading={bleStatus === 'connecting'}
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-sm"
            >
              Connect Printer
            </Button>
          )}
        </div>

        {/* Global Sequence Numbering Toolbar */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-blue-900/10 dark:from-purple-900/30 dark:via-indigo-900/30 dark:to-blue-900/30 border border-purple-200 dark:border-purple-800/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-200">
              <Hash className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Consecutive Sequence & Batch Label Settings</span>
            </div>

            {/* Continuous Batch Sequence Mode Toggle */}
            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 px-3 py-1 rounded-lg border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-900 dark:text-purple-100 shadow-sm">
              <input
                type="checkbox"
                checked={isContinuousBatchSeq}
                onChange={e => handleUpdateGlobalSettings(globalPrefix, globalStartNum, globalPadZeroes, globalCopies, e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span>Continuous Sequence Across Batch ({isContinuousBatchSeq ? 'ON (01, 02, 03...)' : 'OFF (Per-Product)'})</span>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Sequence Prefix
              </label>
              <Input
                type="text"
                value={globalPrefix}
                onChange={e => handleUpdateGlobalSettings(e.target.value, globalStartNum, globalPadZeroes, globalCopies, isContinuousBatchSeq)}
                placeholder="e.g. No."
                className="text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Start Number
              </label>
              <Input
                type="number"
                min="1"
                value={globalStartNum}
                onChange={e => handleUpdateGlobalSettings(globalPrefix, parseInt(e.target.value) || 1, globalPadZeroes, globalCopies, isContinuousBatchSeq)}
                className="text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Zero Padding
              </label>
              <Select
                options={[
                  { value: '1', label: '1, 2, 3... (No Pad)' },
                  { value: '2', label: '01, 02, 03... (2 Digits)' },
                  { value: '3', label: '001, 002... (3 Digits)' },
                  { value: '4', label: '0001, 0002... (4 Digits)' },
                ]}
                value={String(globalPadZeroes)}
                onChange={e => handleUpdateGlobalSettings(globalPrefix, globalStartNum, parseInt(e.target.value) || 2, globalCopies, isContinuousBatchSeq)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                Copies per Product
              </label>
              <Input
                type="number"
                min="1"
                max="500"
                value={globalCopies}
                onChange={e => handleUpdateGlobalSettings(globalPrefix, globalStartNum, globalPadZeroes, Math.max(1, parseInt(e.target.value) || 1), isContinuousBatchSeq)}
                className="text-xs font-bold text-purple-900 dark:text-purple-100"
              />
            </div>
          </div>
        </div>

        {/* Product Selection & Quantity Editing Table */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Products Batch List ({selectedProductsCount} Selected / {productConfigs.length} Total)</span>
              </h4>
              <Badge variant="info" className="text-[10px]">
                {totalStickersCount} Stickers to Print
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter products..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>

              {/* Add Product Picker Dropdown */}
              {allProducts.length > productConfigs.length && (
                <Select
                  options={[
                    { value: '', label: '+ Select products to add...' },
                    ...allProducts
                      .filter(p => !productConfigs.some(c => c.product.id === p.id))
                      .map(p => ({ value: p.id, label: `${p.name} (${formatINR(p.sellingPrice)})` }))
                  ]}
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      const prod = allProducts.find(p => p.id === e.target.value)
                      if (prod) handleAddProductToBatch(prod)
                    }
                  }}
                />
              )}
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300 sticky top-0 z-10">
                <tr>
                  <th className="p-2.5 text-center w-10">
                    <input
                      type="checkbox"
                      checked={productConfigs.length > 0 && productConfigs.every(c => c.selected)}
                      onChange={e => handleToggleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                  <th className="p-2.5 min-w-[150px]">Product Name</th>
                  <th className="p-2.5 min-w-[90px]">Price (₹)</th>
                  <th className="p-2.5 w-24 text-center">Label Copies</th>
                  <th className="p-2.5 min-w-[110px]">Seq Prefix</th>
                  <th className="p-2.5 w-24 text-center">Start Seq</th>
                  <th className="p-2.5 min-w-[140px]">Generated Seq Range</th>
                  <th className="p-2.5 text-center w-10">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {filteredConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-500">
                      No products match your search filter or batch list is empty.
                    </td>
                  </tr>
                ) : (
                  filteredConfigs.map((cfg) => {
                    const realIndex = productConfigs.findIndex(c => c.product.id === cfg.product.id)
                    const firstSeq = cfg.customLabels[0] || '01'
                    const lastSeq = cfg.customLabels[cfg.customLabels.length - 1] || firstSeq

                    return (
                      <tr
                        key={cfg.product.id}
                        className={cfg.selected ? 'bg-purple-50/20 dark:bg-purple-900/10' : 'opacity-50 bg-gray-50/50 dark:bg-gray-800/20'}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={cfg.selected}
                            onChange={e => handleToggleProductSelection(realIndex, e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                        <td className="p-2.5 font-bold text-gray-900 dark:text-gray-100">
                          <div>{cfg.product.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">Barcode: {cfg.product.barcode || cfg.product.sku}</div>
                        </td>
                        <td className="p-2.5 font-bold text-purple-900 dark:text-purple-200">
                          {formatINR(cfg.product.sellingPrice)}
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={cfg.copies}
                            disabled={!cfg.selected}
                            onChange={e => handleUpdateProductCopies(realIndex, parseInt(e.target.value) || 1)}
                            className="w-16 text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-1 font-bold text-purple-600 dark:text-purple-400 disabled:opacity-40"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={cfg.prefix}
                            disabled={!cfg.selected || isContinuousBatchSeq}
                            onChange={e => handleUpdateProductPrefix(realIndex, e.target.value)}
                            className="w-24 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs disabled:opacity-40"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={cfg.startNum}
                            disabled={!cfg.selected || isContinuousBatchSeq}
                            onChange={e => handleUpdateProductStartNum(realIndex, parseInt(e.target.value) || 1)}
                            className="w-16 text-center border border-gray-200 dark:border-gray-700 rounded px-1 py-1 text-xs font-semibold disabled:opacity-40"
                          />
                        </td>
                        <td className="p-2.5">
                          {cfg.selected ? (
                            <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                              <Tag className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{firstSeq} → {lastSeq}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Excluded</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(realIndex)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Sticker Preview & Individual Label Sequence Customization */}
        {flatLabelsList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Live Sticker Card Preview */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center space-y-3 relative">
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                  Live Sticker Preview ({previewIndex + 1} of {flatLabelsList.length})
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={previewIndex === 0}
                    onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                    className="p-1 rounded bg-white dark:bg-gray-700 border text-gray-600 dark:text-gray-200 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold px-2">{previewIndex + 1}/{flatLabelsList.length}</span>
                  <button
                    type="button"
                    disabled={previewIndex >= flatLabelsList.length - 1}
                    onClick={() => setPreviewIndex(prev => Math.min(flatLabelsList.length - 1, prev + 1))}
                    className="p-1 rounded bg-white dark:bg-gray-700 border text-gray-600 dark:text-gray-200 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sticker Card with Interactive Editable Serial Badge */}
              <div className="w-[260px] p-3.5 rounded-xl bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 shadow-lg flex flex-col justify-between items-center text-center space-y-1 relative">
                {/* Editable Serial Badge directly on the Sticker Preview */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <input
                    type="text"
                    value={currentPreviewLabel?.seqNo || ''}
                    onChange={e => {
                      const val = e.target.value
                      const targetConfig = productConfigs.find(c => c.product.id === currentPreviewLabel?.configId)
                      if (targetConfig) {
                        const configIdx = productConfigs.findIndex(c => c.product.id === targetConfig.product.id)
                        const labelIdx = (currentPreviewLabel?.labelIdx || 1) - 1
                        handleUpdateIndividualLabelSeq(configIdx, labelIdx, val)
                      }
                    }}
                    className="w-20 text-right px-1.5 py-0.5 rounded bg-purple-900 text-white font-mono text-[10px] font-extrabold border border-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    title="Click to edit serial number directly on preview"
                  />
                </div>

                <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider pt-1">
                  {settings?.businessName || 'SEZNIK RETAIL'}
                </div>

                <div className="text-xs font-extrabold text-gray-900 dark:text-gray-100 truncate w-full px-2">
                  {currentPreviewLabel?.product.name}
                </div>

                <div className="w-full flex justify-center py-1">
                  <canvas ref={canvasRef} className="max-w-[90%] h-auto inline-block" />
                </div>

                <div className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  MRP: {formatINR(currentPreviewLabel?.product.sellingPrice || 0)}
                </div>
              </div>
            </div>

            {/* Individual Sequence Label Customizer */}
            <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-purple-600" />
                  <span>Custom Consecutive Number List</span>
                </h5>
                <span className="text-[10px] text-gray-500">Edit individual label serial tags</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {flatLabelsList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setPreviewIndex(idx)}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      previewIndex === idx
                        ? 'bg-purple-100 dark:bg-purple-900/50 border-purple-400 font-bold text-purple-900 dark:text-purple-100'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-gray-400 w-5">#{idx + 1}</span>
                      <span className="truncate max-w-[120px] font-medium">{item.product.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.seqNo}
                        onChange={e => {
                          const val = e.target.value
                          const targetConfig = productConfigs.find(c => c.product.id === item.configId)
                          if (targetConfig) {
                            const configIdx = productConfigs.findIndex(c => c.product.id === targetConfig.product.id)
                            const labelIdx = item.labelIdx - 1
                            handleUpdateIndividualLabelSeq(configIdx, labelIdx, val)
                          }
                        }}
                        className="w-28 text-right font-mono font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-xs text-purple-900 dark:text-purple-200"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Print Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
          <Button
            variant="primary"
            leftIcon={<Printer size={16} />}
            onClick={handlePrintToBlePrinter}
            disabled={totalStickersCount === 0}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2.5 shadow-md shadow-purple-500/20"
          >
            Print to Seznik Dev Printer ({totalStickersCount} Labels)
          </Button>

          <Button
            variant="outline"
            leftIcon={<Printer size={16} />}
            onClick={handleBrowserPrintLabels}
            disabled={totalStickersCount === 0}
            className="flex-1 py-2.5 font-bold"
          >
            Print / Save PDF Grid ({totalStickersCount} Stickers)
          </Button>

          <Button variant="ghost" onClick={onClose} className="py-2.5">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
