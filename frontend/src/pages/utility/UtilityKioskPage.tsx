import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { StatsCard } from '@/components/data-display/StatsCard'
import { DataTable, type ColumnDef } from '@/components/data-display/DataTable'
import { BleConnectButton } from '@/components/common/BleConnectButton'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import {
  useUtilityBills,
  useUtilityBillStats,
  useExtractUtilityBill,
  useCreateUtilityBill,
  useDeleteUtilityBill,
} from '@/hooks/useUtilityBills'
import { shouldPrintThermalOverBle } from '@/utils/printTarget'
import {
  billTypeLabel,
  downloadUtilityA4Pdf,
  downloadUtilityThermalPdf,
  generateUtilitySlipHTML,
  openUtilityWhatsApp,
  printUtilitySlip,
  utilitySlipBytes,
} from '@/utils/utilitySlip'
import { formatINR } from '@/utils/currency'
import { toastError } from '@/utils/userMessage'
import toast from 'react-hot-toast'
import {
  Camera,
  FileUp,
  IndianRupee,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  Eye,
  Download,
  Zap,
  Droplets,
  Flame,
  Wifi,
  Landmark,
} from 'lucide-react'
import type { UtilityBill, UtilityBillType, UtilityPaymentMode } from '@/types/utilityBill'

const BILL_TYPES: Array<{ value: UtilityBillType | ''; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'WATER', label: 'Water' },
  { value: 'GAS', label: 'Gas' },
  { value: 'BROADBAND', label: 'Broadband' },
  { value: 'UTILITY', label: 'Utility' },
]

const emptyForm = {
  kioskName: '',
  billType: 'ELECTRICITY' as UtilityBillType,
  provider: '',
  consumerNumber: '',
  consumerName: '',
  dueDate: '',
  billDate: '',
  unitsConsumed: '',
  billAmount: '',
  convenienceFee: '20',
  paymentMode: 'CASH' as UtilityPaymentMode,
  customerPhone: '',
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })

