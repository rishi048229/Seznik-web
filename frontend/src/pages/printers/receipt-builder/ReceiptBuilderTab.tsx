import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
import { Save, Printer, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useReceiptBuilderSync } from '@/hooks/useReceiptBuilderSync'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/contexts/AuthContext'
import type { CustomReceiptEntry, CustomReceiptTemplate } from '@/types/customReceipt'
import { createEmptyBlock } from '@/types/customReceipt'
import { SAMPLE_RECEIPT_CONTEXT } from '@/utils/customReceiptEngine'
import { isValidUpiVpa } from '@/utils/upiQr'
import { ReceiptLivePreviewPanel } from './ReceiptLivePreviewPanel'
import { ReceiptBlockList } from './ReceiptBlockList'
import { ReceiptBlockEditorPanel, BLOCK_ADD_OPTIONS } from './ReceiptBlockEditorPanel'
import { ReceiptSimpleEditor } from './ReceiptSimpleEditor'
import { ReceiptTemplateHub } from './ReceiptTemplateHub'
import { templateRequiresUpiId } from './receiptSimpleSections'
import { runReceiptTemplateTestPrint, sampleTestSaleFromContext } from '@/utils/receiptTestPrint'
import type { ReceiptConfig } from '@/types/settings.types'
import { ensureTemplateHasLogoBlock } from '@/utils/ensureReceiptTemplates'
import { resolveStoreLogoUrl } from '@/utils/receiptLogo'
import { isRestaurantBusiness } from '@/constants/businessTypes'
import { isRestaurantReceiptTemplate } from '@/utils/restaurantReceiptTemplate'
import type { GstBillingFormState } from '@/hooks/useGstBillingSettings'
import type { GstBreakdownStyle } from '@/constants/gstBilling'
import type { CustomReceiptGstOpts } from '@/utils/customReceiptEngine'

export interface ReceiptBuilderTabHandle {
  runTestPrint: () => Promise<void>
}

interface ReceiptBuilderTabProps {
  onTestPrintBytes?: (bytes: Uint8Array) => Promise<void>
  connectionType?: 'bluetooth' | 'system_driver'
  bleConnected?: boolean
  /** Local receipt fields from Printers page (may include unsaved logo). */
  receiptConfigOverride?: Partial<ReceiptConfig>
  previewGstOpts?: CustomReceiptGstOpts
  gstForm?: GstBillingFormState
  onGstStyleChange?: (style: GstBreakdownStyle) => void
  onGstPrintOnReceiptChange?: (printOnReceipt: boolean) => void
  onGstItemWiseGstChange?: (itemWiseGst: boolean) => void
  onSaveGst?: () => Promise<void>
  isSavingGst?: boolean
}

