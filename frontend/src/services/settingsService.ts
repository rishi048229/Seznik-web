import { fetchApi } from './api'
import type { UserSettings, InvoiceConfig, NotificationConfig } from '@/types/settings.types'

export const getSettings = async (uid: string): Promise<UserSettings | null> => {
  try {
    const settings = await fetchApi('/settings')
    return settings
  } catch (error) {
    return null
  }
}

export const createSettings = async (uid: string, data: Omit<UserSettings, 'id'>): Promise<string> => {
  const settings = await fetchApi('/settings', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return settings.id
}

export const updateSettings = async (uid: string, settingsId: string, data: Partial<Omit<UserSettings, 'id'>>): Promise<void> => {
  await fetchApi(`/settings/${settingsId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const updateInvoiceConfig = async (uid: string, settingsId: string, invoiceConfig: InvoiceConfig): Promise<void> => {
  await fetchApi(`/settings/${settingsId}/invoice`, {
    method: 'PATCH',
    body: JSON.stringify({ invoiceConfig }),
  })
}

export const updateNotificationConfig = async (uid: string, settingsId: string, notificationConfig: NotificationConfig): Promise<void> => {
  await fetchApi(`/settings/${settingsId}/notification`, {
    method: 'PATCH',
    body: JSON.stringify({ notificationConfig }),
  })
}
