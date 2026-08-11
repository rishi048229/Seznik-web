import React, { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useAiExtractDocument, useBulkImportProducts } from '@/hooks/useProducts'
import { type AiExtractedProduct } from '@/services/productService'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import {
  Sparkles,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
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
  Bot
} from 'lucide-react'
import toast from 'react-hot-toast'

interface AiDocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

const SEZ_AI_LOADING_MESSAGES = [
  '✨ SEZ AI is scanning your uploaded file and parsing rows...',
  '🤖 SEZ AI is intelligent-mapping product names, prices & units...',
  '⚡ SEZ AI is detecting existing barcodes & generating unique 12-digit barcodes for new items...',
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
  const [fileTypeCategory, setFileTypeCategory] = useState<'image' | 'pdf' | 'excel' | 'text'>('image')
  const [searchFilter, setSearchFilter] = useState('')
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)

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

    setSelectedFile(file)
    const lowerName = file.name.toLowerCase()

    if (file.type.startsWith('image/')) {
      setFileTypeCategory('image')
      const reader = new FileReader()
      reader.onload = () => setFilePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else if (
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.ods') ||
      file.type.includes('sheet') ||
      file.type.includes('excel') ||
      file.type.includes('csv')
    ) {
      setFileTypeCategory('excel')
      setFilePreview(null)
    } else if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
      setFileTypeCategory('pdf')
      setFilePreview(null)
    } else {
      setFileTypeCategory('text')
      setFilePreview(null)
    }
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

  const handleStartExtraction = () => {
    if (!selectedFile) {
      toast.error('Please select an Excel sheet, PDF, bill, or menu file first.')
      return
    }

    setStep('analyzing')

    // If Excel or CSV file, convert to CSV text in frontend using XLSX library
    if (fileTypeCategory === 'excel') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[firstSheetName]
          const csvText = XLSX.utils.sheet_to_csv(sheet)

          if (!csvText || csvText.trim().length === 0) {
            setStep('upload')
            toast.error('The uploaded Excel spreadsheet appears to be empty.')
            return
          }

          const base64Data = btoa(unescape(encodeURIComponent(csvText)))

          sendExtractionRequest(`data:text/csv;base64,${base64Data}`, 'text/csv')
        } catch (err) {
          setStep('upload')
          toast.error('Failed to parse Excel spreadsheet file. Please check file format.')
        }
      }
      reader.readAsArrayBuffer(selectedFile)
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        const base64Data = reader.result as string
        sendExtractionRequest(base64Data, selectedFile.type || 'image/jpeg')
      }
      reader.readAsDataURL(selectedFile)
    }
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
            toast.success(`SEZ AI successfully extracted ${res.count} products!`)
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
        // Force immediate invalidation and refetch of categories & products queries
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title="SEZ AI Smart Bulk Product & Barcode Extractor"
      size="xl"
    >
      <div className="space-y-6">
        {step === 'upload' && (
          <div className="space-y-5">
            {/* SEZ AI Capability Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/10 via-blue-900/10 to-indigo-900/10 dark:from-purple-900/30 dark:via-blue-900/30 dark:to-indigo-900/30 border border-purple-200 dark:border-purple-800/50 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-purple-900 dark:text-purple-200">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-pulse" />
                <span>Upload Excel Spreadsheets, Bills, Menus, or Handwritten Receipts</span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                SEZ AI intelligently maps columns, reads handwritten bills, supplier invoices, hotel menus, and price sheets. It auto-generates missing barcodes, assigns smart categories, and calculates prices!
              </p>
              
              {/* Capacity Banner */}
              <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg font-medium border border-emerald-200 dark:border-emerald-800/40">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>Excel / CSV Spreadsheets:</strong> Up to 5,000 products per file</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg font-medium border border-blue-200 dark:border-blue-800/40">
                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span><strong>Images & PDF Bills / Menus:</strong> Up to 1,000 items per file</span>
                </div>
              </div>
            </div>

            {/* File Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-300 dark:border-purple-700/60 hover:border-purple-600 dark:hover:border-purple-400 rounded-2xl p-8 text-center cursor-pointer transition-all bg-gray-50/50 dark:bg-gray-800/40 hover:bg-purple-50/40 dark:hover:bg-purple-900/20 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.xlsx,.xls,.csv,.ods,text/plain"
                onChange={handleFileSelect}
                className="hidden"
              />

              {filePreview ? (
                <div className="space-y-3">
                  <img
                    src={filePreview}
                    alt="Document preview"
                    className="max-h-48 mx-auto rounded-xl shadow-md border border-gray-200 dark:border-gray-700 object-contain"
                  />
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{selectedFile?.name}</p>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Click or drag to replace document</p>
                </div>
              ) : selectedFile ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto">
                    {fileTypeCategory === 'excel' ? (
                      <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                    ) : fileTypeCategory === 'pdf' ? (
                      <FileText className="w-8 h-8 text-blue-600" />
                    ) : (
                      <UploadCloud className="w-8 h-8" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {fileTypeCategory.toUpperCase()} Format
                  </p>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Click to change file</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                      Drop your Excel Sheet, Bill, Menu, or Invoice here
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Supports Excel (.xlsx, .xls, .csv, .ods), JPG, PNG, WEBP & PDF files (Max 20MB)
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="mt-2">
                    Browse File
                  </Button>
                </div>
              )}
            </div>

            {/* Submit Extraction Button */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={handleResetAndClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleStartExtraction}
                disabled={!selectedFile || isExtracting}
                loading={isExtracting}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold"
                leftIcon={<Sparkles size={16} />}
              >
                Analyze with SEZ AI
              </Button>
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
                Extracting items, mapping prices, creating categories, and auto-generating barcodes...
              </p>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {/* Top Stat Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40">
                <p className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">SEZ AI Extracted</p>
                <p className="text-xl font-bold text-purple-900 dark:text-purple-100">{extractedProducts.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
                <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">Selected to Import</p>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{selectedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">In-Document Barcodes</p>
                <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{existingBarcodeCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Auto Barcodes</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-100">{autoBarcodeCount}</p>
              </div>
            </div>

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
            <div className="hidden md:block max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl">
              <table className="w-full text-left text-xs divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 font-bold text-gray-700 dark:text-gray-300 z-10">
                  <tr>
                    <th className="p-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={extractedProducts.length > 0 && extractedProducts.every(p => p.selected)}
                        onChange={e => handleToggleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
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
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-gray-500">
                        No products match your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => (
                      <tr
                        key={product.id}
                        className={product.selected ? 'bg-purple-50/30 dark:bg-purple-900/10' : 'opacity-60'}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={product.selected}
                            onChange={() => handleToggleSelectProduct(product.id)}
                            className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                        <td className="p-2 font-semibold text-gray-900 dark:text-gray-100">
                          <input
                            type="text"
                            value={product.name}
                            onChange={e => handleUpdateProductField(product.id, 'name', e.target.value)}
                            className="w-full bg-transparent border border-gray-200 dark:border-gray-700 hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-2 py-1 text-xs font-semibold"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={product.categoryName}
                            onChange={e => handleUpdateProductField(product.id, 'categoryName', e.target.value)}
                            className="w-full bg-transparent border border-gray-200 dark:border-gray-700 hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={product.sellingPrice}
                            onChange={e => handleUpdateProductField(product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right bg-transparent border border-gray-200 dark:border-gray-700 hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-2 py-1 text-xs font-bold text-purple-900 dark:text-purple-100"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={product.costPrice}
                            onChange={e => handleUpdateProductField(product.id, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right bg-transparent border border-gray-200 dark:border-gray-700 hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-2 py-1 text-xs text-gray-700 dark:text-gray-300"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="1"
                            value={product.taxRate}
                            onChange={e => handleUpdateProductField(product.id, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="w-16 text-center bg-transparent border border-gray-200 dark:border-gray-700 hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-1.5 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2 font-mono">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={product.barcode}
                              onChange={e => handleUpdateProductField(product.id, 'barcode', e.target.value)}
                              className="w-28 bg-transparent border border-gray-200 dark:border-gray-700 hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-1.5 py-1 text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleRegenerateBarcode(product.id)}
                              title="Regenerate Barcode"
                              className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
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
                            className="w-16 text-center bg-transparent border border-gray-200 dark:border-gray-700 hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-1.5 py-1 text-xs font-semibold"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={product.unit}
                            onChange={e => handleUpdateProductField(product.id, 'unit', e.target.value)}
                            className="w-16 bg-transparent border border-gray-200 dark:border-gray-700 hover:border-purple-400 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-1.5 py-1 text-xs"
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD VIEW (md:hidden block) */}
            <div className="md:hidden space-y-3 max-h-96 overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl">
                  No products match your search filter.
                </div>
              ) : (
                filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-3 transition-colors ${
                      product.selected
                        ? 'bg-purple-50/40 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/60'
                        : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-60'
                    }`}
                  >
                    {/* Header Row: Checkbox, Name, Delete */}
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={product.selected}
                        onChange={() => handleToggleSelectProduct(product.id)}
                        className="mt-1.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Product Name</label>
                        <input
                          type="text"
                          value={product.name}
                          onChange={e => handleUpdateProductField(product.id, 'name', e.target.value)}
                          className="w-full font-bold text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-purple-500 rounded-lg px-2.5 py-1 text-gray-900 dark:text-gray-100"
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
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Category</label>
                        <input
                          type="text"
                          value={product.categoryName}
                          onChange={e => handleUpdateProductField(product.id, 'categoryName', e.target.value)}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Selling (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.sellingPrice}
                          onChange={e => handleUpdateProductField(product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 font-bold text-purple-900 dark:text-purple-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Cost (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.costPrice}
                          onChange={e => handleUpdateProductField(product.id, 'costPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300"
                        />
                      </div>
                    </div>

                    {/* Barcode & Regenerate */}
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-between">
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
                          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">GST %</label>
                          <input
                            type="number"
                            value={product.taxRate}
                            onChange={e => handleUpdateProductField(product.id, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 text-center"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Stock</label>
                          <input
                            type="number"
                            value={product.currentStock}
                            onChange={e => handleUpdateProductField(product.id, 'currentStock', parseInt(e.target.value) || 0)}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 text-center font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Unit</label>
                          <input
                            type="text"
                            value={product.unit}
                            onChange={e => handleUpdateProductField(product.id, 'unit', e.target.value)}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-1 py-1 text-center"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
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

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Ready to import <strong className="text-purple-600 dark:text-purple-400">{selectedCount}</strong> products into your inventory.
              </p>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={handleResetAndClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={selectedCount === 0 || isImporting}
                  loading={isImporting}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                  leftIcon={<CheckCircle2 size={16} />}
                >
                  Import {selectedCount} Selected Products
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
