import type { CustomReceiptTemplate } from '@/types/customReceipt'
import type { ReceiptConfig, UserSettings } from '@/types/settings.types'
import {
  ensureTemplateHasLogoBlock,
  normalizeReceiptTemplates,
} from './ensureReceiptTemplates'
import { resolveStoreLogoUrl } from './receiptLogo'
import { resolveEffectiveReceiptConfig } from './receipt'
import {
  createRestaurantReceiptTemplate,
  isRestaurantReceiptTemplate,
} from './restaurantReceiptTemplate'

export interface KotReceiptPrintContext {
  receiptConfig: ReceiptConfig
  template: CustomReceiptTemplate
  shouldPersist: boolean
}

/** KOT bills always use the restaurant thermal layout (ITEM | QTY | AMT). */
export function resolveKotReceiptPrintContext(
  settings?: Partial<UserSettings> | null
): KotReceiptPrintContext {
  const receiptConfig = resolveEffectiveReceiptConfig(settings)
  const logoURL = resolveStoreLogoUrl(receiptConfig, settings?.businessLogoURL)

  const normalized = normalizeReceiptTemplates(
    {
      customTemplates: receiptConfig.customTemplates,
      activeCustomTemplateId: receiptConfig.activeCustomTemplateId,
      upiId: receiptConfig.upiId,
      logoURL: receiptConfig.logoURL,
    },
    {
      businessLogoURL: settings?.businessLogoURL,
      upiId: receiptConfig.upiId || settings?.upiId,
      businessType: 'restaurant_cafe',
    }
  )

  let template =
    normalized.customTemplates.find(isRestaurantReceiptTemplate) ?? null
  if (!template) {
    template = createRestaurantReceiptTemplate()
  }
  if (logoURL) {
    template = ensureTemplateHasLogoBlock(template, logoURL)
  }

  const customTemplates = normalized.customTemplates.some(isRestaurantReceiptTemplate)
    ? normalized.customTemplates
    : [...normalized.customTemplates, template]

  return {
    receiptConfig: {
      ...receiptConfig,
      customTemplates,
      activeCustomTemplateId: template.id,
    },
    template,
    shouldPersist: normalized.shouldPersist || !normalized.customTemplates.some(isRestaurantReceiptTemplate),
  }
}
