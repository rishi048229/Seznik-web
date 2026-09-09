import type { CustomReceiptEntry, CustomReceiptTemplate } from '@/types/customReceipt'
import { createDefaultReceiptTemplate } from '@/types/customReceipt'
import type { BusinessType } from '@/constants/businessTypes'
import { isRestaurantBusiness } from '@/constants/businessTypes'
import type { ReceiptConfig } from '@/types/settings.types'
import { isValidUpiVpa } from './upiQr'
import { resolveStoreLogoUrl, isBrowserLoadableImageSrc } from './receiptLogo'
import {
  createRestaurantReceiptTemplate,
  isRestaurantReceiptTemplate,
} from './restaurantReceiptTemplate'

export const STANDARD_RECEIPT_TEMPLATE_NAME = 'Standard Shop Receipt'

// Id is derived from the template so repeated normalization is idempotent —
// a Date.now() id produced a new entry on every read, which churned the
// template list identity and triggered an endless re-save loop.
function createLogoEntry(logoURL?: string, templateId?: string): CustomReceiptEntry {
  return {
    id: `entry-logo-${templateId || 'default'}`,
    type: 'image',
    enabled: true,
    align: 'center',
    widthPercent: 60,
    ...(logoURL ? { imageURL: logoURL } : {}),
  }
}

/** Sync store logo onto every image block; add one if missing. */
export function ensureTemplateHasLogoBlock(
  template: CustomReceiptTemplate,
  logoURL?: string
): CustomReceiptTemplate {
  const imageIndexes = template.entries
    .map((e, i) => (e.type === 'image' ? i : -1))
    .filter((i) => i >= 0)

  if (imageIndexes.length === 0) {
    return {
      ...template,
      entries: [createLogoEntry(logoURL, template.id), ...template.entries],
    }
  }

  if (!logoURL || !isBrowserLoadableImageSrc(logoURL)) return template

  const targetLogoUrl = logoURL.trim()
  let changed = false
  const entries = template.entries.map((e) => {
    if (e.type !== 'image') return e
    if (e.imageURL === targetLogoUrl && !e.imageUri && !e.imageBase64 && (e.enabled !== false || e.enabled === true)) {
      return e
    }

    changed = true
    return {
      ...e,
      enabled: e.enabled !== false ? true : e.enabled,
      imageURL: targetLogoUrl,
      imageUri: undefined,
      imageBase64: undefined,
    }
  })

  return changed ? { ...template, entries } : template
}

/** Legacy default templates seeded showTaxColumn:false — treat as unset so Printers itemWiseGst applies. */
export function normalizeLegacyTableGstColumn(template: CustomReceiptTemplate): CustomReceiptTemplate {
  let changed = false
  const entries = template.entries.map((entry) => {
    if (entry.type !== 'table' || entry.showTaxColumn !== false) return entry
    changed = true
    const { showTaxColumn: _removed, ...rest } = entry
    return rest as CustomReceiptEntry
  })
  return changed ? { ...template, entries } : template
}

export function sanitizeScanToPayEntries(template: CustomReceiptTemplate): CustomReceiptTemplate {
  let changed = false
  const entries = template.entries.map((entry) => {
    if (entry.type === 'left_right_text' && /scan/i.test((entry.left || '') + (entry.right || ''))) {
      if (entry.left === 'SCAN TO PAY VIA UPI' && !entry.right) return entry
      changed = true
      return { ...entry, left: 'SCAN TO PAY VIA UPI', right: '' }
    }
    if ((entry.type === 'text' || entry.type === 'text_special') && /scan/i.test(entry.text || '')) {
      if (entry.text === 'SCAN TO PAY VIA UPI') return entry
      changed = true
      return { ...entry, text: 'SCAN TO PAY VIA UPI' }
    }
    return entry
  })
  return changed ? { ...template, entries } : template
}

/**
 * Normalizes legacy default templates that had digital bill QR automatically enabled
 * on initial seed so it doesn't force a QR code on test print or billing unless the user
 * configured a custom QR or UPI QR.
 */
export function normalizeLegacyDefaultTemplateQr(template: CustomReceiptTemplate): CustomReceiptTemplate {
  if (template.name !== STANDARD_RECEIPT_TEMPLATE_NAME && !template.isDefault) return template
  let changed = false
  const entries = template.entries.map((entry) => {
    if (
      entry.type === 'barcode' &&
      entry.enabled &&
      (entry.qrType === 'digital_bill' || !entry.qrType || entry.value === '{{bill_pdf_url}}') &&
      !entry.upiId
    ) {
      changed = true
      return { ...entry, enabled: false }
    }
    if (
      (entry.type === 'text' || entry.type === 'text_special') &&
      entry.enabled &&
      /scan.*bill/i.test(entry.text || '')
    ) {
      changed = true
      return { ...entry, enabled: false }
    }
    return entry
  })
  return changed ? { ...template, entries } : template
}

