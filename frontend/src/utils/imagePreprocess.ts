// Prepares a camera photo / screenshot for OCR extraction.
//
// Phone photos of bills and menus are usually far larger than the AI needs,
// and often unevenly lit — one side bright, the other in shadow. Both hurt
// extraction: oversized images waste the request budget, and low-contrast
// regions read as noise. Downscaling to a sane ceiling and stretching the
// tonal range materially improves what the model can read back.

export interface PreprocessResult {
  /** data: URI ready to send to the extraction endpoint. */
  dataUrl: string
  mimeType: string
  width: number
  height: number
  /** True when the source was small enough that upscaling text was impossible. */
  isLowResolution: boolean
}

/** Longest edge we send. Above this, detail gain flattens but payload keeps growing. */
const MAX_EDGE = 2200
/**
 * Below this, a photo of a dense price list rarely has legible glyphs.
 * Kept deliberately low so ordinary phone screenshots don't trip the warning.
 */
const LOW_RES_EDGE = 640

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read this image file.'))
    }
    img.src = url
  })

/**
 * Stretches the luminance histogram so shadowed and washed-out photos gain
 * contrast, using percentile clipping so a few extreme pixels (glare spots,
 * dark corners) don't flatten the whole correction.
 */
const autoEnhanceContrast = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const histogram = new Array(256).fill(0)
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0
    histogram[luma]++
  }

  const totalPixels = width * height
  const clip = totalPixels * 0.005 // ignore the extreme 0.5% at each end

  let low = 0
  let acc = 0
  for (let i = 0; i < 256; i++) {
    acc += histogram[i]
    if (acc > clip) { low = i; break }
  }

  let high = 255
  acc = 0
  for (let i = 255; i >= 0; i--) {
    acc += histogram[i]
    if (acc > clip) { high = i; break }
  }

  // Already well-distributed, or degenerate — leave it alone.
  if (high - low < 20) return

  const scale = 255 / (high - low)
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, (i - low) * scale))
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]]
    data[i + 1] = lut[data[i + 1]]
    data[i + 2] = lut[data[i + 2]]
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Downscales an oversized photo and normalizes its contrast before upload.
 * Falls back to the untouched file if anything about canvas processing fails,
 * so a preprocessing problem can never block an extraction attempt.
 */
export const preprocessImageForOcr = async (file: File): Promise<PreprocessResult> => {
  const img = await loadImage(file)

  const longestEdge = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = longestEdge > MAX_EDGE ? MAX_EDGE / longestEdge : 1
  const width = Math.round(img.naturalWidth * scale)
  const height = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is unavailable in this browser.')

  // White base so transparent PNG screenshots don't render text on black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

  try {
    autoEnhanceContrast(ctx, width, height)
  } catch {
    // Tainted canvas or memory pressure — the resized image alone is still useful.
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    mimeType: 'image/jpeg',
    width,
    height,
    isLowResolution: Math.max(img.naturalWidth, img.naturalHeight) < LOW_RES_EDGE,
  }
}
