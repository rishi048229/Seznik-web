import React, { useState, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useAiExtractDocument, useBulkImportProducts } from '@/hooks/useProducts'
import { type AiExtractedProduct } from '@/services/productService'
import { formatINR } from '@/utils/currency'
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
  Layers,
  Key,
  HelpCircle,
  RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface AiDocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AiDocumentUploadModal: React.FC<AiDocumentUploadModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [customApiKey, setCustomApiKey] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  const [extractedProducts, setExtractedProducts] = useState<AiExtractedProduct[]>([])
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review'>('upload')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { mutate: extractDocument, isPending: isExtracting } = useAiExtractDocument()
  const { mutate: bulkImport, isPending: isImporting } = useBulkImportProducts()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.')
      return
    }

    setSelectedFile(file)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setFilePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds 10MB limit.')
        return
      }
      setSelectedFile(file)
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => setFilePreview(reader.result as string)
        reader.readAsDataURL(file)
      } else {
        setFilePreview(null)
      }
    }
  }

  const handleStartExtraction = () => {
    if (!selectedFile) {
      toast.error('Please select an invoice, bill, or menu document file first.')
      return
    }

    setStep('analyzing')

    const reader = new FileReader()
    reader.onload = () => {
      const base64Data = reader.result as string

      extractDocument(
        {
          documentData: base64Data,
          mimeType: selectedFile.type || 'image/jpeg',
        },
        {
          onSuccess: (res) => {
            if (res.products && res.products.length > 0) {
              setExtractedProducts(res.products)
              setStep('review')
              toast.success(`Gemini AI successfully extracted ${res.count} products!`)
            } else {
              setStep('upload')
              toast.error('AI could not find any product items in the document. Please try a clearer document.')
            }
          },
          onError: (err) => {
            setStep('upload')
            const msg = err instanceof Error ? err.message : 'AI document analysis failed'
            toast.error(msg)
          },
        }
      )
    }
    reader.readAsDataURL(selectedFile)
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

  const handleConfirmImport = () => {
    const selectedList = extractedProducts.filter(p => p.selected)
    if (selectedList.length === 0) {
      toast.error('Please select at least 1 product to import.')
      return
    }

    bulkImport(selectedList, {
      onSuccess: (res) => {
        toast.success(`Successfully imported ${res.count} products into your inventory!`)
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
      title="AI Document Bulk Product & Barcode Extractor"
      size="xl"
    >
      <div className="space-y-6">
        {step === 'upload' && (
          <div className="space-y-5">
            {/* Explanatory Box */}
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 text-xs text-purple-900 dark:text-purple-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Upload Bills, Menus, Catalogs, or Handwritten Receipts
              </div>
              <p>
                Upload any Supplier Invoice, Purchase Bill, Restaurant Menu, Price Catalog, or Handwritten Receipt.
                Gemini AI will read 100s of products, prices, categories, and barcodes. If a product lacks a barcode, a unique 12-digit barcode is automatically generated!
              </p>
            </div>

            {/* File Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-400 rounded-2xl p-8 text-center cursor-pointer transition-all bg-gray-50/50 dark:bg-gray-800/50 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.csv,text/plain"
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
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{selectedFile?.name}</p>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Click or drag to replace document</p>
                </div>
              ) : selectedFile ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Click to change file</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                      Drop your Bill, Menu, or Invoice here
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Supports JPG, PNG, WEBP, PDF documents & CSV price lists (Max 10MB)
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
                Analyze & Extract Products
              </Button>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="py-16 text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-600 animate-spin" />
              <Sparkles className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Gemini AI is Analyzing Your Document...
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1">
                Extracting product names, selling prices, categories, stock, and existing barcodes. Generating unique barcodes for items without one...
              </p>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {/* Top Stat Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40">
                <p className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">Extracted Products</p>
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

            {/* Filter Search Bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Filter extracted items by name, category, or barcode..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStep('upload')}
                leftIcon={<RefreshCw size={14} />}
              >
                Re-upload Document
              </Button>
            </div>

            {/* Extracted Products Review Table */}
            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl">
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
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Selling Price</th>
                    <th className="p-3 text-right">Cost Price</th>
                    <th className="p-3">Barcode & Origin</th>
                    <th className="p-3 text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-500">
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
                        <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                          <input
                            type="text"
                            value={product.name}
                            onChange={e => handleUpdateProductField(product.id, 'name', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-1.5 py-1 font-semibold"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={product.categoryName}
                            onChange={e => handleUpdateProductField(product.id, 'categoryName', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-1.5 py-1"
                          />
                        </td>
                        <td className="p-3 text-right font-bold text-gray-900 dark:text-gray-100">
                          <input
                            type="number"
                            step="0.01"
                            value={product.sellingPrice}
                            onChange={e => handleUpdateProductField(product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-1.5 py-1 font-bold"
                          />
                        </td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-400">
                          <input
                            type="number"
                            step="0.01"
                            value={product.costPrice}
                            onChange={e => handleUpdateProductField(product.id, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 text-right bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-1.5 py-1"
                          />
                        </td>
                        <td className="p-3 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{product.barcode}</span>
                            {product.isExistingBarcode ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                📌 In Document
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                                ✨ Auto-Generated
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center font-medium">
                          <input
                            type="number"
                            value={product.currentStock}
                            onChange={e => handleUpdateProductField(product.id, 'currentStock', parseInt(e.target.value) || 0)}
                            className="w-16 text-center bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded px-1.5 py-1 font-semibold"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ready to import <strong className="text-purple-600 dark:text-purple-400">{selectedCount}</strong> products with auto-category creation.
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