function applyUpiQrOnSeed(template: CustomReceiptTemplate, upiId: string): CustomReceiptTemplate {
  return {
    ...template,
    entries: template.entries.map((entry) => {
      if (entry.type === 'barcode') {
        return {
          ...entry,
          qrType: 'upi' as const,
          format: 'qr' as const,
          codeType: 'qr_code' as const,
          value: '{{upi_qr}}',
          upiId,
        }
      }
      if ((entry.type === 'text' || entry.type === 'text_special') && /scan/i.test(entry.text || '')) {
        return { ...entry, text: 'SCAN TO PAY VIA UPI' }
      }
      return entry
    }),
  }
}

function seedDefaultTemplate(
  businessType: BusinessType | null | undefined,
  logoURL?: string,
  upiId?: string
): CustomReceiptTemplate {
  let def = isRestaurantBusiness(businessType)
    ? createRestaurantReceiptTemplate()
    : createDefaultReceiptTemplate(STANDARD_RECEIPT_TEMPLATE_NAME)
  if (logoURL) def = ensureTemplateHasLogoBlock(def, logoURL)
  if (isValidUpiVpa(upiId || '')) def = applyUpiQrOnSeed(def, upiId!)
  return sanitizeScanToPayEntries(def)
}

function ensureRestaurantTemplateForBusiness(
  templates: CustomReceiptTemplate[],
  businessType: BusinessType | null | undefined,
  logoURL?: string,
  upiId?: string
): { templates: CustomReceiptTemplate[]; shouldPersist: boolean; preferredActiveId?: string } {
  if (!isRestaurantBusiness(businessType)) {
    return { templates, shouldPersist: false }
  }

  const hasRestaurant = templates.some(isRestaurantReceiptTemplate)
  if (hasRestaurant) {
    return { templates, shouldPersist: false }
  }

  let restaurantTpl = createRestaurantReceiptTemplate()
  if (logoURL) restaurantTpl = ensureTemplateHasLogoBlock(restaurantTpl, logoURL)
  if (isValidUpiVpa(upiId || '')) restaurantTpl = applyUpiQrOnSeed(restaurantTpl, upiId!)

  return {
    templates: [restaurantTpl, ...templates],
    shouldPersist: true,
    preferredActiveId: restaurantTpl.id,
  }
}

function ensureStandardShopTemplateForBusiness(
  templates: CustomReceiptTemplate[],
  businessType: BusinessType | null | undefined,
  logoURL?: string,
  upiId?: string
): { templates: CustomReceiptTemplate[]; shouldPersist: boolean; preferredActiveId?: string } {
  if (isRestaurantBusiness(businessType)) {
    return { templates, shouldPersist: false }
  }

  const hasStandard = templates.some(
    (t) => t.name === STANDARD_RECEIPT_TEMPLATE_NAME || (t.isDefault && !isRestaurantReceiptTemplate(t))
  )
  if (hasStandard) {
    return { templates, shouldPersist: false }
  }

  let standardTpl = createDefaultReceiptTemplate(STANDARD_RECEIPT_TEMPLATE_NAME)
  if (logoURL) standardTpl = ensureTemplateHasLogoBlock(standardTpl, logoURL)
  if (isValidUpiVpa(upiId || '')) standardTpl = applyUpiQrOnSeed(standardTpl, upiId!)

  return {
    templates: [standardTpl, ...templates],
    shouldPersist: true,
    preferredActiveId: standardTpl.id,
  }
}

function resolveActiveTemplateForBusinessType(
  templates: CustomReceiptTemplate[],
  businessType: BusinessType | null | undefined,
  currentActiveId: string | null,
  preferredActiveId?: string
): { activeId: string | null; changed: boolean } {
  const current = currentActiveId ? templates.find((t) => t.id === currentActiveId) : null

  if (isRestaurantBusiness(businessType)) {
    const restaurant = templates.find(isRestaurantReceiptTemplate)
    if (!restaurant) {
      const fallback = preferredActiveId ?? resolveDefaultActiveTemplateId(templates, businessType)
      return { activeId: fallback, changed: fallback !== currentActiveId }
    }
    if (!current || !isRestaurantReceiptTemplate(current)) {
      return { activeId: restaurant.id, changed: restaurant.id !== currentActiveId }
    }
    return { activeId: currentActiveId, changed: false }
  }

  const standardId =
    preferredActiveId ?? resolveDefaultActiveTemplateId(templates, businessType)
  if (!current || isRestaurantReceiptTemplate(current)) {
    return { activeId: standardId, changed: standardId !== currentActiveId }
  }
  if (!currentActiveId || !templates.some((t) => t.id === currentActiveId)) {
    return { activeId: standardId, changed: true }
  }
  return { activeId: currentActiveId, changed: false }
}

