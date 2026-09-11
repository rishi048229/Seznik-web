import React, { useState, useRef, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useProducts, useAiExtractDocument, useBulkImportProducts } from '@/hooks/useProducts'
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

// Custom High-Finish UI SVG Icons
const CautionBadgeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M12 2.5L21.5 19C21.9 19.7 21.4 20.6 20.6 20.6H3.4C2.6 20.6 2.1 19.7 2.5 19L12 2.5Z"
      fill="currentColor"
      fillOpacity="0.16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 8.5V13.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1.2" fill="currentColor" />
  </svg>
)

const SpreadsheetDeleteRowsIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3.5" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.08" />
    <path d="M3 8.5H21" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 14H21" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 3V21" stroke="currentColor" strokeWidth="1.5" />
    {/* Highlighted sample row with delete dash */}
    <rect x="9" y="8.5" width="12" height="5.5" fill="currentColor" fillOpacity="0.25" />
    <path d="M13.5 11.25H16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const CustomLightbulbIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M9 18H15M10 21H14M12 2C8.13401 2 5 5.13401 5 9C5 11.3866 6.19635 13.4937 8.01633 14.7364C8.63665 15.1599 9 15.852 9 16.6006V17C9 17.5523 9.44772 18 10 18H14C14.5523 18 15 17.5523 15 17V16.6006C15 15.852 15.3634 15.1599 15.9837 14.7364C17.8036 13.4937 19 11.3866 19 9C19 5.13401 15.866 2 12 2Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.16"
    />
    <path d="M12 6V9M10.5 7.5H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

interface BulkProductUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

const SPREADSHEET_PARSING_MESSAGES = [
  'Reading your spreadsheet file...',
  'Parsing columns and table rows...',
  'Mapping product names, prices, categories, and stock...',
  'Detecting existing barcodes and units...',
  'Building your interactive product review table...'
]

const IMPORT_LOADING_MESSAGES = [
  'Creating categories and preparing catalog...',
  'Importing products into inventory database...',
  'Finalizing catalog and stock synchronization...'
]

