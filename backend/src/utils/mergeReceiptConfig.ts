/**
 * Deep-merge receiptConfig patches for cross-platform web/mobile sync.
 * Scalar fields: patch wins. customTemplates: merge by id, newer updatedAt wins.
 */

export interface CustomReceiptTemplateLike {
  id: string
  name?: string
  updatedAt?: string
  [key: string]: unknown
}

export interface ReceiptConfigLike {
  customTemplates?: CustomReceiptTemplateLike[]
  deletedTemplateIds?: string[]
  receiptConfigUpdatedAt?: string
  [key: string]: unknown
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const parseTime = (iso?: string): number => {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

/** Strip device-local file URIs from image entries before cloud persistence. */
export const normalizeReceiptConfigForCloud = (config: ReceiptConfigLike): ReceiptConfigLike => {
  const out = { ...config }
  if (Array.isArray(out.customTemplates)) {
    out.customTemplates = out.customTemplates.map((tpl) => ({
      ...tpl,
      entries: Array.isArray(tpl.entries)
        ? (tpl.entries as Record<string, unknown>[]).map((entry) => {
            if (entry.type !== 'image') return entry
            const next = { ...entry }
            const uri = typeof next.imageUri === 'string' ? next.imageUri : ''
            if (uri.startsWith('file://') || uri.startsWith('content://')) {
              delete next.imageUri
            }
            return next
          })
        : tpl.entries,
    }))
  }
  delete out.deletedTemplateIds
  return out
}

export const mergeCustomTemplates = (
  existing: CustomReceiptTemplateLike[] = [],
  patch: CustomReceiptTemplateLike[] = [],
  deletedIds: string[] = []
): CustomReceiptTemplateLike[] => {
  const byId = new Map<string, CustomReceiptTemplateLike>()
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
    const prevTs = parseTime(prev.updatedAt)
    const nextTs = parseTime(t.updatedAt)
    byId.set(t.id, nextTs >= prevTs ? t : prev)
  }
  for (const id of deletedIds) {
    byId.delete(id)
  }
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
        Array.isArray(value) ? (value as CustomReceiptTemplateLike[]) : [],
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
