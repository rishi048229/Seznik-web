import React, { useState, useRef, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useAiExtractDocument, useBulkImportProducts } from '@/hooks/useProducts'
import { type AiExtractedProduct } from '@/services/productService'
import { preprocessImageForOcr } from '@/utils/imagePreprocess'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import {
  Sparkles,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Barcode,
  Search,
  Check,
  X,
  Edit2,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  Table,
  Info,
  RotateCw,
  Zap,
  Bot,
  Download
} from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadBulkUploadTemplate, normalizeUnit } from '@/utils/bulkTemplateGenerator'

interface AiDocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

const SEZ_AI_LOADING_MESSAGES = [
  '✨ SEZ AI is scanning your CSV / file and parsing all columns & rows...',
  '🤖 SEZ AI is intelligent-mapping product names, prices & units...',
  '⚡ SEZ AI is detecting existing barcodes & preserving barcode numbers 100%...',
  '🏷️ SEZ AI is auto-assigning smart categories & calculating tax rates...',
  '📊 SEZ AI is building your interactive product review & edit table...'
]

const SEZ_AI_IMPORT_MESSAGES = [
  '📦 SEZ AI is creating missing categories in your database...',
  '⚡ SEZ AI is executing high-speed batch database insertion...',
  '✅ SEZ AI is finalizing inventory and category synchronization...'
]

