import type { ReceiptConfig } from '@/types/settings.types'

const LOCAL_URI_PREFIXES = ['file://', 'content://', 'ph://', 'assets-library://']

/** True when `enabled` is missing or explicitly true. */
export function isReceiptEntryEnabled(entry: { enabled?: boolean }): boolean {
  return entry.enabled !== false
}

/** Image sources that can load in a browser preview or be fetched for print. */
export function isBrowserLoadableImageSrc(src?: string | null): boolean {
  if (!src?.trim()) return false
  const s = src.trim()
  if (LOCAL_URI_PREFIXES.some((p) => s.startsWith(p))) return false
  return (
    s.startsWith('data:') ||
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('blob:') ||
    s.startsWith('/')
  )
}

export interface ReceiptImageFields {
  imageURL?: string
  imageUri?: string
  imageBase64?: string
}

/** Pick the best logo/image src for preview + print, skipping device-local URIs. */
export function resolveReceiptImageSrc(
  entry?: ReceiptImageFields,
  fallbackUrl?: string
): string | undefined {
  for (const candidate of [entry?.imageURL, entry?.imageBase64, entry?.imageUri, fallbackUrl]) {
    if (isBrowserLoadableImageSrc(candidate)) return candidate!.trim()
  }
  return undefined
}

/** Fetch remote logos to data URLs so browser print iframes and ESC/POS rasterizer can load them. */
export async function prefetchPrintableLogoSrc(src?: string | null): Promise<string | undefined> {
  if (!isBrowserLoadableImageSrc(src)) return undefined
  const trimmed = src!.trim()
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed
  try {
    const response = await fetch(trimmed)
    if (!response.ok) {
      console.warn('[receipt] Logo fetch failed:', response.status, trimmed.slice(0, 80))
      return trimmed
    }
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || trimmed))
      reader.onerror = () => resolve(trimmed)
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('[receipt] Logo prefetch failed:', err)
    return trimmed
  }
}

/** Canonical store logo URL — receipt config first, then business profile. */
export function resolveStoreLogoUrl(
  receiptConfig?: Partial<ReceiptConfig> | null,
  businessLogoURL?: string | null
): string | undefined {
  const fromReceipt = receiptConfig?.logoURL?.trim()
  if (isBrowserLoadableImageSrc(fromReceipt)) return fromReceipt
  const fromBusiness = businessLogoURL?.trim()
  if (isBrowserLoadableImageSrc(fromBusiness)) return fromBusiness
  return undefined
}

/** Prefer an already-inlined data/blob URL so print + ESC/POS never re-fetch. */
export function preferPrintableSrc(...candidates: Array<string | null | undefined>): string | undefined {
  const loadable = candidates.map((c) => c?.trim()).filter((s): s is string => isBrowserLoadableImageSrc(s))
  return loadable.find((s) => s.startsWith('data:') || s.startsWith('blob:')) || loadable[0]
}

/** Replace remote <img src> values in receipt HTML with inlined data URLs before browser print. */
export async function inlineHtmlImageSources(html: string): Promise<string> {
  const imgSrcRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
  const urls = new Set<string>()
  for (const match of html.matchAll(imgSrcRe)) {
    const src = match[1]?.trim()
    if (isBrowserLoadableImageSrc(src)) urls.add(src!)
  }
  let out = html
  for (const url of urls) {
    const inlined = await prefetchPrintableLogoSrc(url)
    if (inlined && inlined !== url) {
      out = out.split(url).join(inlined)
    }
  }
  return out
}
