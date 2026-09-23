import { fetchApi } from './client';
import type { KotConfig } from '@shared/kotConfig';

export interface Settings {
  id: string;
  businessName?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessGSTIN?: string | null;
  businessLogoURL?: string | null;
  upiId?: string | null;
  personalInfo?: Record<string, any> | null;
  invoiceConfig?: Record<string, any> | null;
  notificationConfig?: Record<string, any> | null;
  receiptConfig?: Record<string, any> | null;
  printerConfig?: Record<string, any> | null;
  labelConfig?: Record<string, any> | null;
  // Multi-location inventory (opt-in — see src/hooks/useLocations.ts, src/app/stores/index.tsx).
  locationConfig?: { enabled: boolean } | null;
  /** Restaurant / KOT behaviour. Shape and defaults are shared with the web app — see
   *  shared/kotConfig.ts. Read it through mergeKotConfig(), never raw, so a partial or absent
   *  config still resolves to the venue's preset. */
  kotConfig?: KotConfig | null;
  /** When false (restaurants/cafes), quantity stock is not tracked — use Product.isAvailable. */
  trackStock?: boolean;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SettingsPayload = Partial<Omit<Settings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

export const settingsApi = {
  getSettings: async (): Promise<Settings | null> => {
    return fetchApi<Settings | null>('/settings');
  },

  createSettings: async (payload: SettingsPayload): Promise<Settings> => {
    return fetchApi<Settings>('/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSettings: async (id: string, payload: SettingsPayload): Promise<Settings> => {
    return fetchApi<Settings>(`/settings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  updatePrinterConfig: async (printerConfig: Record<string, any>): Promise<Settings> => {
    return fetchApi<Settings>('/settings/printer', {
      method: 'PATCH',
      body: JSON.stringify({ printerConfig }),
    });
  },

  updateReceiptConfig: async (receiptConfig: Record<string, any>): Promise<Settings> => {
    return fetchApi<Settings>('/settings/receipt', {
      method: 'PATCH',
      body: JSON.stringify({ receiptConfig }),
    });
  },

  updateLabelConfig: async (labelConfig: Record<string, any>): Promise<Settings> => {
    return fetchApi<Settings>('/settings', {
      method: 'POST',
      body: JSON.stringify({ labelConfig }),
    });
  },

  updateInvoiceConfig: async (id: string, invoiceConfig: Record<string, any>): Promise<Settings> => {
    return fetchApi<Settings>(`/settings/${id}/invoice`, {
      method: 'PATCH',
      body: JSON.stringify({ invoiceConfig }),
    });
  },

  updateNotificationConfig: async (id: string, notificationConfig: Record<string, any>): Promise<Settings> => {
    return fetchApi<Settings>(`/settings/${id}/notification`, {
      method: 'PATCH',
      body: JSON.stringify({ notificationConfig }),
    });
  },
};