export const UtilityKioskPage = () => {
  const { userProfile } = useAuth()
  const { data: settings } = useSettings()
  const blePrinter = useBlePrinter()
  const paperSize = settings?.printerConfig?.paperSize === '80mm' ? '80mm' : '58mm'
  const defaultKiosk = settings?.businessName || userProfile?.businessName || 'SEZNIK KIOSK'

  const [search, setSearch] = useState('')
  const [billTypeFilter, setBillTypeFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(t)
  }, [search])

  const { data: list, isLoading } = useUtilityBills({
    search: debouncedSearch,
    billType: billTypeFilter,
    page: 1,
    limit: 50,
  })
  const { data: stats } = useUtilityBillStats()
  const extractBill = useExtractUtilityBill()
  const saveBill = useCreateUtilityBill()
  const deleteBill = useDeleteUtilityBill()

  const [form, setForm] = useState(emptyForm)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewMime, setPreviewMime] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [viewBill, setViewBill] = useState<UtilityBill | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setForm(prev => (prev.kioskName ? prev : { ...prev, kioskName: defaultKiosk }))
  }, [defaultKiosk])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraOn(true)
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
    } catch {
      toast.error('Camera access was blocked. Upload a photo or PDF instead.')
    }
  }

  const captureFrame = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setPreview(dataUrl)
    setPreviewMime('image/jpeg')
    stopCamera()
    void runExtract(dataUrl, 'image/jpeg')
  }

  const runExtract = async (dataUrl: string, mimeType: string) => {
    try {
      const extracted = await extractBill.mutateAsync({ imageBase64: dataUrl, mimeType })
      setForm(prev => ({
        ...prev,
        billType: (['ELECTRICITY', 'WATER', 'GAS', 'BROADBAND', 'UTILITY'].includes(extracted.billType)
          ? extracted.billType
          : prev.billType) as UtilityBillType,
        provider: extracted.provider || prev.provider,
        consumerNumber: extracted.consumerNumber || '',
        consumerName: extracted.consumerName || '',
        dueDate: extracted.dueDate || '',
        billDate: extracted.billDate || '',
        unitsConsumed: extracted.unitsConsumed || '',
        billAmount: extracted.billAmount > 0 ? String(extracted.billAmount) : '',
      }))
      toast.success('Bill fields filled. Review anything left blank before collecting.')
    } catch (err) {
      toastError(err, 'Could not read the bill. Enter the details manually.')
    }
  }

  const onPickFile = async (file?: File | null) => {
    if (!file) return
    const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
    if (!mime.includes('pdf') && !mime.startsWith('image/')) {
      toast.error('Upload a PDF, JPEG, or PNG bill.')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setPreview(dataUrl)
      setPreviewMime(mime)
      await runExtract(dataUrl, mime)
    } catch (err) {
      toastError(err, 'Could not open that file.')
    }
  }

  const billAmount = Number(form.billAmount) || 0
  const convenienceFee = Number(form.convenienceFee) || 0
  const totalAmount = billAmount + convenienceFee

  const draftFromForm = (receiptNumber: string, extras?: Partial<UtilityBill>): UtilityBill => ({
    id: extras?.id || 'preview',
    userId: extras?.userId || '',
    receiptNumber,
    kioskName: form.kioskName.trim() || defaultKiosk,
    billType: form.billType,
    provider: form.provider.trim(),
    consumerNumber: form.consumerNumber.trim(),
    consumerName: form.consumerName.trim(),
    dueDate: form.dueDate.trim() || null,
    billDate: form.billDate.trim() || null,
    unitsConsumed: form.unitsConsumed.trim() || null,
    billAmount,
    convenienceFee,
    totalAmount,
    status: 'SUCCESS (PAID)',
    paymentMode: form.paymentMode,
    customerPhone: form.customerPhone.trim() || null,
    operatorName: userProfile?.displayName || null,
    createdAt: extras?.createdAt || new Date().toISOString(),
    updatedAt: extras?.updatedAt || new Date().toISOString(),
  })

  const printSaved = async (bill: UtilityBill) => {
    try {
      if (shouldPrintThermalOverBle(settings, blePrinter)) {
        if (blePrinter.status !== 'connected') await blePrinter.connect()
        await blePrinter.print(utilitySlipBytes(bill, paperSize))
        toast.success('Sent to thermal printer')
        return
      }
      printUtilitySlip(bill, paperSize)
    } catch (err) {
      toastError(err, 'Print failed. Opening the browser print window.')
      printUtilitySlip(bill, paperSize)
    }
  }

  const collectAndPrint = async () => {
    if (billAmount <= 0) {
      toast.error('Enter the bill amount before collecting.')
      return
    }
    try {
      const saved = await saveBill.mutateAsync({
        kioskName: form.kioskName.trim() || defaultKiosk,
        billType: form.billType,
        provider: form.provider.trim(),
        consumerNumber: form.consumerNumber.trim(),
        consumerName: form.consumerName.trim(),
        dueDate: form.dueDate.trim(),
        billDate: form.billDate.trim(),
        unitsConsumed: form.unitsConsumed.trim(),
        billAmount,
        convenienceFee,
        totalAmount,
        paymentMode: form.paymentMode,
        customerPhone: form.customerPhone.trim(),
        operatorName: userProfile?.displayName || '',
      })
      toast.success(`Collected ${formatINR(saved.totalAmount)}`)
      await printSaved(saved)
      setForm({ ...emptyForm, kioskName: form.kioskName || defaultKiosk, convenienceFee: form.convenienceFee || '20' })
      setPreview(null)
      setPreviewMime('')
    } catch (err) {
      toastError(err, 'Could not save this collection.')
    }
  }

  const resetForm = () => {
    setForm({ ...emptyForm, kioskName: defaultKiosk })
    setPreview(null)
    setPreviewMime('')
    stopCamera()
  }

  const bills = list?.bills ?? []
  const livePreview = draftFromForm('PREVIEW')

  const columns: ColumnDef<UtilityBill>[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt',
      sortable: true,
      render: row => <span className="font-semibold text-slate-800 dark:text-slate-100">{row.receiptNumber}</span>,
    },
    {
      key: 'billType',
      header: 'Type',
      render: row => <Badge variant="info">{billTypeLabel(row.billType)}</Badge>,
    },
    {
      key: 'provider',
      header: 'Provider',
      render: row => <span className="text-sm">{row.provider || '—'}</span>,
    },
    {
      key: 'consumerName',
      header: 'Consumer',
      render: row => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.consumerName || '—'}</p>
          <p className="text-xs text-slate-500">{row.consumerNumber || ''}</p>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total',
      sortable: true,
      render: row => <span className="font-semibold">{formatINR(row.totalAmount)}</span>,
    },
    {
      key: 'paymentMode',
      header: 'Mode',
      render: row => <Badge variant="success">{row.paymentMode}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'When',
      sortable: true,
      render: row => (
        <span className="text-xs text-slate-500">
          {new Date(row.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: row => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" title="View slip" onClick={() => setViewBill(row)}>
            <Eye size={15} />
          </Button>
          <Button variant="ghost" size="sm" title="Reprint" onClick={() => void printSaved(row)}>
            <Printer size={15} />
          </Button>
          <Button variant="ghost" size="sm" title="WhatsApp" onClick={() => openUtilityWhatsApp(row, row.customerPhone)}>
            <WhatsAppIcon size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Delete"
            className="text-red-600"
            onClick={() => {
              if (confirm(`Delete ${row.receiptNumber}?`)) deleteBill.mutate(row.id)
            }}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ]

  const typeIcon = useMemo(() => {
    switch (form.billType) {
      case 'WATER': return <Droplets size={16} />
      case 'GAS': return <Flame size={16} />
      case 'BROADBAND': return <Wifi size={16} />
      case 'UTILITY': return <Landmark size={16} />
      default: return <Zap size={16} />
    }
  }, [form.billType])

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Utility Kiosk"
        breadcrumb={['Sales', 'Utility Kiosk']}
        action={<BleConnectButton />}
      />
      <p className="-mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
        Scan or upload an A4 electricity, water, gas, or broadband bill. Review the extracted fields, add a convenience fee, and print a thermal receipt.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="Bills converted" value={stats?.totalBills ?? 0} icon={<ReceiptText size={22} />} />
        <StatsCard title="Cash collected" value={formatINR(stats?.totalCollected ?? 0)} icon={<IndianRupee size={22} />} />
        <StatsCard title="Fees earned" value={formatINR(stats?.totalConvenienceFee ?? 0)} icon={<IndianRupee size={22} />} />
        <StatsCard
          title="Today's volume"
          value={stats?.todayCount ?? 0}
          trendValue={formatINR(stats?.todayCollected ?? 0)}
          trend="up"
          icon={<Printer size={22} />}
        />
      </div>

      {(stats?.topProviders?.length || 0) > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Top utility providers</p>
          <div className="flex flex-wrap gap-2">
            {stats!.topProviders.map(p => (
              <span key={p.provider} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                {p.provider} · {p.count} · {formatINR(p.amount)}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <Card className="p-5 xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Document input</p>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upload, scan, or capture the A4 bill</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={resetForm} leftIcon={<RotateCcw size={14} />}>
              Reset
            </Button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/jpg"
            className="hidden"
            onChange={e => void onPickFile(e.target.files?.[0])}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()} leftIcon={<FileUp size={16} />}>
              Upload PDF / image
            </Button>
            <Button variant="outline" onClick={() => (cameraOn ? stopCamera() : void startCamera())} leftIcon={<Camera size={16} />}>
              {cameraOn ? 'Stop camera' : 'Capture with camera'}
            </Button>
          </div>

          {cameraOn && (
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-72 object-contain" />
              <div className="p-3 bg-slate-900">
                <Button className="w-full" onClick={captureFrame}>Capture bill</Button>
              </div>
            </div>
          )}

          {preview && previewMime.includes('pdf') && (
            <iframe title="Bill PDF" src={preview} className="w-full h-56 rounded-xl border border-slate-200 dark:border-slate-700" />
          )}
          {preview && previewMime.startsWith('image/') && (
            <img src={preview} alt="Uploaded bill" className="w-full max-h-56 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50" />
          )}
          {extractBill.isPending && (
            <p className="text-sm text-blue-600">Reading the bill… blank fields stay empty on purpose if a value is unclear.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Kiosk title" value={form.kioskName} onChange={e => setForm(f => ({ ...f, kioskName: e.target.value }))} />
            <Select
              label="Bill type"
              value={form.billType}
              options={BILL_TYPES.filter(t => t.value).map(t => ({ value: t.value, label: t.label }))}
              onChange={e => setForm(f => ({ ...f, billType: e.target.value as UtilityBillType }))}
            />
            <Input label="Board / provider" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
            <Input label="Consumer number" value={form.consumerNumber} onChange={e => setForm(f => ({ ...f, consumerNumber: e.target.value }))} />
            <Input label="Consumer name" value={form.consumerName} onChange={e => setForm(f => ({ ...f, consumerName: e.target.value }))} />
            <Input label="Due date" placeholder="14-SEP-2026" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            <Input label="Bill date" placeholder="01-SEP-2026" value={form.billDate} onChange={e => setForm(f => ({ ...f, billDate: e.target.value }))} />
            <Input label="Units consumed" placeholder="142 kWh" value={form.unitsConsumed} onChange={e => setForm(f => ({ ...f, unitsConsumed: e.target.value }))} />
            <Input label="Bill amount (₹)" type="number" min="0" step="0.01" value={form.billAmount} onChange={e => setForm(f => ({ ...f, billAmount: e.target.value }))} />
            <Input label="Convenience fee (₹)" type="number" min="0" step="0.01" value={form.convenienceFee} onChange={e => setForm(f => ({ ...f, convenienceFee: e.target.value }))} />
            <Input label="Customer mobile" inputMode="numeric" maxLength={10} value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
            <Select
              label="Payment mode"
              value={form.paymentMode}
              options={[
                { value: 'CASH', label: 'Cash' },
                { value: 'UPI', label: 'UPI' },
                { value: 'CARD', label: 'Card' },
              ]}
              onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value as UtilityPaymentMode }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2 text-slate-500">
              {typeIcon}
              <span className="text-sm">Total to collect</span>
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatINR(totalAmount)}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void collectAndPrint()} loading={saveBill.isPending} leftIcon={<Printer size={16} />}>
              Collect & print
            </Button>
            <Button
              variant="outline"
              onClick={() => openUtilityWhatsApp(livePreview, form.customerPhone)}
              leftIcon={<WhatsAppIcon size={16} />}
            >
              WhatsApp
            </Button>
            <Button variant="outline" onClick={() => void downloadUtilityThermalPdf(livePreview, paperSize)} leftIcon={<Download size={16} />}>
              Thermal PDF
            </Button>
            <Button variant="outline" onClick={() => void downloadUtilityA4Pdf(livePreview)} leftIcon={<Download size={16} />}>
              A4 PDF
            </Button>
          </div>
        </Card>

        <Card className="p-5 xl:col-span-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">Live thermal slip</p>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">{paperSize} preview</h2>
          <div className="mx-auto bg-white text-slate-900 rounded-lg shadow-inner border border-slate-200 p-3 overflow-auto max-h-[720px]">
            <div dangerouslySetInnerHTML={{ __html: generateUtilitySlipHTML(livePreview, paperSize) }} />
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">History</p>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Converted bills</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Consumer no, name, phone, provider"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
            </div>
            <Select
              value={billTypeFilter}
              options={BILL_TYPES.map(t => ({ value: t.value, label: t.label }))}
              onChange={e => setBillTypeFilter(e.target.value)}
            />
          </div>
        </div>
        <DataTable
          data={bills}
          columns={columns}
          loading={isLoading}
          searchable={false}
          emptyMessage="No utility bills converted yet."
        />
      </Card>

      <Modal
        isOpen={!!viewBill}
        onClose={() => setViewBill(null)}
        title={viewBill ? viewBill.receiptNumber : 'Slip'}
        size="sm"
        footer={
          viewBill ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void printSaved(viewBill)} leftIcon={<Printer size={14} />}>Reprint</Button>
              <Button size="sm" variant="outline" onClick={() => openUtilityWhatsApp(viewBill, viewBill.customerPhone)} leftIcon={<WhatsAppIcon size={14} />}>
                WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => void downloadUtilityA4Pdf(viewBill)}>A4 PDF</Button>
            </div>
          ) : null
        }
      >
        {viewBill && (
          <div className="bg-white rounded-lg p-2">
            <div dangerouslySetInnerHTML={{ __html: generateUtilitySlipHTML(viewBill, paperSize) }} />
          </div>
        )}
      </Modal>
    </div>
  )
}
