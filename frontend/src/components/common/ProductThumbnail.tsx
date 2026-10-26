import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import {
  directProductImageUrl,
  fetchProductImageObjectUrl,
  productNeedsAuthImage,
} from '@/utils/productImage'

type Props = {
  product: {
    id: string
    name?: string
    imageURL?: string | null
    hasImage?: boolean
  }
  className?: string
  iconSize?: number
}

/** Product photo that works with slim list API (hasImage + auth image endpoint). */
export function ProductThumbnail({ product, className = 'w-full h-full object-cover', iconSize = 20 }: Props) {
  const direct = directProductImageUrl(product)
  const [src, setSrc] = useState<string | null>(direct)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    if (direct) {
      setSrc(direct)
      return
    }
    if (!productNeedsAuthImage(product)) {
      setSrc(null)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    ;(async () => {
      const url = await fetchProductImageObjectUrl(product.id)
      if (cancelled) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      objectUrl = url
      setSrc(url)
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [product.id, product.imageURL, product.hasImage, direct])

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
        <Package size={iconSize} className="text-gray-400" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={product.name || ''}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