export const ReceiptBuilderTab = forwardRef<ReceiptBuilderTabHandle, ReceiptBuilderTabProps>(function ReceiptBuilderTab(
  {
    connectionType = 'system_driver',
    bleConnected = false,
    receiptConfigOverride,
    previewGstOpts,
    gstForm,
    onGstStyleChange,
    onGstPrintOnReceiptChange,
    onGstItemWiseGstChange,
    onSaveGst,
    isSavingGst = false,
  },
  ref
) {
  const { t } = useLanguage()
  const { user, userProfile } = useAuth()
  const isRestaurant = isRestaurantBusiness(user?.businessType ?? userProfile?.businessType)
  const businessType = user?.businessType ?? userProfile?.businessType
  const prevBusinessTypeRef = useRef(businessType)
  const {
    settings,
    receiptConfig,
    customTemplates,
    activeCustomTemplateId,
    isLoading,
    isSaving,
    deleteTemplate,
    duplicateTemplate,
    setActiveTemplate,
    createTemplate,
    saveReceiptPatch,
  } = useReceiptBuilderSync()

  const effectiveReceiptConfig = useMemo(
    () => ({ ...receiptConfig, ...receiptConfigOverride }),
    [receiptConfig, receiptConfigOverride]
  )
  const storeLogoUrl = resolveStoreLogoUrl(effectiveReceiptConfig, settings?.businessLogoURL)

  const [selectedId, setSelectedId] = useState<string>(() => customTemplates[0]?.id || '')
  const [draft, setDraft] = useState<CustomReceiptTemplate | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [editorMode, setEditorMode] = useState<'simple' | 'customize'>('simple')
  const [upiDraft, setUpiDraft] = useState<string | null>(null)

  const selectedTemplate = useMemo(
    () => draft || customTemplates.find((t) => t.id === selectedId) || customTemplates[0],
    [customTemplates, draft, selectedId]
  )

  // Switch editor to the new default when business type changes.
  useEffect(() => {
    if (businessType === prevBusinessTypeRef.current) return
    prevBusinessTypeRef.current = businessType
    if (!activeCustomTemplateId) return
    setSelectedId(activeCustomTemplateId)
    setDraft(null)
    setDirty(false)
    setUpiDraft(null)
  }, [businessType, activeCustomTemplateId])

  // Only pick a template when the current selection is missing (first load or after delete).
  useEffect(() => {
    if (selectedId && customTemplates.some((t) => t.id === selectedId)) return
    setSelectedId(activeCustomTemplateId || customTemplates[0]?.id || '')
  }, [activeCustomTemplateId, customTemplates, selectedId])

  // Reset only when switching templates. Keying this on customTemplates dropped
  // the in-progress draft (and cleared `dirty`, disabling Save) every time the
  // settings query refetched in the background.
  useEffect(() => {
    setDraft(null)
    setDirty(false)
    setUpiDraft(null)
  }, [selectedId])

  const storeUpiId = upiDraft ?? (effectiveReceiptConfig.upiId || settings?.upiId || '')
  const handleUpiIdChange = useCallback((next: string) => {
    setUpiDraft(next)
    setDirty(true)
  }, [])

  const previewContext = useMemo(() => ({
    ...SAMPLE_RECEIPT_CONTEXT,
    storeName: effectiveReceiptConfig.companyName || settings?.businessName || user?.businessName || user?.displayName || SAMPLE_RECEIPT_CONTEXT.storeName,
    storeAddress: effectiveReceiptConfig.address || settings?.businessAddress || '',
    storePhone: effectiveReceiptConfig.phone || settings?.businessPhone || user?.phone || '',
    storeGstin: effectiveReceiptConfig.gstin || settings?.businessGSTIN || '',
    storeLogoUrl,
    upiId: storeUpiId,
    footerMessage: effectiveReceiptConfig.footerMessage || SAMPLE_RECEIPT_CONTEXT.footerMessage,
    ...(isRestaurant ? { tableNo: '12', tokenNo: '42', waiterName: 'RAJ' } : {}),
  }), [effectiveReceiptConfig, settings, storeLogoUrl, storeUpiId, user, isRestaurant])

  const gstOpts = useMemo(
    () => ({ ...previewGstOpts, isRestaurant }),
    [previewGstOpts, isRestaurant]
  )

  const updateDraft = useCallback((updater: (tpl: CustomReceiptTemplate) => CustomReceiptTemplate) => {
    if (!selectedTemplate) return
    const base = draft || selectedTemplate
    setDraft(updater({ ...base, updatedAt: new Date().toISOString() }))
    setDirty(true)
  }, [draft, selectedTemplate])

  const upiBlocked = Boolean(
    selectedTemplate && templateRequiresUpiId(draft || selectedTemplate) && !isValidUpiVpa(storeUpiId)
  )

  const handleSave = async () => {
    if (!selectedTemplate) return
    const toSave = { ...(draft || selectedTemplate), updatedAt: new Date().toISOString() }
    if (templateRequiresUpiId(toSave) && !isValidUpiVpa(storeUpiId)) {
      toast.error(t('printers.receiptBuilder.upiRequired'))
      setEditorMode('simple')
      return
    }
    try {
      const list = customTemplates.some((tpl) => tpl.id === toSave.id)
        ? customTemplates.map((tpl) => (tpl.id === toSave.id ? toSave : tpl))
        : [...customTemplates, toSave]
      await saveReceiptPatch({
        customTemplates: list,
        ...(isValidUpiVpa(storeUpiId) ? { upiId: storeUpiId.trim() } : {}),
      })
      setDraft(null)
      setDirty(false)
      toast.success(t('printers.receiptBuilder.saved') || 'Receipt template saved')
    } catch {
      toast.error('Failed to save template')
    }
  }

  const handleTestPrint = useCallback(async () => {
    if (!selectedTemplate) return
    const tpl = draft || selectedTemplate
    if (templateRequiresUpiId(tpl) && !isValidUpiVpa(storeUpiId)) {
      toast.error(t('printers.receiptBuilder.upiRequired'))
      setEditorMode('simple')
      return
    }
    try {
      await runReceiptTemplateTestPrint({
        sale: sampleTestSaleFromContext(),
        receiptConfig: { ...effectiveReceiptConfig, upiId: storeUpiId.trim() },
        customTemplates,
        templateId: tpl.id,
        templateDraft: ensureTemplateHasLogoBlock(tpl, storeLogoUrl),
        paperSize: tpl.paperWidth,
        settings,
        businessName: previewContext.storeName,
        businessAddress: previewContext.storeAddress,
        businessPhone: previewContext.storePhone,
        businessGSTIN: previewContext.storeGstin,
        customerName: previewContext.customerName,
        logoURL: storeLogoUrl,
        businessLogoURL: settings?.businessLogoURL,
        invoiceConfig: settings?.invoiceConfig,
        connectionType,
        bleConnected,
        isRestaurant,
      })
      toast.success('Test print sent')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test print failed')
    }
  }, [
    selectedTemplate,
    draft,
    effectiveReceiptConfig,
    customTemplates,
    previewContext,
    storeLogoUrl,
    settings,
    connectionType,
    bleConnected,
    storeUpiId,
    t,
    isRestaurant,
  ])

  useImperativeHandle(ref, () => ({ runTestPrint: handleTestPrint }), [handleTestPrint])

  const previewTemplate = useMemo(() => {
    const working = draft || selectedTemplate
    if (!working) return null
    return ensureTemplateHasLogoBlock(working, storeLogoUrl)
  }, [draft, selectedTemplate, storeLogoUrl])

  if (isLoading || !selectedTemplate || !previewTemplate) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  const working = draft || selectedTemplate

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="text-indigo-600" size={20} />
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('printers.receiptBuilder.title') || 'Custom Receipt Builder'}</h2>
            <p className="text-[11px] text-gray-600 dark:text-gray-400">{t('printers.receiptBuilder.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleTestPrint} disabled={isSaving || upiBlocked}>
            <Printer size={16} className="mr-1" /> Test Print
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !dirty || upiBlocked}>
            {isSaving ? <Spinner size="sm" /> : <Save size={16} className="mr-1" />}
            Save
          </Button>
        </div>
      </div>

      <ReceiptTemplateHub
        templates={customTemplates}
        activeId={activeCustomTemplateId}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={async () => {
          const tpl = await createTemplate()
          setSelectedId(tpl.id)
        }}
        onDuplicate={duplicateTemplate}
        onDelete={async (id) => {
          try {
            await deleteTemplate(id)
            if (selectedId === id) setSelectedId(customTemplates.find((t) => t.id !== id)?.id || '')
            toast.success('Template deleted')
          } catch {
            toast.error('Failed to delete template')
          }
        }}
        onActivate={async (id) => {
          const tpl = customTemplates.find((item) => item.id === id)
          if (tpl && templateRequiresUpiId(tpl) && !isValidUpiVpa(storeUpiId)) {
            toast.error(t('printers.receiptBuilder.upiRequired'))
            setSelectedId(id)
            setEditorMode('simple')
            return
          }
          await setActiveTemplate(id)
          toast.success('Template activated for checkout')
        }}
        isSaving={isSaving}
      />

      {isRestaurant ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          Restaurant & Cafe uses the <span className="font-bold">Restaurant Bill</span> template by default — compact{' '}
          <span className="font-mono">ITEM | QTY | AMT</span> columns with bill, table, and waiter lines.
          {activeCustomTemplateId && customTemplates.find((t) => t.id === activeCustomTemplateId && isRestaurantReceiptTemplate(t))
            ? ' This template is active for checkout.'
            : ' Activate it from the list above to use at checkout.'}
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0">
        <div className="w-full lg:w-7/12 space-y-4 bg-white dark:bg-dark-card p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs font-semibold text-gray-500">{t('printers.receiptBuilder.templateName')}</label>
              <input
                className="w-full mt-1 px-3 py-2 border rounded-xl text-xs dark:bg-dark-elevated dark:border-dark-border-strong"
                value={working.name}
                onChange={(e) => updateDraft((t) => ({ ...t, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">{t('printers.receiptBuilder.paper')}</label>
              <div className="flex gap-1 mt-1">
                {(['58mm', '80mm'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updateDraft((t) => ({ ...t, paperWidth: w }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${working.paperWidth === w ? 'bg-[#0a0a2e] dark:bg-zinc-100 dark:text-zinc-900 border-[#0a0a2e] dark:border-zinc-500' : 'border-gray-200 dark:border-dark-border-strong'}`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">{t('printers.receiptBuilder.editorMode')}</label>
            <div className="flex gap-1 mt-1">
              {([
                { id: 'simple' as const, label: t('printers.receiptBuilder.simple') },
                { id: 'customize' as const, label: t('printers.receiptBuilder.customize') },
              ]).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setEditorMode(mode.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${editorMode === mode.id ? 'bg-[#0a0a2e] dark:bg-zinc-100 dark:text-zinc-900 border-[#0a0a2e] dark:border-zinc-500' : 'border-gray-200 dark:border-dark-border-strong'}`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {editorMode === 'simple' ? (
            <ReceiptSimpleEditor
              template={working}
              logoFallback={storeLogoUrl || settings?.businessLogoURL}
              upiId={storeUpiId}
              onUpiIdChange={handleUpiIdChange}
              isRestaurant={isRestaurant}
              onChange={(next) => updateDraft((current) => ({ ...next, updatedAt: current.updatedAt }))}
            />
          ) : (
            <>
              <ReceiptBlockList
                entries={working.entries}
                expandedId={expandedId}
                onReorder={(entries) => updateDraft((t) => ({ ...t, entries }))}
                onToggle={(id, enabled) =>
                  updateDraft((t) => ({
                    ...t,
                    entries: t.entries.map((e) => (e.id === id ? { ...e, enabled } : e)),
                  }))
                }
                onExpand={setExpandedId}
                onDelete={(id) => updateDraft((t) => ({ ...t, entries: t.entries.filter((e) => e.id !== id) }))}
                renderEditor={(entry) => (
                  <ReceiptBlockEditorPanel
                    entry={entry}
                    logoFallback={storeLogoUrl || settings?.businessLogoURL}
                    storeUpiId={storeUpiId}
                    onStoreUpiIdChange={handleUpiIdChange}
                    isRestaurant={isRestaurant}
                    onChange={(updated) =>
                      updateDraft((t) => ({
                        ...t,
                        entries: t.entries.map((e) => (e.id === updated.id ? updated : e)) as CustomReceiptEntry[],
                      }))
                    }
                  />
                )}
              />

              <div className="pt-2">
                <label className="text-xs font-semibold text-gray-500 block mb-1">{t('printers.receiptBuilder.addBlock')}</label>
                <select
                  className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-dark-elevated dark:border-dark-border-strong"
                  defaultValue=""
                  onChange={(e) => {
                    const type = e.target.value as CustomReceiptEntry['type']
                    if (!type) return
                    updateDraft((t) => ({ ...t, entries: [...t.entries, createEmptyBlock(type)] }))
                    e.target.value = ''
                  }}
                >
                  <option value="">{t('printers.receiptBuilder.selectBlockType')}</option>
                  {BLOCK_ADD_OPTIONS.map((o) => (
                    <option key={o.type} value={o.type}>{o.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {gstForm && onGstStyleChange && onGstPrintOnReceiptChange && onGstItemWiseGstChange && onSaveGst ? (
            <GstPrintDisplaySection
              form={gstForm}
              onStyleChange={onGstStyleChange}
              onPrintOnReceiptChange={onGstPrintOnReceiptChange}
              onItemWiseGstChange={onGstItemWiseGstChange}
              onSave={onSaveGst}
              isSaving={isSavingGst}
            />
          ) : null}
        </div>

        <div className="w-full lg:w-5/12 lg:sticky lg:top-6 self-start">
          <ReceiptLivePreviewPanel
            template={previewTemplate}
            context={previewContext}
            gstOpts={gstOpts}
          />
        </div>
      </div>
    </div>
  )
})
