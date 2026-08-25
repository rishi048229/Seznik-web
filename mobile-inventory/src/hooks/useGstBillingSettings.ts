import { useCallback, useEffect, useState } from 'react';
import {
  parseGstBilling,
  toGstBillingPayload,
  type GstBreakdownStyle,
} from '@/constants/gstBilling';
import { useSettings } from '@/hooks/useSettings';

export interface GstBillingFormState {
  showBreakdown: boolean;
  style: GstBreakdownStyle;
  printOnReceipt: boolean;
  itemWiseGst: boolean;
}

const DEFAULT_FORM: GstBillingFormState = {
  showBreakdown: false,
  style: 'tax_invoice',
  printOnReceipt: false,
  itemWiseGst: false,
};

function formFromInvoiceConfig(invoiceConfig: unknown): GstBillingFormState {
  const gst = parseGstBilling(invoiceConfig);
  return {
    showBreakdown: gst.showBreakdown,
    style: gst.style,
    printOnReceipt: gst.printOnReceipt,
    itemWiseGst: gst.itemWiseGst,
  };
}

export function useGstBillingSettings() {
  const { settings, isLoading, updateSettings, isUpdating } = useSettings();
  const [form, setForm] = useState<GstBillingFormState>(DEFAULT_FORM);
  const [seedVersion, setSeedVersion] = useState(0);

  useEffect(() => {
    if (!settings) return;
    setForm(formFromInvoiceConfig(settings.invoiceConfig));
  }, [settings?.id, settings?.invoiceConfig, seedVersion]);

  const resetFromSettings = useCallback(() => {
    setSeedVersion((v) => v + 1);
  }, []);

  const saveGstBilling = useCallback(
    async (options?: {
      extraInvoiceConfig?: Record<string, unknown>;
      onSuccess?: () => void;
    }) => {
      const invoiceConfig = {
        ...((settings?.invoiceConfig && typeof settings.invoiceConfig === 'object'
          ? settings.invoiceConfig
          : {}) as Record<string, unknown>),
        ...(options?.extraInvoiceConfig || {}),
        gstBilling: toGstBillingPayload(form),
      };
      await updateSettings({ invoiceConfig });
      options?.onSuccess?.();
    },
    [form, settings?.invoiceConfig, updateSettings],
  );

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
    isSaving: isUpdating,
    isLoading,
    settings,
  };
}
