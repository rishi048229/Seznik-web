import type { CustomReceiptTemplate } from '@/types/customReceipt'

export interface ReceiptConfigLike {
  customTemplates?: CustomReceiptTemplate[]
  deletedTemplateIds?: string[]
  receiptConfigUpdatedAt?: string
  activeCustomTemplateId?: string | null
  templateId?: string
  enableBillQrCode?: boolean
  [key: string]: unknown
}

const parseTime = (iso?: string): number => {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

export const normalizeReceiptConfigForCloud = (config: ReceiptConfigLike): ReceiptConfigLike => {
  const out = { ...config }
  if (Array.isArray(out.customTemplates)) {
    out.customTemplates = out.customTemplates.map((tpl) => ({
      ...tpl,
      entries: tpl.entries.map((entry) => {
        if (entry.type !== 'image') return entry
        const uri = entry.imageUri
        if (uri && (uri.startsWith('file://') || uri.startsWith('content://'))) {
          const { imageUri: _, ...rest } = entry
          return rest
        }
        return entry
      }),
    }))
  }
  delete out.deletedTemplateIds
  return out
}

export const mergeCustomTemplates = (
  existing: CustomReceiptTemplate[] = [],
  patch: CustomReceiptTemplate[] = [],
  deletedIds: string[] = []
): CustomReceiptTemplate[] => {
  const byId = new Map<string, CustomReceiptTemplate>()
  for (const t of existing) {
    if (t?.id) byId.set(t.id, t)
  }
  for (const t of patch) {
    if (!t?.id) continue
    const prev = byId.get(t.id)
    if (!prev) {
      byId.set(t.id, t)
      continue
    }
    byId.set(t.id, parseTime(t.updatedAt) >= parseTime(prev.updatedAt) ? t : prev)
  }
  for (const id of deletedIds) byId.delete(id)
  return Array.from(byId.values())
}

export const mergeReceiptConfig = (
  existing: ReceiptConfigLike = {},
  patch: ReceiptConfigLike = {}
): ReceiptConfigLike => {
  const merged: ReceiptConfigLike = { ...existing }

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'customTemplates') {
      merged.customTemplates = mergeCustomTemplates(
        Array.isArray(existing.customTemplates) ? existing.customTemplates : [],
        Array.isArray(value) ? value : [],
        Array.isArray(patch.deletedTemplateIds) ? patch.deletedTemplateIds : []
      )
      continue
    }
    if (key === 'deletedTemplateIds') continue
    if (value === undefined) continue
    merged[key] = value
  }

  merged.receiptConfigUpdatedAt =
    typeof patch.receiptConfigUpdatedAt === 'string'
      ? patch.receiptConfigUpdatedAt
      : new Date().toISOString()

  return normalizeReceiptConfigForCloud(merged)
}