function resolveDefaultActiveTemplateId(
  templates: CustomReceiptTemplate[],
  businessType: BusinessType | null | undefined
): string | null {
  if (isRestaurantBusiness(businessType)) {
    const restaurant = templates.find(isRestaurantReceiptTemplate)
    if (restaurant) return restaurant.id
  }
  return (
    templates.find((t) => t.name === STANDARD_RECEIPT_TEMPLATE_NAME)?.id ??
    templates.find((t) => t.isDefault && !isRestaurantReceiptTemplate(t))?.id ??
    templates.find((t) => !isRestaurantReceiptTemplate(t))?.id ??
    templates[0]?.id ??
    null
  )
}

export function normalizeReceiptTemplates(
  receiptConfig: Partial<ReceiptConfig> | undefined,
  opts?: {
    businessLogoURL?: string | null
    upiId?: string | null
    businessType?: BusinessType | null
  }
): {
  customTemplates: CustomReceiptTemplate[]
  activeCustomTemplateId: string | null
  shouldPersist: boolean
} {
  const logoURL = resolveStoreLogoUrl(receiptConfig, opts?.businessLogoURL)
  const upiId = (opts?.upiId || receiptConfig?.upiId || '').trim()
  const fromServer = receiptConfig?.customTemplates
  let shouldPersist = false

  if (!Array.isArray(fromServer) || fromServer.length === 0) {
    const def = seedDefaultTemplate(opts?.businessType, logoURL, upiId)
    return {
      customTemplates: [def],
      activeCustomTemplateId: def.id,
      shouldPersist: true,
    }
  }

  let templates = fromServer.map((t) => {
    const withLogo = ensureTemplateHasLogoBlock(t, logoURL)
    const withGst = normalizeLegacyTableGstColumn(withLogo)
    const withCleanQr = normalizeLegacyDefaultTemplateQr(withGst)
    const next = sanitizeScanToPayEntries(withCleanQr)
    if (next !== t) shouldPersist = true
    return next
  })

  const restaurantSeed = ensureRestaurantTemplateForBusiness(
    templates,
    opts?.businessType,
    logoURL,
    upiId
  )
  if (restaurantSeed.shouldPersist) {
    templates = restaurantSeed.templates
    shouldPersist = true
  }

  const standardSeed = ensureStandardShopTemplateForBusiness(
    templates,
    opts?.businessType,
    logoURL,
    upiId
  )
  if (standardSeed.shouldPersist) {
    templates = standardSeed.templates
    shouldPersist = true
  }

  let activeCustomTemplateId = receiptConfig?.activeCustomTemplateId ?? null
  const preferredActiveId = restaurantSeed.preferredActiveId ?? standardSeed.preferredActiveId
  const activeResolution = resolveActiveTemplateForBusinessType(
    templates,
    opts?.businessType,
    activeCustomTemplateId,
    preferredActiveId
  )
  if (activeResolution.changed) {
    activeCustomTemplateId = activeResolution.activeId
    shouldPersist = true
  }

  return { customTemplates: templates, activeCustomTemplateId, shouldPersist }
}

export function applyLogoToTemplates(
  templates: CustomReceiptTemplate[],
  logoURL?: string
): CustomReceiptTemplate[] {
  return templates.map((t) => ensureTemplateHasLogoBlock(t, logoURL))
}
export function resolveActiveFromTemplates(
  templates: CustomReceiptTemplate[],
  activeCustomTemplateId?: string | null,
  businessType?: BusinessType | null
): CustomReceiptTemplate | null {
  if (!templates.length) return null
  if (activeCustomTemplateId) {
    const match = templates.find((t) => t.id === activeCustomTemplateId)
    if (match) return match
  }
  const fallbackId = resolveDefaultActiveTemplateId(templates, businessType)
  if (fallbackId) {
    return templates.find((t) => t.id === fallbackId) ?? templates[0]
  }
  return templates[0]
}