export const AiDocumentUploadModal: React.FC<AiDocumentUploadModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [fileTypeCategory, setFileTypeCategory] = useState<'image' | 'pdf' | 'excel' | 'csv' | 'text'>('image')
  const [searchFilter, setSearchFilter] = useState('')
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)

  const [extractedProducts, setExtractedProducts] = useState<AiExtractedProduct[]>([])
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review'>('upload')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { mutate: extractDocument, isPending: isExtracting } = useAiExtractDocument()
  const { mutate: bulkImport, isPending: isImporting } = useBulkImportProducts()

  // Cycle interactive SEZ AI progress messages during analysis
  useEffect(() => {
    if (step === 'analyzing') {
      setLoadingMsgIdx(0)
      const interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % SEZ_AI_LOADING_MESSAGES.length)
      }, 2500)
      return () => clearInterval(interval)
    }
  }, [step])

  // A visible clock reassures during the wait, and turns "it feels slow" into
  // a number we can actually compare between runs.
  useEffect(() => {
    if (step !== 'analyzing') return
    setElapsedSec(0)
    const tick = setInterval(() => setElapsedSec(s => s + 1), 1000)
    return () => clearInterval(tick)
  }, [step])

  // Cycle interactive SEZ AI progress messages during import
  useEffect(() => {
    if (isImporting) {
      setLoadingMsgIdx(0)
      const interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % SEZ_AI_IMPORT_MESSAGES.length)
      }, 1500)
      return () => clearInterval(interval)
    }
  }, [isImporting])

  const processSelectedFile = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds 20MB limit.')
      return
    }

    const lowerName = file.name.toLowerCase()
    const isCsv = lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || file.type.includes('csv')
    const isExcel =
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.xlsm') ||
      lowerName.endsWith('.ods') ||
      file.type.includes('sheet') ||
      file.type.includes('excel')

    if (!isCsv && !isExcel) {
      toast.error('Only Excel (.xlsx, .xls) and CSV (.csv) files are supported. Please use the provided template.')
      return
    }

    setSelectedFile(file)
    setFileTypeCategory(isCsv ? 'csv' : 'excel')
    setFilePreview(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processSelectedFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) processSelectedFile(file)
  }

  // Universal Format-Independent CSV & Spreadsheet Table Parser
  const parseExcelSheetDirectly = (sheet: XLSX.WorkSheet): AiExtractedProduct[] => {
    const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
    if (!jsonRows || jsonRows.length === 0) return []

    const keys = Object.keys(jsonRows[0] || {})
    if (keys.length === 0) return []

    const findKey = (regex: RegExp): string | undefined => {
      return keys.find(k => regex.test(k.trim()))
    }

    // Barcode (Optional)
    const barcodeKey = 
      findKey(/^barcode/i) ||
      findKey(/^(bar_code|bar\s*code|barcode_no|barcodeno|ean|upc|gtin|item_barcode|product_barcode)$/i) ||
      findKey(/^code$/i) ||
      findKey(/sku/i)

    // Product Name (Compulsory)
    const nameKey = 
      findKey(/^(product\s*name\*?|product_name|name\*?|product|item\s*name|item|particulars)/i) ||
      findKey(/name|product|item|description|title/i)

    // Selling Price (Compulsory)
    const sellingPriceKey = 
      findKey(/^(selling\s*price\*?|selling_price|price\*?|sale\s*price|mrp|rate|sales_rate|selling_rate)/i) ||
      findKey(/selling|sell|sale|price|mrp|rate/i)

    // Cost Price (Compulsory)
    const costPriceKey = 
      findKey(/^(cost\s*price\*?|cost_price|cost\*?|purchase\s*price|costprice|buy_price|cost_rate|purchase_rate)/i) ||
      findKey(/cost|purchase/i)

    // Category (Compulsory)
    const categoryKey = findKey(/^(category\*?|cat|category_name|group|department|productgroup|type)/i)

    // Stock Quantity (Compulsory)
    const stockKey = findKey(/^(stock\s*quantity\*?|current\s*stock\*?|stock\*?|qty|quantity|available_stock|balance|count)/i)

    // Min Stock Alert (Optional, defaults to 0 if not entered)
    const minStockKey = findKey(/^(min\s*stock|low\s*stock|threshold|alert)/i)

    // Tax Rate (Optional)
    const taxKey = findKey(/^(tax\s*rate|gst\s*rate|tax|gst|vat)/i)

    // Unit (Compulsory)
    const unitKey = findKey(/^(unit\*?|uom|pack|unit_type|measurementunit)/i)

    if (!nameKey && !sellingPriceKey && !barcodeKey) return []

    const products: AiExtractedProduct[] = []

    jsonRows.forEach((row, idx) => {
      // Product Name
      let name = nameKey ? String(row[nameKey]).trim() : ''
      if (name.startsWith('₹') || name.startsWith('Rs')) name = ''
      if (!name) {
        const altKey = keys.find(k => k !== barcodeKey && String(row[k]).trim().length > 0 && isNaN(Number(row[k])))
        if (altKey) name = String(row[altKey]).trim()
      }
      if (!name) name = `Item ${idx + 1}`

      // Barcode (Optional - auto-generate if blank)
      let rawBarcode = barcodeKey ? String(row[barcodeKey]).trim() : ''
      
      if (!rawBarcode || rawBarcode === 'null' || rawBarcode === 'undefined' || rawBarcode === '0') {
        rawBarcode = 'SZ' + Math.floor(1000000000 + Math.random() * 9000000000).toString()
      } else if (rawBarcode.length < 6 && /^\d+$/.test(rawBarcode) && !barcodeKey.toLowerCase().includes('barcode')) {
        const foundLongDigit = keys.map(k => String(row[k]).trim()).find(v => /^\d{7,16}$/.test(v))
        if (foundLongDigit) rawBarcode = foundLongDigit
      }

      const isExistingBarcode = rawBarcode.startsWith('SZ') && rawBarcode.length === 12 ? false : true

      // Selling Price (Compulsory)
      const sellVal = sellingPriceKey ? parseFloat(String(row[sellingPriceKey]).replace(/[^0-9.]/g, '')) : NaN
      let sellingPrice = !isNaN(sellVal) ? sellVal : 0

      // Cost Price (Compulsory)
      const costVal = costPriceKey ? parseFloat(String(row[costPriceKey]).replace(/[^0-9.]/g, '')) : NaN
      const costPrice = !isNaN(costVal) ? costVal : (sellingPrice > 0 ? sellingPrice : 0)

      if (sellingPrice === 0 && costPrice > 0) {
        sellingPrice = costPrice
      }

      // Category (Compulsory)
      const categoryName = categoryKey && row[categoryKey] ? String(row[categoryKey]).trim() : 'General'

      // Stock Quantity (Compulsory)
      const stockVal = stockKey ? parseInt(String(row[stockKey]).replace(/[^0-9]/g, '')) : NaN
      const currentStock = !isNaN(stockVal) ? stockVal : 0

      // Min Stock Alert (Optional, defaults to 0 if not entered)
      const minStockVal = minStockKey && row[minStockKey] !== '' ? parseInt(String(row[minStockKey]).replace(/[^0-9]/g, '')) : NaN
      const lowStockThreshold = !isNaN(minStockVal) ? minStockVal : 0

      // Tax Rate
      const taxVal = taxKey ? parseFloat(String(row[taxKey]).replace(/[^0-9.]/g, '')) : NaN
      const taxRate = !isNaN(taxVal) ? taxVal : 0

      // Unit (Normalized using index mapping: 1=piece, 2=kg, etc.)
      const rawUnit = unitKey && row[unitKey] ? String(row[unitKey]).trim() : ''
      const unitVal = normalizeUnit(rawUnit)

      products.push({
        id: `csv-format-${Date.now()}-${idx}`,
        name,
        sellingPrice,
        costPrice,
        categoryName,
        barcode: rawBarcode,
        isExistingBarcode,
        barcodeType: 'CODE128',
        taxRate,
        currentStock,
        lowStockThreshold,
        unit: unitVal,
        priceIncludesGst: false,
        selected: true
      })
    })

    return products
  }

  const handleStartExtraction = () => {
    if (!selectedFile) {
      toast.error('Please select a CSV file, Excel sheet, PDF, bill, or menu file first.')
      return
    }

    setStep('analyzing')

    // Handle CSV and Excel files seamlessly using XLSX parser + SEZ AI fallback
    if (fileTypeCategory === 'csv' || fileTypeCategory === 'excel') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[firstSheetName]

          // 1. Try Universal Format-Independent Table Parser
          const directProducts = parseExcelSheetDirectly(sheet)
          const directBarcodeCount = directProducts.filter(p => p.isExistingBarcode).length

          // If parser extracted products with preserved barcodes, use it instantly!
          if (directProducts.length > 0) {
            setExtractedProducts(directProducts)
            setStep('review')
            toast.success(`Extracted all ${directProducts.length} products with ${directBarcodeCount} barcodes preserved!`)
            return
          }

          // 2. Universal SEZ AI Multi-Modal Sheet Extraction (CSV / HTML representation)
          const csvText = XLSX.utils.sheet_to_csv(sheet)
          const htmlContent = XLSX.utils.sheet_to_html(sheet)
          const textPayload = (csvText && csvText.trim().length > 0) ? csvText : htmlContent

          if (!textPayload || textPayload.trim().length === 0) {
            setStep('upload')
            toast.error('The uploaded CSV / Excel file appears to be empty.')
            return
          }

          const base64Data = btoa(unescape(encodeURIComponent(textPayload)))
          sendExtractionRequest(`data:text/csv;base64,${base64Data}`, 'text/csv')
        } catch (err) {
          setStep('upload')
          toast.error('Failed to parse CSV file. Sending to SEZ AI fallback...')
          readAndSendFile(selectedFile)
        }
      }
      reader.readAsArrayBuffer(selectedFile)
    } else {
      readAndSendFile(selectedFile)
    }
  }

  const readAndSendFile = async (file: File) => {
    // Photos and screenshots get downscaled + contrast-normalized first —
    // oversized, unevenly-lit images are the main reason extraction fails.
    if (file.type.startsWith('image/')) {
      try {
        const processed = await preprocessImageForOcr(file)
        if (processed.isLowResolution) {
          toast('This image is quite low resolution — extraction may miss items.', { icon: '⚠️' })
        }
        sendExtractionRequest(processed.dataUrl, processed.mimeType)
        return
      } catch {
        // Preprocessing is an enhancement, never a gate — fall through to the raw file.
      }
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64Data = reader.result as string
      sendExtractionRequest(base64Data, file.type || 'image/jpeg')
    }
    reader.onerror = () => {
      setStep('upload')
      toast.error('Could not read that file. Please try another one.')
    }
    reader.readAsDataURL(file)
  }

  const sendExtractionRequest = (documentData: string, mimeType: string) => {
    extractDocument(
      { documentData, mimeType },
      {
        onSuccess: (res) => {
          if (res.products && res.products.length > 0) {
            const enriched = res.products.map(p => ({
              ...p,
              selected: true,
              taxRate: p.taxRate ?? 0,
              currentStock: p.currentStock ?? 10,
              unit: p.unit || 'piece',
              priceIncludesGst: p.priceIncludesGst ?? false
            }))
            setExtractedProducts(enriched)
            setStep('review')
            const preservedCount = enriched.filter(p => p.isExistingBarcode).length
            toast.success(`SEZ AI successfully extracted ${res.count} products! (${preservedCount} barcodes preserved)`)
          } else {
            setStep('upload')
            toast.error('SEZ AI could not find any product items in the document. Please try a clearer file.')
          }
        },
        onError: (err) => {
          setStep('upload')
          const msg = err instanceof Error ? err.message : 'SEZ AI document analysis failed'
          toast.error(msg)
        },
      }
    )
  }

  const handleToggleSelectAll = (checked: boolean) => {
    setExtractedProducts(prev => prev.map(p => ({ ...p, selected: checked })))
  }

  const handleToggleSelectProduct = (id: string) => {
    setExtractedProducts(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p))
  }

  const handleUpdateProductField = (id: string, field: keyof AiExtractedProduct, val: any) => {
    setExtractedProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))
  }

  const handleRegenerateBarcode = (id: string) => {
    const newBarcode = 'SZ' + Math.floor(1000000000 + Math.random() * 9000000000).toString()
    setExtractedProducts(prev => prev.map(p => p.id === id ? { ...p, barcode: newBarcode, isExistingBarcode: false } : p))
    toast.success('Generated fresh barcode!')
  }

  const handleDeleteProduct = (id: string) => {
    setExtractedProducts(prev => prev.filter(p => p.id !== id))
    toast.success('Removed product from review list.')
  }

  const handleDeleteSelected = () => {
    setExtractedProducts(prev => prev.filter(p => !p.selected))
    toast.success('Removed selected products.')
  }

  const handleConfirmImport = () => {
    const selectedList = extractedProducts.filter(p => p.selected)
    if (selectedList.length === 0) {
      toast.error('Please select at least 1 product to import.')
      return
    }

    bulkImport(selectedList, {
      onSuccess: (res) => {
        toast.success(`Successfully imported ${res.count} products & updated categories!`)
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
        qc.refetchQueries({ queryKey: [QUERY_KEYS.CATEGORIES] })
        qc.refetchQueries({ queryKey: [QUERY_KEYS.PRODUCTS] })
        handleResetAndClose()
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Failed to bulk import products'
        toast.error(msg)
      },
    })
  }

  const handleResetAndClose = () => {
    setSelectedFile(null)
    setFilePreview(null)
    setFileTypeCategory('image')
    setExtractedProducts([])
    setStep('upload')
    onClose()
  }

  const filteredProducts = extractedProducts.filter(p =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.categoryName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.barcode.toLowerCase().includes(searchFilter.toLowerCase())
  )

  const selectedCount = extractedProducts.filter(p => p.selected).length
  const existingBarcodeCount = extractedProducts.filter(p => p.isExistingBarcode).length
  const autoBarcodeCount = extractedProducts.length - existingBarcodeCount

  // Row-level quality flags. Extraction from a photo or handwriting is never
  // perfect, so surface exactly which rows need a human look rather than
  // relying on the user to eyeball every line.
  const issuesById = useMemo(() => {
    const barcodeCounts = new Map<string, number>()
    const nameCounts = new Map<string, number>()
    for (const p of extractedProducts) {
      const bc = (p.barcode || '').trim()
      if (bc) barcodeCounts.set(bc, (barcodeCounts.get(bc) ?? 0) + 1)
      const nm = (p.name || '').trim().toLowerCase()
      if (nm) nameCounts.set(nm, (nameCounts.get(nm) ?? 0) + 1)
    }

    const map = new Map<string, string[]>()
    for (const p of extractedProducts) {
      const issues: string[] = []
      if (!p.name?.trim() || /^(item|extracted item)\s*\d*$/i.test(p.name.trim())) {
        issues.push('Name could not be read')
      }
      if (!p.sellingPrice || p.sellingPrice <= 0) {
        issues.push('No price found')
      }
      if (p.costPrice > p.sellingPrice && p.sellingPrice > 0) {
        issues.push('Cost is higher than selling price')
      }
      const bc = (p.barcode || '').trim()
      if (bc && (barcodeCounts.get(bc) ?? 0) > 1) {
        issues.push('Duplicate barcode in this batch')
      }
      const nm = (p.name || '').trim().toLowerCase()
      if (nm && (nameCounts.get(nm) ?? 0) > 1) {
        issues.push('Duplicate name in this batch')
      }
      if (issues.length) map.set(p.id, issues)
    }
    return map
  }, [extractedProducts])

  const rowsNeedingReview = extractedProducts.filter(p => issuesById.has(p.id)).length

  const modalFooter = useMemo(() => {
    if (step === 'upload') {
      return (
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={handleResetAndClose}
            className="text-xs font-semibold dark:text-zinc-300 dark:hover:text-white dark:hover:bg-dark-elevated"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleStartExtraction}
            disabled={!selectedFile || isExtracting}
            loading={isExtracting}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20"
            leftIcon={<FileSpreadsheet size={15} />}
          >
            Upload & Review Products
          </Button>
        </div>
      )
    }

    if (step === 'review') {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <p className="text-xs text-gray-600 dark:text-zinc-400">
            Ready to import <strong className="text-purple-600 dark:text-purple-400 font-bold">{selectedCount}</strong> products into inventory.
          </p>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={handleResetAndClose}
              className="text-xs font-semibold dark:text-zinc-300 dark:hover:text-white dark:hover:bg-dark-elevated"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedCount === 0 || isImporting}
              loading={isImporting}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
              leftIcon={<CheckCircle2 size={15} />}
            >
              Import {selectedCount} Selected Products
            </Button>
          </div>
        </div>
      )
    }

    return undefined
  }, [step, selectedFile, isExtracting, selectedCount, isImporting])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title="Bulk Product Upload (Excel / CSV)"
      size="xl"
      footer={modalFooter}
    >
      <div>
        {step === 'upload' && (
          <div className="space-y-2.5">
            {/* Step 1: Download Standard Template */}
            <div className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/90 dark:from-blue-950/30 dark:via-dark-elevated dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-blue-950 dark:text-blue-300">
                    Step 1: Download Bulk Upload Template
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 truncate">
                    Pre-formatted template with standard columns, sample rows & unit codes.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => downloadBulkUploadTemplate('xlsx')}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-7 px-2.5 flex items-center gap-1 shadow-sm hover:shadow-blue-500/20"
                  leftIcon={<Download size={13} />}
                >
                  Download Excel (.xlsx)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadBulkUploadTemplate('csv')}
                  className="text-xs font-semibold h-7 px-2.5 dark:bg-dark-elevated dark:border-dark-border-strong dark:text-zinc-200 dark:hover:bg-dark-hover dark:hover:text-white dark:hover:border-blue-400/40"
                  leftIcon={<Download size={13} />}
                >
                  CSV (.csv)
                </Button>
              </div>
            </div>

            {/* Step 2: Format Guidelines & Disclaimer */}
            <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-dark-elevated/70 border border-amber-200/70 dark:border-dark-border-strong space-y-2 text-xs backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Format Guidelines & Required Columns</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-600 dark:text-zinc-400">
                  <span>Accepted:</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200/60 dark:border-blue-800/50 text-[10px]">
                    .xlsx / .xls
                  </span>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-200/60 dark:border-indigo-800/50 text-[10px]">
                    .csv
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                {/* Compulsory Fields */}
                <div className="space-y-1 bg-white/90 dark:bg-dark-card p-2 rounded-lg border border-emerald-200/80 dark:border-emerald-500/25 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Compulsory Fields
                    </p>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border dark:border-emerald-800/60">
                      Required
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10.5px]">
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Product Name*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Item title</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Category*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Category name</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Cost Price*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Supplier cost ₹</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Selling Price*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Retail price ₹</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Stock Qty*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Initial count (≥0)</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Unit*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Code (1 to 7)</span>
                    </div>
                  </div>

                  {/* Unit codes row */}
                  <div className="pt-1 border-t border-emerald-100/80 dark:border-dark-border flex flex-wrap items-center gap-1 font-mono text-[9.5px]">
                    <span className="font-sans font-semibold text-slate-600 dark:text-zinc-400 text-[10px] mr-0.5">
                      Units:
                    </span>
                    {[
                      { id: 1, label: 'piece' },
                      { id: 2, label: 'kg' },
                      { id: 3, label: 'gram' },
                      { id: 4, label: 'liter' },
                      { id: 5, label: 'meter' },
                      { id: 6, label: 'dozen' },
                      { id: 7, label: 'box' },
                    ].map((u) => (
                      <span
                        key={u.id}
                        className="inline-flex items-center px-1 py-0.2 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50"
                      >
                        <strong className="text-emerald-900 dark:text-emerald-200 mr-0.5 font-bold">{u.id}:</strong>
                        {u.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Optional Fields */}
                <div className="space-y-1 bg-white/90 dark:bg-dark-card p-2 rounded-lg border border-blue-200/80 dark:border-blue-500/25 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1 text-[11px]">
                      <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      Optional Fields
                    </p>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 dark:border dark:border-blue-800/60">
                      Auto-Handled
                    </span>
                  </div>

                  <div className="space-y-0.5 text-[10.5px]">
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Barcode</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">If blank, auto-generates </span>
                      <code className="text-blue-700 dark:text-blue-300 font-mono font-bold bg-blue-50 dark:bg-blue-950/60 px-1 py-0.2 rounded text-[10px]">
                        SZ...
                      </code>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Min Stock Alert</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Threshold. Defaults to </span>
                      <span className="px-1 rounded bg-gray-100 dark:bg-dark-elevated text-slate-900 dark:text-zinc-100 font-bold text-[10px]">
                        0
                      </span>{' '}
                      <span className="text-slate-500 dark:text-zinc-400">if blank</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Tax Rate %</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">GST percentage slab (defaults to 0%)</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Brand & Description</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Optional brand or item notes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: File Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-200 dark:border-blue-500/30 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl py-3.5 px-4 text-center cursor-pointer transition-all bg-slate-50/60 dark:bg-dark-card hover:bg-blue-50/40 dark:hover:bg-dark-elevated/80 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-500/30">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate max-w-sm">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {fileTypeCategory.toUpperCase()} Format •{' '}
                      <span className="text-blue-600 dark:text-blue-400 font-medium">Click to replace file</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100/80 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-blue-200/50 dark:border-blue-500/30">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                      Drop your Excel (.xlsx) or CSV file here, or{' '}
                      <span className="text-blue-600 dark:text-blue-400 underline underline-offset-2">Browse File</span>
                    </p>
                    <p className="text-[10.5px] text-slate-500 dark:text-zinc-400">
                      Supports .xlsx, .xls, .csv up to 20MB (up to 5,000 products per batch)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-16 text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-600 animate-spin" />
              <Bot className="w-10 h-10 text-purple-600 dark:text-purple-400 animate-bounce" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <Badge variant="info" className="px-3 py-1 text-xs font-bold animate-pulse">
                SEZ AI Active Processing
              </Badge>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                SEZ AI is Analyzing Your File...
              </h3>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 transition-all duration-300">
                <p className="text-xs font-semibold text-purple-900 dark:text-purple-200 animate-fade-in">
                  {SEZ_AI_LOADING_MESSAGES[loadingMsgIdx]}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Extracting items, mapping prices, creating categories, and preserving barcodes...
              </p>
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
                {elapsedSec}s elapsed
                {elapsedSec > 30 && ' — large documents can take a little longer'}
              </p>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {/* AI Verification Notice & Disclaimer Warning Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-dark-elevated border border-amber-300/80 dark:border-amber-500/30 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-950 dark:text-amber-300">
                  ⚠️ Verification Required: AI & Automated Extraction Notice
                </p>
                <p className="text-[11px] text-amber-800 dark:text-zinc-300 leading-relaxed">
                  Automated extraction helps process thousands of products quickly, but AI and file parsers can occasionally misinterpret handwritten text, complex grid columns, or custom formats. <strong>Please inspect and verify product names, prices, categories, and barcodes below before clicking import into your inventory.</strong>
                </p>
              </div>
            </div>

            {/* Top Stat Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-dark-elevated border border-purple-200 dark:border-purple-800/40">
                <p className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold">Extracted Products</p>
                <p className="text-xl font-black text-purple-900 dark:text-white">{extractedProducts.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-dark-elevated border border-blue-200 dark:border-blue-800/40">
                <p className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">Selected to Import</p>
                <p className="text-xl font-black text-blue-900 dark:text-white">{selectedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-dark-elevated border border-emerald-200 dark:border-emerald-800/40">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">Doc Barcodes Preserved</p>
                <p className="text-xl font-black text-emerald-900 dark:text-white">{existingBarcodeCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-dark-elevated border border-amber-200 dark:border-amber-800/40">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">Auto-Generated Barcodes</p>
                <p className="text-xl font-black text-amber-900 dark:text-white">{autoBarcodeCount}</p>
              </div>
            </div>

            {/* Rows the extractor is unsure about */}
            {rowsNeedingReview > 0 && (
              <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-dark-elevated border border-rose-200 dark:border-rose-500/30 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-900 dark:text-rose-200">
                  <strong>{rowsNeedingReview}</strong> {rowsNeedingReview === 1 ? 'row needs' : 'rows need'} a closer look — missing prices, unreadable names, or duplicates. They're marked in the list below and are still safe to import once corrected.
                </p>
              </div>
            )}

            {/* Filter Search Bar & Bulk Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Filter by product name, category, or barcode..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteSelected}
                    className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800"
                    leftIcon={<Trash2 size={14} />}
                  >
                    Delete Selected ({selectedCount})
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setStep('upload')}
                  leftIcon={<RefreshCw size={14} />}
                >
                  Re-upload File
                </Button>
              </div>
            </div>

            {/* DESKTOP TABLE VIEW (md:block hidden) */}
            <div className="hidden md:block max-h-96 overflow-y-auto border border-gray-200 dark:border-dark-border rounded-xl">
              <table className="w-full text-left text-xs divide-y divide-gray-200 dark:divide-dark-border">
                <thead className="bg-gray-50 dark:bg-dark-elevated sticky top-0 font-bold text-gray-700 dark:text-zinc-200 z-10 border-b border-gray-200 dark:border-dark-border">
                  <tr>
                    <th className="p-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={extractedProducts.length > 0 && extractedProducts.every(p => p.selected)}
                        onChange={e => handleToggleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 dark:border-dark-border-strong text-purple-600 focus:ring-purple-500"
                      />
                    </th>
                    <th className="p-3 min-w-[160px]">Product Name</th>
                    <th className="p-3 min-w-[110px]">Category</th>
                    <th className="p-3 text-right min-w-[90px]">Sell Price (₹)</th>
                    <th className="p-3 text-right min-w-[90px]">Cost Price (₹)</th>
                    <th className="p-3 min-w-[80px]">GST %</th>
                    <th className="p-3 min-w-[170px]">Barcode & Origin</th>
                    <th className="p-3 text-center min-w-[70px]">Stock</th>
                    <th className="p-3 min-w-[80px]">Unit</th>
                    <th className="p-3 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border bg-white dark:bg-dark-bg">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-gray-500">
                        No products match your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => {
                      const rowIssues = issuesById.get(product.id)
                      return (
                      <tr
                        key={product.id}
                        className={
                          !product.selected
                            ? 'opacity-60'
                            : rowIssues
                            ? 'bg-rose-50/40 dark:bg-rose-950/20'
                            : 'bg-purple-50/30 dark:bg-purple-900/10'
                        }
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={product.selected}
                            onChange={() => handleToggleSelectProduct(product.id)}
                            className="rounded border-gray-300 dark:border-dark-border-strong text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                        <td className="p-2 font-semibold text-gray-900 dark:text-gray-100">
                          <input
                            type="text"
                            value={product.name}
                            onChange={e => handleUpdateProductField(product.id, 'name', e.target.value)}
                            className="w-full bg-transparent border border-gray-200 dark:border-dark-border hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-dark-card rounded px-2 py-1 text-xs font-semibold"
                          />
                          {rowIssues && (
                            <p className="mt-1 flex items-start gap-1 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-px" />
                              <span>{rowIssues.join(' · ')}</span>
                            </p>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={product.categoryName}
                            onChange={e => handleUpdateProductField(product.id, 'categoryName', e.target.value)}
                            className="w-full bg-transparent border border-gray-200 dark:border-dark-border hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-dark-card rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={product.sellingPrice}
                            onChange={e => handleUpdateProductField(product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right bg-transparent border border-gray-200 dark:border-dark-border hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-dark-card rounded px-2 py-1 text-xs font-bold text-purple-900 dark:text-purple-100"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={product.costPrice}
                            onChange={e => handleUpdateProductField(product.id, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right bg-transparent border border-gray-200 dark:border-dark-border hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-dark-card rounded px-2 py-1 text-xs text-gray-700 dark:text-zinc-200"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="1"
                            value={product.taxRate}
                            onChange={e => handleUpdateProductField(product.id, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="w-16 text-center bg-transparent border border-gray-200 dark:border-dark-border hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-dark-card rounded px-1.5 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2 font-mono">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={product.barcode}
                              onChange={e => handleUpdateProductField(product.id, 'barcode', e.target.value)}
                              className="w-28 bg-transparent border border-gray-200 dark:border-dark-border hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-dark-card rounded px-1.5 py-1 text-xs font-mono font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleRegenerateBarcode(product.id)}
                              title="Regenerate Barcode"
                              className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded hover:bg-gray-100 dark:hover:bg-dark-card"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            {product.isExistingBarcode ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 whitespace-nowrap">
                                📌 Doc
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 whitespace-nowrap">
                                ✨ Auto
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-center font-medium">
                          <input
                            type="number"
                            value={product.currentStock}
                            onChange={e => handleUpdateProductField(product.id, 'currentStock', parseInt(e.target.value) || 0)}
                            className="w-16 text-center bg-transparent border border-gray-200 dark:border-dark-border hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-dark-card rounded px-1.5 py-1 text-xs font-semibold"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={product.unit}
                            onChange={e => handleUpdateProductField(product.id, 'unit', e.target.value)}
                            className="w-16 bg-transparent border border-gray-200 dark:border-dark-border hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-dark-card rounded px-1.5 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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

            {/* MOBILE CARD VIEW (md:hidden block) */}
            <div className="md:hidden space-y-3 max-h-96 overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 border border-gray-200 dark:border-dark-border rounded-xl">
                  No products match your search filter.
                </div>
              ) : (
                filteredProducts.map(product => {
                  const rowIssues = issuesById.get(product.id)
                  return (
                  <div
                    key={product.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-3 transition-colors ${
                      !product.selected
                        ? 'bg-gray-50 dark:bg-dark-card/40 border-gray-200 dark:border-dark-border opacity-60'
                        : rowIssues
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                        : 'bg-purple-50/40 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/60'
                    }`}
                  >
                    {rowIssues && (
                      <p className="flex items-start gap-1.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                        <span>{rowIssues.join(' · ')}</span>
                      </p>
                    )}
                    {/* Header Row: Checkbox, Name, Delete */}
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={product.selected}
                        onChange={() => handleToggleSelectProduct(product.id)}
                        className="mt-1.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Product Name</label>
                        <input
                          type="text"
                          value={product.name}
                          onChange={e => handleUpdateProductField(product.id, 'name', e.target.value)}
                          className="w-full font-bold text-sm bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border focus:border-purple-500 rounded-lg px-2.5 py-1 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Inputs Grid: Category, Sell Price, Cost Price */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Category</label>
                        <input
                          type="text"
                          value={product.categoryName}
                          onChange={e => handleUpdateProductField(product.id, 'categoryName', e.target.value)}
                          className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-2 py-1 font-medium text-gray-900 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Selling (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.sellingPrice}
                          onChange={e => handleUpdateProductField(product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-2 py-1 font-bold text-purple-900 dark:text-purple-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Cost (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.costPrice}
                          onChange={e => handleUpdateProductField(product.id, 'costPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-2 py-1 text-gray-700 dark:text-zinc-200"
                        />
                      </div>
                    </div>

                    {/* Barcode & Regenerate */}
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase flex items-center justify-between">
                          <span>Barcode</span>
                          <button
                            type="button"
                            onClick={() => handleRegenerateBarcode(product.id)}
                            className="text-purple-600 hover:underline text-[10px]"
                          >
                            Generate New
                          </button>
                        </label>
                        <input
                          type="text"
                          value={product.barcode}
                          onChange={e => handleUpdateProductField(product.id, 'barcode', e.target.value)}
                          className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-2 py-1 font-mono font-bold"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">GST %</label>
                          <input
                            type="number"
                            value={product.taxRate}
                            onChange={e => handleUpdateProductField(product.id, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-1.5 py-1 text-center"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Stock</label>
                          <input
                            type="number"
                            value={product.currentStock}
                            onChange={e => handleUpdateProductField(product.id, 'currentStock', parseInt(e.target.value) || 0)}
                            className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-1.5 py-1 text-center font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Unit</label>
                          <input
                            type="text"
                            value={product.unit}
                            onChange={e => handleUpdateProductField(product.id, 'unit', e.target.value)}
                            className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-1 py-1 text-center"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })
              )}
            </div>

            {/* Import Status Banner during Import */}
            {isImporting && (
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                  {SEZ_AI_IMPORT_MESSAGES[loadingMsgIdx % SEZ_AI_IMPORT_MESSAGES.length]}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