export const BulkProductUploadModal: React.FC<BulkProductUploadModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [fileTypeCategory, setFileTypeCategory] = useState<'image' | 'pdf' | 'excel' | 'csv' | 'numbers' | 'text'>('excel')
  const [searchFilter, setSearchFilter] = useState('')
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)

  const [extractedProducts, setExtractedProducts] = useState<AiExtractedProduct[]>([])
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review'>('upload')
  const [showSampleConfirmModal, setShowSampleConfirmModal] = useState(false)

  // Close sample confirmation modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSampleConfirmModal) {
        e.stopPropagation()
        setShowSampleConfirmModal(false)
      }
    }
    if (showSampleConfirmModal) {
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [showSampleConfirmModal])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const { data: existingCatalogProducts = [] } = useProducts()

  const { mutate: extractDocument, isPending: isExtracting } = useAiExtractDocument()
  const { mutate: bulkImport, isPending: isImporting } = useBulkImportProducts()

  // Cycle progress messages during parsing
  useEffect(() => {
    if (step === 'analyzing') {
      setLoadingMsgIdx(0)
      const interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % SPREADSHEET_PARSING_MESSAGES.length)
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

  // Cycle progress messages during import
  useEffect(() => {
    if (isImporting) {
      setLoadingMsgIdx(0)
      const interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % IMPORT_LOADING_MESSAGES.length)
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
    const isNumbers = lowerName.endsWith('.numbers') || file.type.includes('numbers')
    const isCsv = lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.tab') || file.type.includes('csv')
    const isExcel =
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.xlsm') ||
      lowerName.endsWith('.xlsb') ||
      lowerName.endsWith('.ods') ||
      lowerName.endsWith('.dif') ||
      lowerName.endsWith('.prn') ||
      lowerName.endsWith('.txt') ||
      file.type.includes('sheet') ||
      file.type.includes('excel') ||
      file.type.includes('opendocument')

    if (!isCsv && !isExcel && !isNumbers) {
      toast.error('Only spreadsheet files (Excel .xlsx/.xls/.xlsm/.xlsb, Apple Numbers .numbers, CSV .csv/.tsv, OpenDocument .ods) are supported.')
      return
    }

    setSelectedFile(file)
    setFileTypeCategory(isNumbers ? 'numbers' : (isCsv ? 'csv' : 'excel'))
    setFilePreview(null)
    setShowSampleConfirmModal(true)
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
    let jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
    if (!jsonRows || jsonRows.length === 0) return []

    // If row 0 keys don't have recognizable column headers (e.g. file has a title block in rows 1-3),
    // look through the first 10 raw rows to find the actual header row.
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })
    const isHeaderRow = (headers: any[]) => {
      if (!Array.isArray(headers)) return false
      const hStr = headers.map(h => String(h || '').trim().toLowerCase()).join(' ')
      return (
        (hStr.includes('name') || hStr.includes('product') || hStr.includes('item') || hStr.includes('particulars')) &&
        (hStr.includes('price') || hStr.includes('rate') || hStr.includes('mrp') || hStr.includes('cost') || hStr.includes('stock') || hStr.includes('barcode') || hStr.includes('qty'))
      )
    }

    let headerRowIdx = 0
    if (rawRows && rawRows.length > 0) {
      for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const row = rawRows[i]
        if (isHeaderRow(row)) {
          headerRowIdx = i
          break
        }
      }
    }

    if (headerRowIdx > 0) {
      jsonRows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, defval: '', raw: false })
      if (!jsonRows || jsonRows.length === 0) return []
    }

    const keys = Object.keys(jsonRows[0] || {})
    if (keys.length === 0) return []

    const cleanHeader = (h: string) => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')

    const findKeyFlexible = (patterns: RegExp[], excludePatterns: RegExp[] = []): string | undefined => {
      return keys.find(k => {
        const raw = k.trim().toLowerCase()
        const clean = cleanHeader(k)
        const isExcluded = excludePatterns.some(ex => ex.test(raw) || ex.test(clean))
        if (isExcluded) return false
        return patterns.some(p => p.test(raw) || p.test(clean))
      })
    }

    const parseNumericValue = (rawVal: any): number => {
      if (rawVal === undefined || rawVal === null || rawVal === '') return NaN
      if (typeof rawVal === 'number') return isNaN(rawVal) ? NaN : rawVal
      let str = String(rawVal).trim().replace(/^[₹$\sRs\.INR]+/i, '').trim()
      if (str.includes(',') && str.includes('.')) {
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
          str = str.replace(/\./g, '').replace(',', '.')
        } else {
          str = str.replace(/,/g, '')
        }
      } else if (str.includes(',')) {
        const parts = str.split(',')
        if (parts.length === 2 && parts[1].length === 2) {
          str = str.replace(',', '.')
        } else {
          str = str.replace(/,/g, '')
        }
      }
      const clean = str.replace(/[^0-9.-]/g, '')
      const val = parseFloat(clean)
      return isNaN(val) ? NaN : val
    }

    // Barcode (Optional)
    const barcodeKey = findKeyFlexible([
      /barcode/i, /bar code/i, /upc/i, /ean/i, /gtin/i, /itemcode/i, /item code/i, /articleno/i, /article no/i, /sku/i, /code/i
    ])

    // Product Name (Compulsory)
    const nameKey = findKeyFlexible([
      /productname/i, /product name/i, /itemname/i, /item name/i, /particulars/i, /product/i, /item/i, /title/i, /description/i, /name/i
    ])

    // Selling Price (Compulsory)
    const sellingPriceKey = findKeyFlexible([
      /sellingprice/i, /selling price/i, /saleprice/i, /sale price/i, /salesprice/i, /sales price/i, /retailprice/i, /retail price/i, /sellingrate/i, /selling rate/i, /salesrate/i, /sales rate/i, /mrp/i, /price/i, /rate/i
    ], [/cost/i, /purchase/i, /buy/i, /cp/i])

    // Cost Price (Compulsory)
    const costPriceKey = findKeyFlexible([
      /costprice/i, /cost price/i, /purchaseprice/i, /purchase price/i, /buyprice/i, /buy price/i, /purchaserate/i, /purchase rate/i, /costrate/i, /cost rate/i, /cost/i, /purchase/i, /cp/i
    ], [/selling/i, /sale/i, /retail/i, /mrp/i])

    // Category (Compulsory)
    const categoryKey = findKeyFlexible([
      /category/i, /cat/i, /department/i, /dept/i, /group/i, /type/i, /classification/i
    ])

    // Stock Quantity (Compulsory)
    const stockKey = findKeyFlexible([
      /quantity/i, /qty/i, /stock/i, /openingstock/i, /currentstock/i, /availablestock/i, /balance/i, /inventory/i, /count/i
    ])

    // Min Stock Alert (Optional)
    const minStockKey = findKeyFlexible([
      /minstock/i, /min stock/i, /lowstock/i, /low stock/i, /threshold/i, /minqty/i, /min qty/i, /reorder/i, /alert/i
    ])

    // Tax Rate (Optional)
    const taxKey = findKeyFlexible([
      /taxrate/i, /tax rate/i, /gstrate/i, /gst rate/i, /tax/i, /gst/i, /vat/i
    ])

    // Unit (Compulsory)
    const unitKey = findKeyFlexible([
      /unit/i, /uom/i, /pack/i, /measurement/i
    ])

    if (!nameKey && !sellingPriceKey && !barcodeKey) return []

    const products: AiExtractedProduct[] = []

    jsonRows.forEach((row) => {
      let name = nameKey ? String(row[nameKey] ?? '').trim() : ''
      if (name.startsWith('₹') || name.startsWith('Rs')) name = ''

      const rawBarcode = barcodeKey ? String(row[barcodeKey] ?? '').trim() : ''
      const sellVal = sellingPriceKey ? parseNumericValue(row[sellingPriceKey]) : NaN
      const costVal = costPriceKey ? parseNumericValue(row[costPriceKey]) : NaN
      const stockVal = stockKey ? parseNumericValue(row[stockKey]) : NaN

      // Skip completely blank rows where there is no name, no barcode, and no price/stock
      if (!name && !rawBarcode && isNaN(sellVal) && isNaN(costVal) && isNaN(stockVal)) {
        return
      }

      if (!name) {
        const altKey = keys.find(k => k !== barcodeKey && String(row[k] ?? '').trim().length > 0 && isNaN(Number(row[k])))
        if (altKey) name = String(row[altKey]).trim()
      }
      if (!name) name = `Item ${products.length + 1}`

      // Barcode (auto-generate if blank)
      let finalBarcode = rawBarcode
      if (!finalBarcode || finalBarcode === 'null' || finalBarcode === 'undefined' || finalBarcode === '0') {
        finalBarcode = 'SZ' + Math.floor(1000000000 + Math.random() * 9000000000).toString()
      } else if (finalBarcode.length < 6 && /^\d+$/.test(finalBarcode) && !barcodeKey?.toLowerCase().includes('barcode')) {
        const foundLongDigit = keys.map(k => String(row[k] ?? '').trim()).find(v => /^\d{7,16}$/.test(v))
        if (foundLongDigit) finalBarcode = foundLongDigit
      }

      const isExistingBarcode = !(finalBarcode.startsWith('SZ') && finalBarcode.length === 12)

      // Selling Price
      let sellingPrice = !isNaN(sellVal) ? Math.max(0, sellVal) : 0

      // Cost Price
      const costPrice = !isNaN(costVal) ? Math.max(0, costVal) : (sellingPrice > 0 ? sellingPrice : 0)
      if (sellingPrice === 0 && costPrice > 0) {
        sellingPrice = costPrice
      }

      // Category
      const categoryName = categoryKey && row[categoryKey] ? String(row[categoryKey]).trim() : 'General'

      // Stock Quantity
      const currentStock = !isNaN(stockVal) ? Math.max(0, Math.floor(stockVal)) : 0

      // Min Stock Alert
      const minStockVal = minStockKey && row[minStockKey] !== '' ? parseNumericValue(row[minStockKey]) : NaN
      const lowStockThreshold = !isNaN(minStockVal) ? Math.max(0, Math.floor(minStockVal)) : 0

      // Tax Rate
      const taxVal = taxKey ? parseNumericValue(row[taxKey]) : NaN
      const taxRate = !isNaN(taxVal) ? Math.max(0, taxVal) : 0

      // Unit
      const rawUnit = unitKey && row[unitKey] ? String(row[unitKey]).trim() : ''
      const unitVal = normalizeUnit(rawUnit)

      // Check if product already exists in user catalog
      const matchedCatalogItem = existingCatalogProducts.find(
        (ep: any) =>
          (finalBarcode && ep.barcode && ep.barcode.toLowerCase().trim() === finalBarcode.toLowerCase().trim()) ||
          (ep.name && ep.name.toLowerCase().trim() === name.toLowerCase().trim())
      )

      products.push({
        id: `csv-format-${Date.now()}-${products.length}`,
        name,
        sellingPrice,
        costPrice,
        categoryName,
        barcode: finalBarcode,
        isExistingBarcode,
        barcodeType: 'CODE128',
        taxRate,
        currentStock,
        lowStockThreshold,
        unit: unitVal,
        priceIncludesGst: false,
        selected: true,
        isAlreadyListed: Boolean(matchedCatalogItem),
        matchedProductId: matchedCatalogItem?.id || null,
        matchedProductName: matchedCatalogItem?.name || null,
        currentCatalogStock: matchedCatalogItem?.currentStock ?? null,
        importAction: matchedCatalogItem ? 'update_stock' : 'create_new',
      })
    })

    return products
  }

  const startActualExtraction = () => {
    if (!selectedFile) {
      toast.error('Please select an Excel, Apple Numbers, or CSV file first.')
      return
    }

    setStep('analyzing')

    // Handle Apple Numbers (.numbers) format via QuickLook preview PDF extraction
    if (fileTypeCategory === 'numbers') {
      const parseNumbersFile = async () => {
        try {
          const zip = await JSZip.loadAsync(selectedFile)

          // 1. Look for QuickLook/Preview.pdf (standard in macOS Numbers)
          const previewPdf = zip.file(/quicklook\/preview\.pdf$/i)[0] || zip.file(/preview\.pdf$/i)[0]
          if (previewPdf) {
            const pdfBlob = await previewPdf.async('blob')
            const reader = new FileReader()
            reader.onload = () => {
              const base64Data = reader.result as string
              sendExtractionRequest(base64Data, 'application/pdf')
            }
            reader.onerror = () => {
              setStep('upload')
              toast.error('Failed to read QuickLook preview from Apple Numbers file.')
            }
            reader.readAsDataURL(pdfBlob)
            return
          }

          // 2. Look for QuickLook/Thumbnail.jpg or image snapshot
          const thumbFile =
            zip.file(/quicklook\/thumbnail\.jpg$/i)[0] ||
            zip.file(/thumbnail\.jpg$/i)[0] ||
            zip.file(/\.(jpg|jpeg|png)$/i)[0]
          if (thumbFile) {
            const imgBlob = await thumbFile.async('blob')
            const reader = new FileReader()
            reader.onload = () => {
              const base64Data = reader.result as string
              sendExtractionRequest(base64Data, 'image/jpeg')
            }
            reader.onerror = () => {
              setStep('upload')
              toast.error('Failed to read thumbnail from Apple Numbers file.')
            }
            reader.readAsDataURL(imgBlob)
            return
          }

          // 3. Look for index.xml (Numbers '08/'09)
          const indexXml = zip.file(/index\.xml$/i)[0]
          if (indexXml) {
            const xmlText = await indexXml.async('string')
            const base64Data = btoa(unescape(encodeURIComponent(xmlText)))
            sendExtractionRequest(`data:text/plain;base64,${base64Data}`, 'text/plain')
            return
          }

          // 4. If Numbers file was saved without QuickLook preview
          setStep('upload')
          toast.error(
            'This Apple Numbers file was saved without a QuickLook preview. In Numbers on Mac, click File > Export To > Excel (.xlsx) or CSV, then upload that file here.',
            { duration: 8000 }
          )
        } catch (err) {
          console.error('Apple Numbers extraction error:', err)
          setStep('upload')
          toast.error('Could not unpack Apple Numbers document. Try exporting to Excel (.xlsx) or CSV from Numbers.')
        }
      }

      parseNumbersFile()
      return
    }

    // Handle CSV, Excel, ODS, TSV, and all spreadsheet files seamlessly using XLSX parser + SEZ AI fallback
    if (fileTypeCategory === 'csv' || fileTypeCategory === 'excel') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })

          // Search sheets for product data
          let directProducts: AiExtractedProduct[] = []
          let activeSheet = workbook.Sheets[workbook.SheetNames[0]]

          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]
            const parsed = parseExcelSheetDirectly(sheet)
            if (parsed.length > 0) {
              directProducts = parsed
              activeSheet = sheet
              break
            }
          }

          const directBarcodeCount = directProducts.filter(p => p.isExistingBarcode).length

          // If parser extracted products with preserved barcodes, use it instantly!
          if (directProducts.length > 0) {
            setExtractedProducts(directProducts)
            setStep('review')
            toast.success(`Extracted all ${directProducts.length} products with ${directBarcodeCount} barcodes preserved!`)
            return
          }

          // 2. Universal SEZ AI Multi-Modal Sheet Extraction (CSV / HTML representation)
          const csvText = XLSX.utils.sheet_to_csv(activeSheet)
          const htmlContent = XLSX.utils.sheet_to_html(activeSheet)
          const textPayload = (csvText && csvText.trim().length > 0) ? csvText : htmlContent

          if (!textPayload || textPayload.trim().length === 0) {
            setStep('upload')
            toast.error('The uploaded spreadsheet file appears to be empty.')
            return
          }

          const base64Data = btoa(unescape(encodeURIComponent(textPayload)))
          sendExtractionRequest(`data:text/csv;base64,${base64Data}`, 'text/csv')
        } catch (err) {
          setStep('upload')
          toast.error('Failed to parse spreadsheet file. Please check file formatting.')
          readAndSendFile(selectedFile)
        }
      }
      reader.readAsArrayBuffer(selectedFile)
    } else {
      readAndSendFile(selectedFile)
    }
  }

  const handleStartExtraction = () => {
    if (!selectedFile) {
      toast.error('Please select an Excel (.xlsx) or CSV file first.')
      return
    }
    setShowSampleConfirmModal(true)
  }

  const handleConfirmAndStartExtraction = () => {
    setShowSampleConfirmModal(false)
    startActualExtraction()
  }

  const readAndSendFile = async (file: File) => {
    // Photos and screenshots get downscaled + contrast-normalized first —
    // oversized, unevenly-lit images are the main reason extraction fails.
    if (file.type.startsWith('image/')) {
      try {
        const processed = await preprocessImageForOcr(file)
        if (processed.isLowResolution) {
          toast('This image is quite low resolution — extraction may miss items.')
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
            toast.success(`Successfully parsed ${res.count} products! (${preservedCount} barcodes preserved)`)
          } else {
            setStep('upload')
            toast.error('Could not find any product items in the file. Please check your sheet data.')
          }
        },
        onError: (err) => {
          setStep('upload')
          const msg = err instanceof Error ? err.message : 'File parsing failed'
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
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES], exact: false })
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS], exact: false })
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.REPORTS_TOP_CATEGORIES], exact: false })
        qc.refetchQueries({ queryKey: [QUERY_KEYS.CATEGORIES], exact: false })
        qc.refetchQueries({ queryKey: [QUERY_KEYS.PRODUCTS], exact: false })
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
    setShowSampleConfirmModal(false)
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

  const sampleItemsFound = useMemo(() => {
    const sampleNames = [
      'parle-g gold 100g',
      'amul butter 500g',
      'basmati rice classic 1kg',
      'ariel matic detergent powder 2kg',
      'fresh cow milk 1l',
    ]
    return extractedProducts.filter(p => sampleNames.includes(p.name.toLowerCase().trim()))
  }, [extractedProducts])

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
          <div className="space-y-3.5">
            {/* Step 1: Download Standard Template */}
            <div className="px-4 py-3 sm:py-3.5 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/90 dark:from-blue-950/30 dark:via-dark-elevated dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-blue-950 dark:text-blue-300">
                    Step 1: Download Bulk Upload Template
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">
                    Pre-formatted columns, in-cell dropdown for Units & sample rows.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => downloadBulkUploadTemplate('xlsx')}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-8 sm:h-8.5 px-3.5 flex items-center gap-1.5 shadow-xs"
                  leftIcon={<Download size={14} />}
                >
                  Download Excel (.xlsx)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadBulkUploadTemplate('csv')}
                  className="text-xs font-semibold h-8 sm:h-8.5 px-3 dark:bg-dark-elevated dark:border-dark-border-strong dark:text-zinc-200 dark:hover:bg-dark-hover dark:hover:text-white flex items-center gap-1.5"
                  leftIcon={<Download size={14} />}
                >
                  CSV (.csv)
                </Button>
              </div>
            </div>

            {/* Warning: Remove Sample Products Before Uploading */}
            <div className="px-4 py-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/25 border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs backdrop-blur-sm">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0 border border-amber-500/25 flex items-center justify-center mt-0.5 sm:mt-0">
                  <SpreadsheetDeleteRowsIcon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-amber-950 dark:text-amber-200 text-xs sm:text-[13px] flex items-center gap-1.5">
                    <CautionBadgeIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Delete Demo Rows (2–6) Before Uploading:</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5 leading-relaxed">
                    Template includes 5 demo items. Delete rows 2–6 in Excel so demo products aren't imported.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 shrink-0 bg-amber-500/15 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/25 self-start sm:self-center">
                <CustomLightbulbIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Select Rows 2–6 &rarr; Delete</span>
              </div>
            </div>

            {/* Step 2: Format Guidelines & Disclaimer */}
            <div className="px-4 py-3 sm:py-3.5 rounded-xl bg-amber-50/50 dark:bg-dark-elevated/70 border border-amber-200/70 dark:border-dark-border-strong space-y-2.5 text-xs backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">
                  <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  </div>
                  <span>Format Guidelines & Required Columns</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
                  <span>Accepted:</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/50 text-[10.5px]">
                    Excel (.xlsx, .xls, .xlsm, .xlsb)
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/50 text-[10.5px]">
                    Apple Numbers (.numbers)
                  </span>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/50 text-[10.5px]">
                    CSV (.csv, .tsv)
                  </span>
                  <span className="font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200/60 dark:border-purple-800/50 text-[10.5px]">
                    ODS (.ods)
                  </span>
                </div>
              </div>

              {/* Mac Apple Numbers compatibility banner */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 text-[11.5px] text-emerald-900 dark:text-emerald-200">
                <span className="font-bold shrink-0">🍎 Mac Users:</span>
                <span>You can upload native <strong>.numbers</strong> spreadsheets directly. Our engine automatically parses the document via QuickLook vision!</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Compulsory Fields */}
                <div className="space-y-2 bg-white/90 dark:bg-dark-card p-3 rounded-lg border border-emerald-200/80 dark:border-emerald-500/25 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 text-xs sm:text-[13px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Compulsory Fields
                    </p>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      Required
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[11px]">
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Product Name*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Title</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Category*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Category</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Cost Price*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Cost ₹</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Selling Price*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">MRP ₹</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Stock Qty*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Count (≥ 0)</span>
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Unit*</strong>:{' '}
                      <span className="text-slate-500 dark:text-zinc-400">Dropdown</span>
                    </div>
                  </div>

                  {/* Unit codes row */}
                  <div className="pt-2 border-t border-emerald-100/80 dark:border-dark-border flex flex-wrap items-center gap-1 font-mono text-[9.5px]">
                    <span className="font-sans font-semibold text-slate-700 dark:text-zinc-300 text-[10.5px] mr-0.5">
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
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50"
                      >
                        {u.label}
                        <span className="text-emerald-700/60 dark:text-emerald-400/60 ml-0.5 font-sans text-[8.5px]">({u.id})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Optional Fields */}
                <div className="space-y-2 bg-white/90 dark:bg-dark-card p-3 rounded-lg border border-blue-200/80 dark:border-blue-500/25 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1.5 text-xs sm:text-[13px]">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      Optional Fields
                    </p>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                      Auto-Handled
                    </span>
                  </div>

                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-zinc-300 pl-3.5 list-disc marker:text-blue-500">
                    <li>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Barcode</strong>: If blank, auto-generates{' '}
                      <code className="text-blue-700 dark:text-blue-300 font-mono font-bold bg-blue-50 dark:bg-blue-950/60 px-1 py-0.2 rounded border border-blue-200/60 dark:border-blue-800/50 text-[9.5px]">
                        SZ...
                      </code>{' '}
                      (existing preserved)
                    </li>
                    <li>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Min Stock Alert</strong>: Defaults to{' '}
                      <span className="px-1 py-0.2 rounded bg-gray-100 dark:bg-dark-elevated text-slate-900 dark:text-zinc-100 font-bold border border-gray-200 dark:border-dark-border-strong text-[9.5px]">
                        0
                      </span>{' '}
                      if blank
                    </li>
                    <li>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Tax Rate %</strong>: Applicable GST percentage (default 0%)
                    </li>
                    <li>
                      <strong className="text-slate-900 dark:text-zinc-100 font-semibold">Brand & Description</strong>: Optional product notes
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 3: File Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-200 dark:border-blue-500/30 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl px-6 py-5 sm:py-6 text-center cursor-pointer transition-all bg-slate-50/60 dark:bg-dark-card hover:bg-blue-50/40 dark:hover:bg-dark-elevated/80 group shadow-2xs"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.numbers,.ods,.tsv,.xlsm,.xlsb,.dif,.prn,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values,application/vnd.oasis.opendocument.spreadsheet,application/x-iwork-numbers-sffnumbers,application/vnd.apple.numbers"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-3.5 py-1">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-500/30 shadow-2xs">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 truncate max-w-md">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {fileTypeCategory === 'numbers' ? 'APPLE NUMBERS (.numbers)' : `${fileTypeCategory.toUpperCase()} FORMAT`} •{' '}
                      <span className="text-blue-600 dark:text-blue-400 font-semibold underline">Click to replace file</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-100/80 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-blue-200/50 dark:border-blue-500/30 shadow-2xs mb-0.5">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100">
                    Drop your completed Excel, Apple Numbers (.numbers), or CSV file here, or{' '}
                    <span className="text-blue-600 dark:text-blue-400 underline decoration-blue-400/50 hover:text-blue-500 font-semibold">Browse</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Supports Excel (.xlsx, .xls, .xlsm, .xlsb), Apple Numbers (.numbers), CSV (.csv, .tsv), and OpenDocument (.ods) — max 20MB, up to 5,000 products per batch
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-16 text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-600 animate-spin" />
              <FileSpreadsheet className="w-10 h-10 text-purple-600 dark:text-purple-400 animate-pulse" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <Badge variant="info" className="px-3 py-1 text-xs font-bold animate-pulse">
                Parsing Spreadsheet
              </Badge>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Parsing Your Product List...
              </h3>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 transition-all duration-300">
                <p className="text-xs font-semibold text-purple-900 dark:text-purple-200 animate-fade-in">
                  {SPREADSHEET_PARSING_MESSAGES[loadingMsgIdx % SPREADSHEET_PARSING_MESSAGES.length]}
                </p>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Reading rows, mapping prices, categories, and preserving barcodes...
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
            {/* Verification Notice & Review Warning Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-dark-elevated border border-amber-300/80 dark:border-amber-500/30 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
              <div className="p-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <CautionBadgeIcon className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="font-bold text-amber-950 dark:text-amber-300">
                  Please Verify Your Product List
                </p>
                <p className="text-[11px] text-amber-800 dark:text-zinc-300 leading-relaxed">
                  Please inspect and verify product names, prices, categories, and barcodes below before clicking import into your inventory.
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

            {/* Detected Sample Demo Products Banner */}
            {sampleItemsFound.length > 0 && (
              <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50/90 dark:bg-rose-950/30 border border-rose-300/80 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                    <SpreadsheetDeleteRowsIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-rose-950 dark:text-rose-300">
                      Template Sample Products Detected ({sampleItemsFound.length} items)
                    </p>
                    <p className="text-[11px] text-rose-800 dark:text-zinc-300 mt-0.5">
                      Your file includes demo items from the template ({sampleItemsFound.map(s => s.name).join(', ')}). 
                      Remove them if they are not part of your real store inventory.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setExtractedProducts(prev => prev.filter(p => !sampleItemsFound.some(s => s.id === p.id)))
                    toast.success(`Removed ${sampleItemsFound.length} demo products from import list`)
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-7 px-3 shrink-0"
                >
                  Remove {sampleItemsFound.length} Demo Items
                </Button>
              </div>
            )}

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
                    <th className="p-3 text-right min-w-[90px]">Cost Price (₹)</th>
                    <th className="p-3 text-right min-w-[90px]">Sell Price (₹)</th>
                    <th className="p-3 text-center min-w-[70px]">Stock</th>
                    <th className="p-3 min-w-[80px]">Unit</th>
                    <th className="p-3 min-w-[170px]">Barcode & Origin</th>
                    <th className="p-3 min-w-[80px]">GST %</th>
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
                            value={product.costPrice}
                            onChange={e => handleUpdateProductField(product.id, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right bg-transparent border border-gray-200 dark:border-dark-border hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-dark-card rounded px-2 py-1 text-xs text-gray-700 dark:text-zinc-200"
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
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 whitespace-nowrap inline-flex items-center gap-1">
                                <FileText className="w-2.5 h-2.5" /> Doc
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 whitespace-nowrap inline-flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Auto
                              </span>
                            )}
                          </div>
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

                    {/* Inputs Grid: Category, Cost Price, Sell Price */}
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
                        <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">Cost (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.costPrice}
                          onChange={e => handleUpdateProductField(product.id, 'costPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-2 py-1 text-gray-700 dark:text-zinc-200"
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
                    </div>

                    {/* Stock, Unit, GST % */}
                    <div className="grid grid-cols-3 gap-2">
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
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">GST %</label>
                        <input
                          type="number"
                          value={product.taxRate}
                          onChange={e => handleUpdateProductField(product.id, 'taxRate', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-1.5 py-1 text-center"
                        />
                      </div>
                    </div>

                    {/* Barcode & Origin */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5">
                          Barcode
                          {product.isExistingBarcode ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 whitespace-nowrap inline-flex items-center gap-1">
                              <FileText className="w-2.5 h-2.5" /> Doc
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 whitespace-nowrap inline-flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> Auto
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRegenerateBarcode(product.id)}
                          className="text-purple-600 dark:text-purple-400 hover:underline text-[10px] flex items-center gap-1"
                        >
                          <RotateCw className="w-3 h-3" /> Generate New
                        </button>
                      </label>
                      <input
                        type="text"
                        value={product.barcode}
                        onChange={e => handleUpdateProductField(product.id, 'barcode', e.target.value)}
                        className="w-full bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-2 py-1 font-mono font-bold text-gray-900 dark:text-gray-100"
                      />
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
                  {IMPORT_LOADING_MESSAGES[loadingMsgIdx % IMPORT_LOADING_MESSAGES.length]}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Popup: Did you remove sample products? */}
        {showSampleConfirmModal && selectedFile && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setShowSampleConfirmModal(false)}
          >
            <div
              className="relative w-full max-w-md bg-white dark:bg-dark-card border border-amber-300/80 dark:border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                  <SpreadsheetDeleteRowsIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-300 text-sm sm:text-base">
                    <CautionBadgeIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Did you remove sample products?</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                    {selectedFile.name} • {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSampleConfirmModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <div className="space-y-2 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                <p>
                  If you used our template, it includes <strong>5 demo sample products</strong> (<em>Parle-G, Amul Butter, etc.</em>).
                </p>
                <p>
                  Before we proceed with parsing and importing, please ensure you have <strong>deleted demo sample rows</strong> (or replaced them with your own products) so sample test items are not imported into your inventory.
                </p>
              </div>

              {/* Tip Box */}
              <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/25 text-[11px] text-amber-900 dark:text-amber-200/90 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-300">
                  <CustomLightbulbIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>How to remove in Numbers / Excel / Sheets:</span>
                </div>
                <p className="text-slate-700 dark:text-zinc-300">
                  Select sample rows on the left &rarr; right-click &rarr; click <strong className="underline text-amber-950 dark:text-amber-200">Delete Rows</strong>.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-dark-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSampleConfirmModal(false)}
                  className="text-xs font-semibold px-3 py-2 dark:bg-dark-elevated dark:border-dark-border-strong dark:text-zinc-300"
                >
                  Check File First
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmAndStartExtraction}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Yes, Proceed & Process
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export const AiDocumentUploadModal = BulkProductUploadModal
