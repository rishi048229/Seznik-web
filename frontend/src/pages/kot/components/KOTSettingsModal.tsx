import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { Building2, ChefHat, Receipt } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import { DEFAULT_KOT_CONFIG, mergeKotConfig } from '../kotConfig'
import { KotSettingsFields } from './KotSettingsFields'
import type { KotConfig, ReceiptConfig } from '@/types/settings.types'

export type KOTSettingsTab = 'business' | 'bill' | 'kot'

interface KOTSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: KOTSettingsTab
}

const TABS: Array<{ id: KOTSettingsTab; label: string; icon: typeof Building2 }> = [
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'bill', label: 'Customer bill', icon: Receipt },
  { id: 'kot', label: 'Kitchen', icon: ChefHat },
]

export const KOTSettingsModal = ({ isOpen, onClose, initialTab = 'business' }: KOTSettingsModalProps) => {
  const { data: settings } = useSettings()
  const { mutate: updateSettings, isPending: isUpdating } = useUpdateSettings()
  const { mutate: createSettings, isPending: isCreating } = useCreateSettings()
  const [tab, setTab] = useState<KOTSettingsTab>(initialTab)
  const [businessName, setBusinessName] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessGSTIN, setBusinessGSTIN] = useState('')
  const [logo, setLogo] = useState('')
  const [receipt, setReceipt] = useState<ReceiptConfig>({
    companyName: '',
    address: '',
    phone: '',
    gstin: '',
    logoURL: '',
    footerMessage: 'Thank you for your purchase!',
    termsLine1: '',
    termsLine2: '',
    termsLine3: '',
    showLogo: true,
  })
  const [kot, setKot] = useState<Required<KotConfig>>(DEFAULT_KOT_CONFIG)
  const [invoicePrefix, setInvoicePrefix] = useState('INV')

  const saving = isUpdating || isCreating

  useEffect(() => {
    if (!isOpen) return
    setTab(initialTab)
    setBusinessName(settings?.businessName ?? '')
    setBusinessPhone(settings?.businessPhone ?? '')
    setBusinessAddress(settings?.businessAddress ?? '')
    setBusinessGSTIN(settings?.businessGSTIN ?? '')
    setLogo(settings?.businessLogoURL ?? '')
    setInvoicePrefix(settings?.invoiceConfig?.prefix || 'INV')
    setReceipt({
      companyName: settings?.receiptConfig?.companyName || settings?.businessName || '',
      address: settings?.receiptConfig?.address || settings?.businessAddress || '',
      phone: settings?.receiptConfig?.phone || settings?.businessPhone || '',
      gstin: settings?.receiptConfig?.gstin || settings?.businessGSTIN || '',
      logoURL: settings?.receiptConfig?.logoURL || settings?.businessLogoURL || '',
      footerMessage: settings?.receiptConfig?.footerMessage || 'Thank you for your purchase!',
      termsLine1: settings?.receiptConfig?.termsLine1 || '',
      termsLine2: settings?.receiptConfig?.termsLine2 || '',
      termsLine3: settings?.receiptConfig?.termsLine3 || '',
      showLogo: settings?.receiptConfig?.showLogo ?? true,
      showCompanyHeader: settings?.receiptConfig?.showCompanyHeader ?? true,
      showAddress: settings?.receiptConfig?.showAddress ?? true,
      showPhone: settings?.receiptConfig?.showPhone ?? true,
      showGSTIN: settings?.receiptConfig?.showGSTIN ?? true,
      showTaxBreakdown: settings?.receiptConfig?.showTaxBreakdown ?? true,
    })
    setKot(mergeKotConfig(settings?.kotConfig))
  }, [isOpen, initialTab, settings])

  const persist = (data: Record<string, unknown>, label: string) => {
    const onSuccess = () => toast.success(`${label} saved`)
    const onError = (err: unknown) => {
      toastError(err, `Could not save ${label}`)
    }
    if (settings?.id) {
      updateSettings({ settingsId: settings.id, data }, { onSuccess, onError })
      return
    }
    createSettings(data as Parameters<typeof createSettings>[0], { onSuccess, onError })
  }

  const saveBusiness = () => {
    persist(
      {
        businessName: businessName.trim(),
        businessPhone: businessPhone.trim(),
        businessAddress: businessAddress.trim(),
        businessGSTIN: businessGSTIN.trim(),
        businessLogoURL: logo,
      },
      'Business profile'
    )
  }

  const saveBill = () => {
    persist(
      {
        invoiceConfig: {
          ...(settings?.invoiceConfig ?? {}),
          prefix: invoicePrefix.trim() || 'INV',
          footerText: settings?.invoiceConfig?.footerText || '',
        },
        receiptConfig: {
          ...(settings?.receiptConfig ?? {}),
          ...receipt,
          logoURL: logo || receipt.logoURL,
        },
        businessLogoURL: logo || settings?.businessLogoURL || '',
      },
      'Customer bill'
    )
  }

  const saveKot = () => {
    persist({ kotConfig: kot }, 'KOT settings')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Restaurant settings"
      size="xl"
      footer={
        <Button
          onClick={() => {
            if (tab === 'business') saveBusiness()
            else if (tab === 'bill') saveBill()
            else saveKot()
          }}
          loading={saving}
          className="w-full sm:w-auto"
        >
          Save {TABS.find((t) => t.id === tab)?.label.toLowerCase()}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                tab === id
                  ? 'bg-[#0a0a2e] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-800 dark:hover:text-gray-100'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'business' && (
          <div className="space-y-3">
            <ImageUpload
              label="Business logo"
              value={logo}
              onChange={setLogo}
              previewSize="md"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            />
            <Input label="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <Input label="Phone" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
            <Input label="GSTIN" value={businessGSTIN} onChange={(e) => setBusinessGSTIN(e.target.value)} />
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
            <textarea
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
        )}

        {tab === 'bill' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">These fields print on the customer bill. Changes apply to the next receipt.</p>
            <Input label="Invoice prefix" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
            <Input
              label="Receipt company name"
              value={receipt.companyName}
              onChange={(e) => setReceipt((r) => ({ ...r, companyName: e.target.value }))}
            />
            <Input
              label="Receipt phone"
              value={receipt.phone}
              onChange={(e) => setReceipt((r) => ({ ...r, phone: e.target.value }))}
            />
            <Input
              label="Receipt GSTIN"
              value={receipt.gstin}
              onChange={(e) => setReceipt((r) => ({ ...r, gstin: e.target.value }))}
            />
            <Input
              label="Receipt address"
              value={receipt.address}
              onChange={(e) => setReceipt((r) => ({ ...r, address: e.target.value }))}
            />
            <Input
              label="Footer message"
              value={receipt.footerMessage}
              onChange={(e) => setReceipt((r) => ({ ...r, footerMessage: e.target.value }))}
            />
            <Input
              label="Terms line 1"
              value={receipt.termsLine1}
              onChange={(e) => setReceipt((r) => ({ ...r, termsLine1: e.target.value }))}
            />
            <Switch
              label="Show logo on customer bill"
              checked={receipt.showLogo ?? true}
              onChange={(checked) => setReceipt((r) => ({ ...r, showLogo: checked }))}
            />
          </div>
        )}

        {tab === 'kot' && (
          <KotSettingsFields value={kot} onChange={setKot} />
        )}
      </div>
    </Modal>
  )
}
