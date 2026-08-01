import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'
import { InteractivePageTour } from '@/components/common/InteractivePageTour'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ImageUpload } from '@/components/forms/ImageUpload'
import { useSettings, useUpdateSettings, useCreateSettings } from '@/hooks/useSettings'
import { useLanguage } from '@/contexts/LanguageContext'

import { LANGUAGES } from '@/i18n/translations'
import { Spinner } from '@/components/ui/Spinner'
import { SettingsPageSkeleton } from '@/components/ui/PageSkeleton'
import { PermissionsAndAccounts } from './components/PermissionsAndAccounts'
import { SecurityPasswordSettings } from './components/SecurityPasswordSettings'
import { Check, Building2, UserRound, FileText, Bell, Users, ShieldCheck, Globe } from 'lucide-react'
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
  const { data: settings, isLoading } = useSettings()
  const [businessLogo, setBusinessLogo] = useState(settings?.businessLogoURL ?? '')
  const [prevLogo, setPrevLogo] = useState(settings?.businessLogoURL ?? '')
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const { mutate: updateSettings, isPending: isUpdating } = useUpdateSettings()
  const { mutate: createSettings, isPending: isCreating } = useCreateSettings()
  const { t, language, setLanguage } = useLanguage()

  const current = settings ?? DEFAULT_SETTINGS

  if (current.businessLogoURL !== prevLogo) {
    setPrevLogo(current.businessLogoURL ?? '')
    setBusinessLogo(current.businessLogoURL ?? '')
  }

  const settingsTabs = [
    { key: 'business', label: t('settings.businessProfile'), icon: Building2, description: t('settings.descBusiness') },
    { key: 'personal', label: t('settings.personalInfo'), icon: UserRound, description: t('settings.descPersonal') },
    { key: 'invoice', label: t('settings.editInvoice'), icon: FileText, description: t('settings.descInvoice') },
    { key: 'notifications', label: t('settings.notifications'), icon: Bell, description: t('settings.descNotifications') },
    { key: 'permissions', label: t('settings.permissions'), icon: Users, description: t('settings.descPermissions') },
    { key: 'security', label: t('settings.security'), icon: ShieldCheck, description: t('settings.descSecurity') },
    { key: 'language', label: t('settings.language'), icon: Globe, description: t('settings.descLanguage') },
  ]

  const activeTabMeta = settingsTabs.find(tab => tab.key === activeTab) ?? settingsTabs[0]

  const isPending = isUpdating || isCreating
  const hasSettings = !!settings

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
          onSuccess: () => toast.success(`${key} ${t('settings.savedSuffix')}`),
          onError: (err) => {
            console.error('Settings save error:', err)
            const msg = err instanceof Error ? err.message : `${t('settings.failedToSavePrefix')} ${key}`
            toast.error(msg)
          },
        }
      )
    } else {
      const merged = clean({ ...DEFAULT_SETTINGS, ...data })
      createSettings(merged as Parameters<typeof createSettings>[0], {
        onSuccess: () => toast.success(`${key} ${t('settings.savedSuffix')}`),
        onError: (err) => {
          console.error('Settings create error:', err)
          const msg = err instanceof Error ? err.message : `${t('settings.failedToSavePrefix')} ${key}`
          toast.error(msg)
        },
      })
    }
  }

  const handleTabSave = (tab: string) => {
    const el = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null
    const val = (id: string) => el(id)?.value ?? ''

    // Safe reads from current — fall back to empty string so Firestore never gets undefined
    const curObj      = current as unknown as Record<string, unknown>
    const curPhone    = (curObj.businessPhone as string) ?? ''
    const curGSTIN    = (curObj.businessGSTIN as string) ?? ''
    const curPersonal = (curObj.personalInfo as Record<string, string>) ?? { ownerName: '', ownerPhone: '', ownerAddress: '' }

    const curReceipt  = current.receiptConfig             ?? DEFAULT_SETTINGS.receiptConfig
    const curInvoice  = current.invoiceConfig             ?? DEFAULT_SETTINGS.invoiceConfig
    const curNotif    = current.notificationConfig        ?? DEFAULT_SETTINGS.notificationConfig

    switch (tab) {
      case 'business':
        handleSave(t('settings.businessProfile'), {
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
        handleSave(t('settings.personalInfo'), {
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
        handleSave(t('settings.invoiceSettingsLabel'), {
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
        handleSave(t('settings.notifications'), {
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
        <PageHeader title={t('settings.title')} onWatchTutorial={pageTutorial.openTutorial} />
      </div>

      {isLoading ? (
        <SettingsPageSkeleton />
      ) : (
        <>
          {!hasSettings && (
            <Card className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t('settings.noSettingsYet')}
              </p>
            </Card>
          )}

          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
            {/* Section navigation — vertical rail on desktop, horizontal scroll pills on mobile/tablet */}
            <div data-tour="settings-tabs" className="w-full lg:w-64 lg:flex-shrink-0 lg:sticky lg:top-6">
              {/* Mobile / tablet: horizontally scrollable pills */}
              <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {settingsTabs.map(tab => {
                  const Icon = tab.icon
                  const active = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                        active
                          ? 'bg-gradient-to-r from-blue-600 to-sky-400 text-white shadow-md shadow-sky-400/30'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <Icon size={15} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* Desktop: vertical nav card */}
              <Card className="hidden lg:block p-2">
                {settingsTabs.map(tab => {
                  const Icon = tab.icon
                  const active = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-0.5 ${
                        active
                          ? 'bg-gradient-to-r from-blue-600 to-sky-400 text-white shadow-md shadow-sky-400/30'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                      }`}
                    >
                      <Icon size={17} className={`mt-0.5 flex-shrink-0 ${active ? 'text-white' : 'text-gray-400'}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold truncate">{tab.label}</span>
                        <span className={`block text-[11px] leading-snug mt-0.5 ${active ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                          {tab.description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </Card>
            </div>

            {/* Content panel */}
            <Card className="flex-1 w-full min-w-0 p-4 sm:p-6">
              {/* Section heading — consistent across every tab */}
              <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100 dark:border-gray-700">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white flex items-center justify-center flex-shrink-0">
                  <activeTabMeta.icon size={19} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{activeTabMeta.label}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activeTabMeta.description}</p>
                </div>
              </div>
            {activeTab === 'business' && (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <ImageUpload
                    label={t('settings.businessLogoLabel')}
                    value={businessLogo}
                    onChange={(url) => {
                      setBusinessLogo(url)
                      setIsLogoUploading(false)
                    }}
                    previewSize="lg"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  />
                  {isLogoUploading && (
                    <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                      <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      {t('settings.uploadingLogo')}
                    </p>
                  )}
                  {businessLogo && !isLogoUploading && (
                    <p className="text-xs text-emerald-600 mt-1">✓ {t('settings.logoUploadedNote')}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {t('settings.logoRecommendation')}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t('common.companyName')}
                    defaultValue={current.businessName ?? ''}
                    id="settings-business-name"
                    placeholder="e.g. Acme Retail Pvt. Ltd."
                  />
                  <Input
                    label={t('settings.businessPhoneLabel')}
                    defaultValue={(current as unknown as Record<string, string>).businessPhone ?? ''}
                    id="settings-business-phone"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <Input
                  label={t('settings.businessAddressLabel')}
                  defaultValue={current.businessAddress ?? ''}
                  id="settings-business-address"
                  placeholder="123 Main Street, City, State - 000000"
                />
                <Input
                  label={t('suppliers.gstin')}
                  defaultValue={(current as unknown as Record<string, string>).businessGSTIN ?? ''}
                  id="settings-business-gstin"
                  placeholder="e.g. 27AAPFU0939F1ZV"
                />
                <div className="pt-2">
                  <Button onClick={() => handleTabSave('business')} loading={isPending} className="w-full sm:w-auto">
                    {hasSettings ? t('settings.updateBusinessProfile') : t('settings.saveBusinessProfile')}
                  </Button>
                </div>
              </div>
            )}
            {activeTab === 'personal' && (
              <div className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t('common.ownerName')}
                    defaultValue={(current as unknown as { personalInfo?: { ownerName?: string } }).personalInfo?.ownerName ?? ''}
                    id="settings-owner-name"
                    placeholder="e.g. Rajesh Kumar"
                  />
                  <Input
                    label={t('customers.phoneNumber')}
                    defaultValue={(current as unknown as { personalInfo?: { ownerPhone?: string } }).personalInfo?.ownerPhone ?? ''}
                    id="settings-owner-phone"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <Input
                  label={t('common.address')}
                  defaultValue={(current as unknown as { personalInfo?: { ownerAddress?: string } }).personalInfo?.ownerAddress ?? ''}
                  id="settings-owner-address"
                  placeholder={t('settings.residentialAddressPlaceholder')}
                />

                <div className="pt-2">
                  <Button onClick={() => handleTabSave('personal')} loading={isPending} className="w-full sm:w-auto">
                    {hasSettings ? t('settings.updatePersonalInfo') : t('settings.savePersonalInfo')}
                  </Button>
                </div>
              </div>
            )}
            {activeTab === 'invoice' && (
              <div className="space-y-5 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t('common.companyName')}
                    defaultValue={current.receiptConfig?.companyName ?? current.businessName ?? ''}
                    id="settings-receipt-company"
                    placeholder="Seznik POS"
                  />
                  <Input
                    label={t('customers.phoneNumber')}
                    defaultValue={current.receiptConfig?.phone ?? ''}
                    id="settings-receipt-phone"
                    placeholder="PHONE : 044 258636222"
                  />
                </div>

                <Input
                  label={t('common.address')}
                  defaultValue={current.receiptConfig?.address ?? current.businessAddress ?? ''}
                  id="settings-receipt-address"
                  placeholder="123 Main Street, City, State - 000000"
                />

                <Input
                  label={t('suppliers.gstin')}
                  defaultValue={current.receiptConfig?.gstin ?? ''}
                  id="settings-receipt-gstin"
                  placeholder="GSTIN : 33AAAGP0685F1ZH"
                />

                {/* Terms & Conditions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('settings.termsConditions')}
                  </label>
                  <div className="space-y-2">
                    <input
                      id="settings-receipt-terms1"
                      defaultValue={current.receiptConfig?.termsLine1 !== undefined ? current.receiptConfig.termsLine1 : '1. Goods once sold will not be taken back or exchanged'}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder={t('settings.termsLine1Placeholder')}
                    />
                    <input
                      id="settings-receipt-terms2"
                      defaultValue={current.receiptConfig?.termsLine2 !== undefined ? current.receiptConfig.termsLine2 : ''}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder={t('settings.termsLine2Placeholder')}
                    />
                    <input
                      id="settings-receipt-terms3"
                      defaultValue={current.receiptConfig?.termsLine3 !== undefined ? current.receiptConfig.termsLine3 : ''}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder={t('settings.termsLine3Placeholder')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.footerMessageLabel')}
                  </label>
                  <textarea
                    id="settings-receipt-footer"
                    defaultValue={current.receiptConfig?.footerMessage ?? 'Thank you for your purchase!'}
                    rows={3}
                    className="w-full px-4 py-3 border rounded-xl bg-gray-50 dark:bg-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
                    placeholder={t('settings.footerMessagePlaceholder')}
                  />
                </div>

                <div className="pt-2">
                  <Button onClick={() => handleTabSave('invoice')} loading={isPending} className="w-full sm:w-auto">
                    {hasSettings ? t('settings.updateInvoiceSettings') : t('settings.saveInvoiceSettings')}
                  </Button>
                </div>
              </div>
            )}
            {activeTab === 'notifications' && (
              <div className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t('settings.lowStockThreshold')}
                    type="number"
                    defaultValue={current.notificationConfig?.lowStockThreshold ?? 10}
                    id="settings-low-stock"
                  />
                  <Input
                    label={t('settings.overdueDays')}
                    type="number"
                    defaultValue={current.notificationConfig?.overdueDays ?? 30}
                    id="settings-overdue"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {t('settings.notifThresholdNote')}
                </p>
                <div className="pt-2">
                  <Button onClick={() => handleTabSave('notifications')} loading={isPending} className="w-full sm:w-auto">
                    {hasSettings ? t('settings.updateNotifications') : t('settings.saveNotificationSettings')}
                  </Button>
                </div>
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
          </div>
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
