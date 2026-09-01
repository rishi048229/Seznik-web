import type { CustomReceiptEntry, CustomReceiptTemplate } from '@/types/customReceipt'
import { createDefaultReceiptTemplate } from '@/types/customReceipt'
import type { BusinessType } from '@/constants/businessTypes'
import { isRestaurantBusiness } from '@/constants/businessTypes'
import type { ReceiptConfig } from '@/types/settings.types'
import { isValidUpiVpa } from './upiQr'
import { resolveStoreLogoUrl, isBrowserLoadableImageSrc } from './receiptLogo'
import {
  RESTAURANT_RECEIPT_TEMPLATE_NAME,
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

  if (!logoURL) return template

  let changed = false
  const entries = template.entries.map((e) => {
    if (e.type !== 'image') return e
    const loadableEntryUrl = isBrowserLoadableImageSrc(e.imageURL)
    const loadableUri = isBrowserLoadableImageSrc(e.imageUri)
    const loadableBase64 = isBrowserLoadableImageSrc(e.imageBase64)
    const hasLoadableImage = loadableEntryUrl || loadableUri || loadableBase64

    // Empty or device-only image blocks should always pick up the store logo.
    if (!hasLoadableImage) {
      changed = true
      return {
        ...e,
        enabled: e.enabled !== false ? true : e.enabled,
        imageURL: logoURL,
        imageUri: undefined,
        imageBase64: undefined,
      }
    }

    // Keep blocks that already point at a different custom cloud/data image
    if (loadableEntryUrl && e.imageURL !== logoURL) return e
    if (loadableEntryUrl && e.imageURL === logoURL) return e
    if (loadableBase64 && !loadableEntryUrl) return e

    changed = true
    return { ...e, enabled: e.enabled !== false ? true : e.enabled, imageURL: logoURL, imageUri: undefined, imageBase64: undefined }
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
    templates.find((t) => t.isDefault)?.id ??
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
    const next = sanitizeScanToPayEntries(withGst)
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

  // Deliberately no "always re-add the standard template" step here: it made a
  // deleted template reappear on the next read. The empty-list branch above
  // still guarantees at least one template exists.

  let activeCustomTemplateId = receiptConfig?.activeCustomTemplateId ?? null
  if (restaurantSeed.preferredActiveId) {
    activeCustomTemplateId = restaurantSeed.preferredActiveId
    shouldPersist = true
  } else if (isRestaurantBusiness(opts?.businessType)) {
    const restaurant = templates.find(isRestaurantReceiptTemplate)
    const currentActive = templates.find((t) => t.id === activeCustomTemplateId)
    if (restaurant && (!currentActive || currentActive.name === STANDARD_RECEIPT_TEMPLATE_NAME)) {
      activeCustomTemplateId = restaurant.id
      shouldPersist = true
    }
  } else if (!activeCustomTemplateId || !templates.some((t) => t.id === activeCustomTemplateId)) {
    activeCustomTemplateId = resolveDefaultActiveTemplateId(templates, opts?.businessType)
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
