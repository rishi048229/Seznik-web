import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Building2, FileText, Percent, Receipt, Store } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import { useGstBillingSettings } from '@/hooks/useGstBillingSettings'
import { DEFAULT_KOT_CONFIG, mergeKotConfig, ORDER_TYPE_OPTIONS } from '../kotConfig'
import { KOTTaxBillingPanel } from './KOTTaxBillingPanel'
import {
  DEFAULT_RESTAURANT_PRESETS,
  parseRestaurantBilling,
  toRestaurantBillingPayload,
  type BillChargePreset,
} from '@/constants/restaurantBilling'
import type { KotConfig, KotRoomType, ReceiptConfig } from '@/types/settings.types'

export type KOTSettingsTab = 'business' | 'bill' | 'taxBilling' | 'kot' | 'stores'

interface KOTSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: KOTSettingsTab
}

const TABS: Array<{ id: KOTSettingsTab; label: string; icon: typeof Building2 }> = [
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'bill', label: 'Customer bill', icon: Receipt },
  { id: 'taxBilling', label: 'Tax & Billing', icon: Percent },
  { id: 'kot', label: 'KOT & charges', icon: FileText },
  { id: 'stores', label: 'Franchises', icon: Store },
]

export const KOTSettingsModal = ({ isOpen, onClose, initialTab = 'business' }: KOTSettingsModalProps) => {
  const { data: settings } = useSettings()
  const { mutate: updateSettings, isPending: isUpdating } = useUpdateSettings()
  const { mutate: createSettings, isPending: isCreating } = useCreateSettings()
  const {
    form,
    setShowBreakdown,
    setStyle,
    setPrintOnReceipt,
    setItemWiseGst,
    saveGstBilling,
    isSaving: isSavingGstBilling,
  } = useGstBillingSettings()

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
  const [chargePresets, setChargePresets] = useState<BillChargePreset[]>(DEFAULT_RESTAURANT_PRESETS)

  const saving = isUpdating || isCreating || isSavingGstBilling

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
    setChargePresets(parseRestaurantBilling(settings?.invoiceConfig).presets)
  }, [isOpen, initialTab, settings])

  const persist = (data: Record<string, unknown>, label: string) => {
    const onSuccess = () => toast.success(`${label} saved`)
    const onError = (err: unknown) => {
      toast.error(err instanceof Error ? err.message : `Failed to save ${label}`)
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

  const saveTaxBilling = async () => {
    try {
      await saveGstBilling({
        extraInvoiceConfig: {
          restaurantBilling: toRestaurantBillingPayload({ presets: chargePresets }),
        },
        onSuccess: () => toast.success('Tax & Billing saved'),
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save Tax & Billing')
    }
  }

  const franchisesEnabled = settings?.locationConfig?.enabled ?? false

  const setKotField = <K extends keyof Required<KotConfig>>(key: K, value: Required<KotConfig>[K]) => {
    setKot((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Restaurant settings"
      size="xl"
      footer={
        tab === 'stores' ? undefined : (
          <Button
            onClick={() => {
              if (tab === 'business') saveBusiness()
              else if (tab === 'bill') saveBill()
              else if (tab === 'taxBilling') void saveTaxBilling()
              else saveKot()
            }}
            loading={saving}
            className="w-full sm:w-auto"
          >
            Save {TABS.find((t) => t.id === tab)?.label.toLowerCase()}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold ${
                tab === id
                  ? 'bg-[#0a0a2e] dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-gray-100 dark:bg-dark-elevated text-gray-600 dark:text-gray-300'
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
              enableBackgroundCleanup
            />
            <Input label="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <Input label="Phone" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
            <Input label="GSTIN" value={businessGSTIN} onChange={(e) => setBusinessGSTIN(e.target.value)} />
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
            <textarea
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-dark-border-strong bg-white dark:bg-dark-card px-3 py-2 text-sm"
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

        {tab === 'taxBilling' && (
          <KOTTaxBillingPanel
            form={form}
            onShowBreakdownChange={setShowBreakdown}
            onStyleChange={setStyle}
            onPrintOnReceiptChange={setPrintOnReceipt}
            onItemWiseGstChange={setItemWiseGst}
            chargePresets={chargePresets}
            onChargePresetsChange={setChargePresets}
          />
        )}

        {tab === 'kot' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default order type</p>
              <div className="grid grid-cols-3 gap-2">
                {ORDER_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setKotField('defaultOrderType', opt.id)}
                    className={`py-2 rounded-lg text-sm font-semibold border-2 ${
                      kot.defaultOrderType === opt.id
                        ? 'border-[#0a0a2e] dark:border-zinc-500 bg-[#0a0a2e]/5 dark:bg-white/10 text-[#0a0a2e] dark:text-indigo-300'
                        : 'border-gray-200 dark:border-dark-border-strong text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="KOT slip title"
              value={kot.kotSlipTitle}
              onChange={(e) => setKotField('kotSlipTitle', e.target.value)}
            />
            <Switch
              label="Show waiter on KOT slip"
              checked={kot.showWaiterOnSlip}
              onChange={(checked) => setKotField('showWaiterOnSlip', checked)}
            />
            <Switch
              label="Override item tax with a bill tax %"
              description="When off, each food item keeps its own tax rate."
              checked={kot.applyTaxOverride}
              onChange={(checked) => setKotField('applyTaxOverride', checked)}
            />
            <Input
              label="Default tax %"
              type="number"
              min={0}
              step="0.01"
              value={String(kot.taxRate)}
              onChange={(e) => setKotField('taxRate', Number(e.target.value) || 0)}
            />
            {kot.applyTaxOverride ? (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                Per-item GST slabs from products are overridden — slab-wise breakdown may not reflect menu item rates.
              </p>
            ) : null}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Service charge</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {(['percent', 'flat'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setKotField('serviceChargeType', type)}
                    className={`py-2 rounded-lg text-sm font-semibold border-2 ${
                      kot.serviceChargeType === type
                        ? 'border-[#0a0a2e] dark:border-zinc-500 bg-[#0a0a2e]/5 dark:bg-white/10 text-[#0a0a2e] dark:text-indigo-300'
                        : 'border-gray-200 dark:border-dark-border-strong text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {type === 'percent' ? 'Percent of food' : 'Flat amount (₹)'}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={String(kot.serviceChargeValue)}
                onChange={(e) => setKotField('serviceChargeValue', Number(e.target.value) || 0)}
                placeholder={kot.serviceChargeType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="AC room charge (₹)"
                type="number"
                min={0}
                step="0.01"
                value={String(kot.acCharge)}
                onChange={(e) => setKotField('acCharge', Number(e.target.value) || 0)}
              />
              <Input
                label="Non-AC room charge (₹)"
                type="number"
                min={0}
                step="0.01"
                value={String(kot.nonAcCharge)}
                onChange={(e) => setKotField('nonAcCharge', Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default room type on new bills</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'none' as KotRoomType, label: 'None' },
                  { id: 'ac' as KotRoomType, label: 'AC' },
                  { id: 'non_ac' as KotRoomType, label: 'Non-AC' },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setKotField('defaultRoomType', opt.id)}
                    className={`py-2 rounded-lg text-sm font-semibold border-2 ${
                      kot.defaultRoomType === opt.id
                        ? 'border-[#0a0a2e] dark:border-zinc-500 bg-[#0a0a2e]/5 dark:bg-white/10 text-[#0a0a2e] dark:text-indigo-300'
                        : 'border-gray-200 dark:border-dark-border-strong text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'stores' && (
          <div className="space-y-4">
            <Switch
              label="Enable multiple franchises / stores"
              description="Turn this on to use multi-store stock. Add outlets from Settings after this flag is on."
              checked={franchisesEnabled}
              onChange={(checked) => persist({ locationConfig: { enabled: checked } }, 'Franchise setting')}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Table KOT on web uses the shared product catalog. Outlet lists stay in Settings so this screen does not depend on the separate multi-store admin UI.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
