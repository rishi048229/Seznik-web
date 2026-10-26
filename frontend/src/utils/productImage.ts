import { getAuthToken } from '@/services/api'

const getApiUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL as string || '').trim()
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && envUrl.startsWith('http://')) {
    return '/api'
  }
  if (!envUrl) return '/api'
  const raw = envUrl.replace(/\/$/, '')
  return raw.endsWith('/api') ? raw : `${raw}/api`
}

/** Direct URL for http(s) / inline data images. Otherwise null (use auth fetch). */
export function directProductImageUrl(product: {
  imageURL?: string | null
}): string | null {
  const url = product.imageURL?.trim()
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  return null
}

export function productNeedsAuthImage(product: {
  id: string
  imageURL?: string | null
  hasImage?: boolean
}): boolean {
  if (directProductImageUrl(product)) return false
  return product.hasImage === true
}

/** Authenticated blob URL for list thumbnails (revoke when done). */
export async function fetchProductImageObjectUrl(productId: string): Promise<string | null> {
  const token = getAuthToken()
  if (!token) return null
  try {
    const res = await fetch(`${getApiUrl()}/products/${productId}/image`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}
