import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ScanReadyIndicator } from '@/components/ui/ScanReadyIndicator'

import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { useBarcodeProductLookup, useBatchBarcodeStockUpdate } from '@/hooks/useProducts'
import type { BarcodeStockEntry } from '@/types/barcode.types'
import { Barcode, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface BarcodeStockUpdateModalProps {
  isOpen: boolean
  onClose: () => void
}

export const BarcodeStockUpdateModal = ({ isOpen, onClose }: BarcodeStockUpdateModalProps) => {
  const [entries, setEntries] = useState<BarcodeStockEntry[]>([])
  const [unknownBarcodes, setUnknownBarcodes] = useState<string[]>([])
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setEntries([])
      setUnknownBarcodes([])
    }
  }

  const [scanning, setScanning] = useState(false)

  const { mutate: lookupProduct, isPending: isLookingUp } = useBarcodeProductLookup()
  const { mutate: batchUpdate, isPending: isUpdating } = useBatchBarcodeStockUpdate()

  const handleScan = useCallback((barcode: string) => {
    setScanning(true)

    // Check if already in unknown list
    if (unknownBarcodes.includes(barcode)) {
      setScanning(false)
      return
    }

    // Check if already in entries
    const existing = entries.find(e => e.barcode === barcode)
    if (existing) {
      setEntries(prev =>
        prev.map(e =>
          e.barcode === barcode ? { ...e, qtyToAdd: e.qtyToAdd + 1 } : e
        )
      )
      setScanning(false)
      toast.success(`Quantity updated for ${entries.find(e => e.barcode === barcode)?.productName}`)
      return
    }

    lookupProduct(barcode, {
      onSuccess: (product) => {
        if (product) {
          const newEntry: BarcodeStockEntry = {
            productId: product.id,
            productName: product.name,
            barcode: product.barcode ?? barcode,
            currentStock: product.currentStock,
            qtyToAdd: 1,
            unit: product.unit,
          }
          setEntries(prev => [...prev, newEntry])
          toast.success(`Found: ${product.name}`)
        } else {
          setUnknownBarcodes(prev => {
            if (prev.includes(barcode)) return prev
            return [...prev, barcode]
          })
          toast.error(`Barcode not found: ${barcode}`)
        }
        setScanning(false)
      },
      onError: () => {
        toast.error('Failed to lookup product')
        setScanning(false)
      },
    })
  }, [entries, unknownBarcodes, lookupProduct])

  useBarcodeScanner({
    mode: 'stock-update',
    onScan: handleScan,
    enabled: isOpen,
  })

  const updateQty = (barcode: string, qty: number) => {
    if (qty < 0) return
    setEntries(prev =>
      prev.map(e =>
        e.barcode === barcode ? { ...e, qtyToAdd: qty } : e
      )
    )
  }

  const removeEntry = (barcode: string) => {
    setEntries(prev => prev.filter(e => e.barcode !== barcode))
  }

  const removeUnknown = (barcode: string) => {
    setUnknownBarcodes(prev => prev.filter(b => b !== barcode))
  }

  const handleUpdateStock = () => {
    if (entries.length === 0) {
      toast.error('No products scanned')
      return
    }

    batchUpdate(entries, {
      onSuccess: () => {
        toast.success(`Stock updated for ${entries.length} product${entries.length > 1 ? 's' : ''}`)
        setEntries([])
        setUnknownBarcodes([])
        onClose()
      },
      onError: () => {
        toast.error('Failed to update stock')
      },
    })
  }

  const handleClearAll = () => {
    setEntries([])
    setUnknownBarcodes([])
  }




  const totalItems = entries.length
  const totalQty = entries.reduce((sum, e) => sum + e.qtyToAdd, 0)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan to Update Stock" size="lg">
      <div className="space-y-6">
        {/* Scanner Status */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-3">
            <Barcode size={20} className="text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Barcode Scanner</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Scan product barcodes to add them to the update list</p>
            </div>
          </div>
          <ScanReadyIndicator isActive={isOpen && !isLookingUp} label={isLookingUp ? 'Looking up...' : 'Scan Ready'} />
        </div>

        {/* Scanning Progress Indicator */}
        {scanning && (
          <div className="flex items-center justify-center py-3 text-sm text-emerald-600">
            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing scan...
          </div>
        )}

        {/* Unknown Barcodes */}
        {unknownBarcodes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500" />
              Unknown Barcodes
            </h4>
            <div className="space-y-2">
              {unknownBarcodes.map(barcode => (
                <div
                  key={barcode}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">{barcode}</p>
                      <p className="text-xs text-amber-600">Product not found — add product first</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeUnknown(barcode)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scanned Entries */}
        {entries.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" />
                Scanned Products ({totalItems})
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {totalQty} total units
              </span>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {entries.map((entry, index) => (
                <div
                  key={entry.barcode}
                  className="flex items-center gap-4 p-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                >
                  <span className="text-sm font-bold text-gray-400 w-6">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{entry.productName}</p>
                    <p className="text-xs text-gray-400 font-mono">{entry.barcode} · Stock: {entry.currentStock} {entry.unit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Qty:</label>
                    <input
                      type="number"
                      min={0}
                      value={entry.qtyToAdd}
                      onChange={e => updateQty(entry.barcode, parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <span className="text-xs text-gray-400 w-8">{entry.unit}</span>
                  </div>
                  <button
                    onClick={() => removeEntry(entry.barcode)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {entries.length === 0 && unknownBarcodes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Barcode size={48} className="mb-4 opacity-30" />
            <p className="text-sm">Start scanning products with a barcode scanner</p>
            <p className="text-xs mt-1">Each scan will look up the product and add it to the list</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="primary"
            onClick={handleUpdateStock}
            loading={isUpdating}
            disabled={entries.length === 0 || isUpdating}
            className="flex-1"
            leftIcon={<CheckCircle size={16} />}
          >
            Update Stock ({totalItems} products, {totalQty} units)
          </Button>
          <Button
            variant="outline"
            onClick={handleClearAll}
            disabled={entries.length === 0 && unknownBarcodes.length === 0}
          >
            Clear All
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
