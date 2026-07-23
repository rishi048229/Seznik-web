import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface AutoRotateImageProps {
  images: string[]
  alt: string
  intervalMs?: number
  className?: string
  /** 'contain' avoids cropping when the box's aspect ratio doesn't exactly match the image. */
  fit?: 'cover' | 'contain'
}

// Crossfades through `images` every `intervalMs` — used for sections that ship
// more than one real screenshot (e.g. two dashboard views). Single-image
// sections just render statically, no timer needed.
export const AutoRotateImage = ({ images, alt, intervalMs = 3000, className, fit = 'cover' }: AutoRotateImageProps) => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (images.length < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % images.length), intervalMs)
    return () => window.clearInterval(timer)
  }, [images.length, intervalMs])

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      <AnimatePresence mode="wait">
        <motion.img
          key={images[index]}
          src={images[index]}
          alt={alt}
          draggable={false}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute inset-0 w-full h-full object-top select-none ${
            fit === 'contain' ? 'object-contain' : 'object-cover'
          }`}
        />
      </AnimatePresence>

      {images.length > 1 && (
        <div className="absolute bottom-3 right-3 flex gap-1.5 z-10 px-2 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
          {images.map((src, i) => (
            <span
              key={src}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
