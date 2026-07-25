import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { LANGUAGES } from '@/i18n/translations'
import { Spinner } from '@/components/ui/Spinner'
import { PermissionsAndAccounts } from './components/PermissionsAndAccounts'
import { SecurityPasswordSettings } from './components/SecurityPasswordSettings'
import { Check } from 'lucide-react'
import toast from 'react-hot-toast'

const DEFAULT_SETTINGS = {
  businessName: '',
  businessAddress: '',
  businessPhone: '',
  businessGSTIN: '',
  businessLogoURL: '',
  personalInfo: { ownerName: '', ownerPhone: '', ownerAddress: '' },
  invoiceConfig: { prefix: 'INV', footerText: '' },
  notificationConfig: { lowStockThreshold: 10, overdueDays: 30 },
  receiptConfig: {
    companyName: '',
    address: '',
    phone: '',
    gstin: '',
    logoURL: '',
    footerMessage: 'Thank you for your purchase!',
    termsLine1: '1. Goods once sold will not be taken back or exchanged',
    termsLine2: '2. All disputes are subject to local jurisdiction only',
    termsLine3: '',
  },
}

export const SettingsPage = () => {
  const pageTutorial = usePageTutorial('settings')
  const [activeTab, setActiveTab] = useState('business')
  const [businessLogo, setBusinessLogo] = useState('')
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const { data: settings, isLoading } = useSettings()
  const { mutate: updateSettings, isPending: isUpdating } = useUpdateSettings()
  const { mutate: createSettings, isPending: isCreating } = useCreateSettings()
  const { user } = useAuth()
  const { t, language, setLanguage } = useLanguage()

  const settingsTabs = [
    { key: 'business', label: t('settings.businessProfile') },
    { key: 'personal', label: t('settings.personalInfo') },
    { key: 'invoice', label: t('settings.editInvoice') },
    { key: 'notifications', label: t('settings.notifications') },
    { key: 'permissions', label: t('settings.permissions') },
    { key: 'security', label: 'Security & Password' },
    { key: 'language', label: t('settings.language') },
  ]

  const isPending = isUpdating || isCreating
  const hasSettings = !!settings

  const current = settings ?? DEFAULT_SETTINGS

  useEffect(() => {
    setBusinessLogo(current.businessLogoURL ?? '')
  }, [current.businessLogoURL])

  // Strip undefined values — Firestore rejects them
  const clean = (obj: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        v && typeof v === 'object' && !Array.isArray(v)
          ? clean(v as Record<string, unknown>)
          : v ?? '',
      ])
    )

  const handleSave = (key: string, data: Record<string, unknown>) => {
    const safeData = clean(data)
    if (hasSettings && settings) {
      updateSettings(
        { settingsId: settings.id, data: safeData },
        {
          onSuccess: () => toast.success(`${key} saved`),
          onError: (err) => {
            console.error('Settings save error:', err)
            toast.error(`Failed to save ${key}`)
          },
        }
      )
    } else {
      const merged = clean({ ...DEFAULT_SETTINGS, ...data })
      createSettings(merged as Parameters<typeof createSettings>[0], {
        onSuccess: () => toast.success(`${key} saved`),
        onError: (err) => {
          console.error('Settings create error:', err)
          toast.error(`Failed to save ${key}`)
        },
      })
    }
  }

  const handleTabSave = (tab: string) => {
    const el = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null
    const val = (id: string) => el(id)?.value ?? ''

    // Safe reads from current — fall back to empty string so Firestore never gets undefined
    const curPhone    = (current as any).businessPhone    ?? ''
    const curGSTIN    = (current as any).businessGSTIN    ?? ''
    const curPersonal = (current as any).personalInfo     ?? { ownerName: '', ownerPhone: '', ownerAddress: '' }
    const curReceipt  = current.receiptConfig             ?? DEFAULT_SETTINGS.receiptConfig
    const curInvoice  = current.invoiceConfig             ?? DEFAULT_SETTINGS.invoiceConfig
    const curNotif    = current.notificationConfig        ?? DEFAULT_SETTINGS.notificationConfig

    switch (tab) {
      case 'business':
        handleSave('Business Profile', {
          businessName:    val('settings-business-name'),
          businessAddress: val('settings-business-address'),
          businessPhone:   val('settings-business-phone'),
          businessGSTIN:   val('settings-business-gstin'),
          businessLogoURL: businessLogo,
          personalInfo:    curPersonal,
          invoiceConfig:   curInvoice,
          notificationConfig: curNotif,
          receiptConfig:   curReceipt,
        })
        break
      case 'personal':
        handleSave('Personal Info', {
          businessName:    current.businessName    ?? '',
          businessAddress: current.businessAddress ?? '',
          businessPhone:   curPhone,
          businessGSTIN:   curGSTIN,
          businessLogoURL: current.businessLogoURL ?? '',
          personalInfo: {
            ownerName:    val('settings-owner-name'),
            ownerPhone:   val('settings-owner-phone'),
            ownerAddress: val('settings-owner-address'),
          },
          invoiceConfig:      curInvoice,
          notificationConfig: curNotif,
          receiptConfig:      curReceipt,
        })
        break
      case 'invoice':
        handleSave('Invoice Settings', {
          receiptConfig: {
            companyName:   val('settings-receipt-company'),
            address:       val('settings-receipt-address'),
            phone:         val('settings-receipt-phone'),
            gstin:         val('settings-receipt-gstin'),
            logoURL:       curReceipt.logoURL ?? '',
            footerMessage: val('settings-receipt-footer'),
            termsLine1:    val('settings-receipt-terms1'),
            termsLine2:    val('settings-receipt-terms2'),
            termsLine3:    val('settings-receipt-terms3'),
          },
          businessName:    current.businessName    ?? '',
          businessAddress: current.businessAddress ?? '',
          businessPhone:   curPhone,
          businessGSTIN:   curGSTIN,
          businessLogoURL: current.businessLogoURL ?? '',
          personalInfo:    curPersonal,
          invoiceConfig:   curInvoice,
          notificationConfig: curNotif,
        })
        break
      case 'notifications':
        handleSave('Notifications', {
          notificationConfig: {
            lowStockThreshold: parseInt(val('settings-low-stock')) || 10,
            overdueDays:       parseInt(val('settings-overdue'))   || 30,
          },
          businessName:    current.businessName    ?? '',
          businessAddress: current.businessAddress ?? '',
          businessPhone:   curPhone,
          businessGSTIN:   curGSTIN,
          businessLogoURL: current.businessLogoURL ?? '',
          personalInfo:    curPersonal,
          invoiceConfig:   curInvoice,
          receiptConfig:   curReceipt,
        })
        break
    }
  }

  return (
    <div>
      <div data-tour="settings-header">
        <PageHeader title="Settings" onWatchTutorial={pageTutorial.openTutorial} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <>
          {!hasSettings && (
            <Card className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                No settings saved yet. Fill in the forms below and click Save — your settings document will be created automatically.
              </p>
            </Card>
          )}

          <div data-tour="settings-tabs">
            <Tabs tabs={settingsTabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />
          </div>

          <Card className="p-6">
            {activeTab === 'business' && (
              <div className="space-y-4 max-w-md">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Business Profile</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">These details appear on your invoices and receipts.</p>
                <div>
                  <ImageUpload
                    label="Business Logo (shown on invoices)"
                    value={businessLogo}
                    onChange={(url) => {
                      setBusinessLogo(url)
                      setIsLogoUploading(false)
                    }}
                    onFileSelect={async (file) => {
                      toast.error('Image upload will be available in the next version')
                      throw new Error('Upload deferred to next version')
                    }}
                    previewSize="lg"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  />
                  {isLogoUploading && (
                    <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                      <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Uploading logo...
                    </p>
                  )}
                  {businessLogo && !isLogoUploading && (
                    <p className="text-xs text-emerald-600 mt-1">✓ Logo uploaded — click Save below to apply to invoices</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Recommended: PNG or JPG with transparent background, min 300×100 px
                  </p>
                </div>
                <Input
                  label="Company Name"
                  defaultValue={current.businessName ?? ''}
                  id="settings-business-name"
                  placeholder="e.g. Acme Retail Pvt. Ltd."
                />
                <Input
                  label="Business Address"
                  defaultValue={current.businessAddress ?? ''}
                  id="settings-business-address"
                  placeholder="123 Main Street, City, State - 000000"
                />
                <Input
                  label="Business Phone Number"
                  defaultValue={(current as any).businessPhone ?? ''}
                  id="settings-business-phone"
                  placeholder="+91 98765 43210"
                />
                <Input
                  label="GSTIN"
                  defaultValue={(current as any).businessGSTIN ?? ''}
                  id="settings-business-gstin"
                  placeholder="e.g. 27AAPFU0939F1ZV"
                />
                <Button onClick={() => handleTabSave('business')} loading={isPending}>
                  {hasSettings ? 'Update Business Profile' : 'Save Business Profile'}
                </Button>
              </div>
            )}
            {activeTab === 'personal' && (
              <div className="space-y-4 max-w-md">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Personal Info</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Owner / account holder details for internal reference.</p>
                <Input
                  label="Owner Name"
                  defaultValue={(current as any).personalInfo?.ownerName ?? ''}
                  id="settings-owner-name"
                  placeholder="e.g. Rajesh Kumar"
                />
                <Input
                  label="Phone Number"
                  defaultValue={(current as any).personalInfo?.ownerPhone ?? ''}
                  id="settings-owner-phone"
                  placeholder="+91 98765 43210"
                />
                <Input
                  label="Address"
                  defaultValue={(current as any).personalInfo?.ownerAddress ?? ''}
                  id="settings-owner-address"
                  placeholder="Residential address"
                />
                <Button onClick={() => handleTabSave('personal')} loading={isPending}>
                  {hasSettings ? 'Update Personal Info' : 'Save Personal Info'}
                </Button>
              </div>
            )}
            {activeTab === 'invoice' && (
              <div className="space-y-5 max-w-lg">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Invoice / Receipt Configuration</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Customize the header, terms, and footer of your printed invoices.</p>

                <Input
                  label="Company Name"
                  defaultValue={current.receiptConfig?.companyName ?? current.businessName ?? ''}
                  id="settings-receipt-company"
                  placeholder="Seznik POS"
                />

                <Input
                  label="Address"
                  defaultValue={current.receiptConfig?.address ?? current.businessAddress ?? ''}
                  id="settings-receipt-address"
                  placeholder="123 Main Street, City, State - 000000"
                />

                <Input
                  label="Phone Number"
                  defaultValue={current.receiptConfig?.phone ?? ''}
                  id="settings-receipt-phone"
                  placeholder="PHONE : 044 258636222"
                />

                <Input
                  label="GSTIN"
                  defaultValue={current.receiptConfig?.gstin ?? ''}
                  id="settings-receipt-gstin"
                  placeholder="GSTIN : 33AAAGP0685F1ZH"
                />

                {/* Terms & Conditions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Terms & Conditions
                  </label>
                  <div className="space-y-2">
                    <input
                      id="settings-receipt-terms1"
                      defaultValue={current.receiptConfig?.termsLine1 ?? '1. Goods once sold will not be taken back or exchanged'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Term line 1"
                    />
                    <input
                      id="settings-receipt-terms2"
                      defaultValue={current.receiptConfig?.termsLine2 ?? '2. All disputes are subject to local jurisdiction only'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Term line 2"
                    />
                    <input
                      id="settings-receipt-terms3"
                      defaultValue={current.receiptConfig?.termsLine3 ?? ''}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Term line 3 (optional)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Footer Message
                  </label>
                  <textarea
                    id="settings-receipt-footer"
                    defaultValue={current.receiptConfig?.footerMessage ?? 'Thank you for your purchase!'}
                    rows={3}
                    className="w-full px-4 py-3 border rounded-xl bg-gray-50 dark:bg-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
                    placeholder="Thank you for your purchase!"
                  />
                </div>

                <Button onClick={() => handleTabSave('invoice')} loading={isPending}>
                  {hasSettings ? 'Update Invoice Settings' : 'Save Invoice Settings'}
                </Button>
              </div>
            )}
            {activeTab === 'notifications' && (
              <div className="space-y-4 max-w-md">
                <Input
                  label="Low Stock Threshold"
                  type="number"
                  defaultValue={current.notificationConfig?.lowStockThreshold ?? 10}
                  id="settings-low-stock"
                />
                <Input
                  label="Overdue Days"
                  type="number"
                  defaultValue={current.notificationConfig?.overdueDays ?? 30}
                  id="settings-overdue"
                />
                <Button onClick={() => handleTabSave('notifications')} loading={isPending}>
                  {hasSettings ? 'Update Notifications' : 'Save Notification Settings'}
                </Button>
              </div>
            )}
            {activeTab === 'permissions' && (
              <PermissionsAndAccounts />
            )}
            {activeTab === 'security' && (
              <SecurityPasswordSettings />
            )}
            {activeTab === 'language' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.appLanguage')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('settings.chooseLanguage')}</p>
                </div>
                <div className="space-y-2 max-w-md">
                  {LANGUAGES.map(lang => {
                    const selected = language === lang.code
                    return (
                      <button
                        key={lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                          selected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <span>{lang.label}</span>
                        {selected && <Check size={16} className="text-blue-600 dark:text-blue-400" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Tutorial Video Modal & Guided Onboarding Tour */}
      <PageVideoTutorialModal
        isOpen={pageTutorial.isTutorialOpen}
        onClose={pageTutorial.closeTutorial}
        tutorial={pageTutorial.tutorialData}
        onStartTour={pageTutorial.startTour}
      />
      <InteractivePageTour
        pageKey="settings"
        steps={pageTutorial.tutorialData.tourSteps}
        isOpen={pageTutorial.isTourOpen}
        onClose={pageTutorial.closeTour}
      />
    </div>
  )
}
