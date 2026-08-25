import { useCallback, useEffect, useState } from 'react'
import {
  parseGstBilling,
  toGstBillingPayload,
  type GstBreakdownStyle,
} from '@/constants/gstBilling'
import { useCreateSettings, useSettings, useUpdateSettings } from '@/hooks/useSettings'

export interface GstBillingFormState {
  showBreakdown: boolean
  style: GstBreakdownStyle
  printOnReceipt: boolean
  itemWiseGst: boolean
}

const DEFAULT_FORM: GstBillingFormState = {
  showBreakdown: false,
  style: 'tax_invoice',
  printOnReceipt: false,
  itemWiseGst: false,
}

function formFromInvoiceConfig(invoiceConfig: unknown): GstBillingFormState {
  const gst = parseGstBilling(invoiceConfig)
  return {
    showBreakdown: gst.showBreakdown,
    style: gst.style,
    printOnReceipt: gst.printOnReceipt,
    itemWiseGst: gst.itemWiseGst,
  }
}

const DEFAULT_CREATE_SETTINGS = {
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

export function useGstBillingSettings() {
  const { data: settings, isLoading } = useSettings()
  const { mutateAsync: updateSettings, isPending: isUpdating } = useUpdateSettings()
  const { mutateAsync: createSettings, isPending: isCreating } = useCreateSettings()
  const [form, setForm] = useState<GstBillingFormState>(DEFAULT_FORM)
  const [seedVersion, setSeedVersion] = useState(0)

  useEffect(() => {
    if (!settings) return
    setForm(formFromInvoiceConfig(settings.invoiceConfig))
  }, [settings?.id, settings?.invoiceConfig, seedVersion])

  const resetFromSettings = useCallback(() => {
    setSeedVersion((v) => v + 1)
  }, [])

  const saveGstBilling = useCallback(
    async (options?: {
      extraInvoiceConfig?: Record<string, unknown>
      onSuccess?: () => void
    }) => {
      const invoiceConfig = {
        ...((settings?.invoiceConfig && typeof settings.invoiceConfig === 'object'
          ? settings.invoiceConfig
          : {}) as Record<string, unknown>),
        ...(options?.extraInvoiceConfig || {}),
        gstBilling: toGstBillingPayload(form),
      }

      if (settings?.id) {
        await updateSettings({ settingsId: settings.id, data: { invoiceConfig } })
      } else {
        await createSettings({
          ...DEFAULT_CREATE_SETTINGS,
          invoiceConfig: {
            ...DEFAULT_CREATE_SETTINGS.invoiceConfig,
            ...(typeof settings?.invoiceConfig === 'object' && settings?.invoiceConfig ? settings.invoiceConfig : {}),
            ...(options?.extraInvoiceConfig || {}),
            gstBilling: toGstBillingPayload(form),
          },
        } as unknown as Parameters<typeof createSettings>[0])
      }
      options?.onSuccess?.()
    },
    [createSettings, form, settings?.id, settings?.invoiceConfig, updateSettings],
  )

  return {
    form,
    setShowBreakdown: (showBreakdown: boolean) =>
      setForm((prev) => ({
        ...prev,
        showBreakdown,
        printOnReceipt: showBreakdown && !prev.printOnReceipt ? true : prev.printOnReceipt,
      })),
    setStyle: (style: GstBreakdownStyle) => setForm((prev) => ({ ...prev, style })),
    setPrintOnReceipt: (printOnReceipt: boolean) => setForm((prev) => ({ ...prev, printOnReceipt })),
    setItemWiseGst: (itemWiseGst: boolean) => setForm((prev) => ({ ...prev, itemWiseGst })),
    saveGstBilling,
    resetFromSettings,
    isSaving: isUpdating || isCreating,
    isLoading,
    settings,
  }
}
