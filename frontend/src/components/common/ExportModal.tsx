import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  FileSpreadsheet, FileText, Image as ImageIcon, Download, CheckCircle2,
  Store, Building2, Phone, Hash, Layers, Package
} from 'lucide-react'
import toast from 'react-hot-toast'

export type ExportFormat = 'excel' | 'pdf' | 'image'

export interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  totalCount: number
  itemLabel?: string
  storeName?: string
  businessName?: string
  businessGSTIN?: string
  businessPhone?: string
  onExport: (format: ExportFormat) => Promise<void> | void
}

export const ExportModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  totalCount,
  itemLabel = 'items',
  storeName,
  businessName,
  businessGSTIN,
  businessPhone,
  onExport,
}: ExportModalProps) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel')
  const [isExporting, setIsExporting] = useState(false)

  const handleExecuteExport = async () => {
    setIsExporting(true)
    try {
      await onExport(selectedFormat)
      toast.success(`Exported successfully as ${selectedFormat.toUpperCase()}!`)
      onClose()
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Failed to generate export file')
    } finally {
      setIsExporting(false)
    }
  }

  const formats: Array<{
    id: ExportFormat
    title: string
    ext: string
    description: string
    icon: React.ReactNode
    accentColor: string
    badgeBg: string
  }> = [
    {
      id: 'excel',
      title: 'Excel Spreadsheet',
      ext: '.XLSX',
      description: 'Structured spreadsheet with company header, columns, and totals for Excel & Google Sheets.',
      icon: <FileSpreadsheet className="text-emerald-600 dark:text-emerald-400" size={28} />,
      accentColor: 'border-emerald-500 ring-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    {
      id: 'pdf',
      title: 'PDF Document',
      ext: '.PDF',
      description: 'Professional print-ready document with company header, GSTIN, styled tables & totals.',
      icon: <FileText className="text-blue-600 dark:text-blue-400" size={28} />,
      accentColor: 'border-blue-500 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20',
      badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    },
    {
      id: 'image',
      title: 'High-Res Image',
      ext: '.PNG',
      description: 'High-resolution PNG image snapshot of the report for quick messaging and sharing.',
      icon: <ImageIcon className="text-purple-600 dark:text-purple-400" size={28} />,
      accentColor: 'border-purple-500 ring-purple-500/20 bg-purple-50/40 dark:bg-purple-950/20',
      badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleExecuteExport}
            loading={isExporting}
            leftIcon={<Download size={16} />}
            className="font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95"
          >
            Download {selectedFormat.toUpperCase()}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Info & Meta Summary Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Export Summary
              </p>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {totalCount} {itemLabel} ready for export
              </h4>
            </div>
            {subtitle && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300">
                {subtitle}
              </span>
            )}
          </div>

          {/* Business & Store tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300 border-t border-slate-200/80 dark:border-gray-800">
            {businessName && (
              <span className="flex items-center gap-1 font-semibold">
                <Building2 size={12} className="text-slate-400" /> {businessName}
              </span>
            )}
            {storeName && (
              <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                <Store size={12} /> {storeName}
              </span>
            )}
            {businessGSTIN && (
              <span className="flex items-center gap-1 font-mono text-slate-500">
                <Hash size={12} /> GST: {businessGSTIN}
              </span>
            )}
            {businessPhone && (
              <span className="flex items-center gap-1 text-slate-500">
                <Phone size={12} /> {businessPhone}
              </span>
            )}
          </div>
        </div>

        {/* Format Selection Cards */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            Choose Export Format
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {formats.map(fmt => {
              const isSelected = selectedFormat === fmt.id
              return (
                <div
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between relative ${
                    isSelected
                      ? `${fmt.accentColor} ring-2 shadow-sm`
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 text-blue-600 dark:text-blue-400">
                      <CheckCircle2 size={16} />
                    </div>
                  )}

                  <div>
                    <div className="mb-2.5">{fmt.icon}</div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                        {fmt.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                      {fmt.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${fmt.badgeBg}`}>
                      {fmt.ext}
                    </span>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
