/**
 * Intelligent Image & Logo Background Detection, Cleanup & Thermal Optimization Engine for Web
 *
 * Provides:
 * - Perimeter background color sampling & variance detection
 * - Thermal printer printability analysis & smart suggestions (White Clean vs Transparent vs Keep Bg vs Invert)
 * - Queue-based Flood Fill background removal with feathering / softness
 * - Clean white background replacement
 * - Color inversion (Black <-> White foreground for dark logos)
 * - Auto-cropping bounding box
 */

export type LogoProcessMode = 'transparent' | 'white_clean' | 'keep_bg';

export interface BackgroundRemovalOptions {
  mode?: 'transparent' | 'white_clean'; // transparent PNG vs pure white #FFFFFF background
  tolerance?: number; // Color distance tolerance (default: 45)
  softness?: number; // Edge feathering (default: 16)
  trimPadding?: boolean; // Auto crop (default: true)
  invert?: boolean; // Invert colors (Black <-> White)
}

export interface LogoThermalAnalysis {
  recommendedMode: LogoProcessMode;
  recommendedInvert: boolean;
  backgroundIsWhite: boolean;
  backgroundIsDark: boolean;
  foregroundIsLight: boolean;
  hasUniformBackground: boolean;
  hint: string;
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function colorDist(r: number, g: number, b: number, bgR: number, bgG: number, bgB: number): number {
  const dr = r - bgR;
  const dg = g - bgG;
  const db = b - bgB;
  return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
}

/** Helper to load an image source (URL, data URL, or File) into an HTMLImageElement */
export function loadImageElement(source: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let objectUrl: string | null = null;
    let src = '';

    if (source instanceof File) {
      objectUrl = URL.createObjectURL(source);
      src = objectUrl;
    } else {
      src = source;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = (err) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = src;
  });
}

/** Extract ImageData from an image source with optional max dimensions */
export async function getImageDataFromSource(
  source: string | File,
  maxDimension = 1000
): Promise<{ imageData: ImageData; width: number; height: number; ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement }> {
  const img = await loadImageElement(source);
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is not available');

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  return { imageData, width, height, ctx, canvas };
}

/** Sample outer boundary pixels to detect background color, luminance, and consistency */
export function sampleBorderBackground(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number) {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let lumaSum = 0;
  let lumaSqSum = 0;
  let count = 0;

  const sample = (idx: number) => {
    if (idx > pixels.length - 4) return;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const y = luma(r, g, b);
    rSum += r;
    gSum += g;
    bSum += b;
    lumaSum += y;
    lumaSqSum += y * y;
    count++;
  };

  const xStep = Math.max(1, Math.floor(width / 16));
  const yStep = Math.max(1, Math.floor(height / 16));
  for (let x = 0; x < width; x += xStep) {
    sample(x * 4);
    sample(((height - 1) * width + x) * 4);
  }
  for (let y = 1; y < height - 1; y += yStep) {
    sample((y * width) * 4);
    sample((y * width + (width - 1)) * 4);
  }

  const bgR = count > 0 ? Math.round(rSum / count) : 255;
  const bgG = count > 0 ? Math.round(gSum / count) : 255;
  const bgB = count > 0 ? Math.round(bSum / count) : 255;
  const meanLuma = count > 0 ? lumaSum / count : 255;
  const variance = count > 0 ? Math.max(0, lumaSqSum / count - meanLuma * meanLuma) : 0;

  return {
    bgR,
    bgG,
    bgB,
    bgLuma: meanLuma,
    hasUniformBackground: variance < 350,
  };
}

/** Pick the thermal-safe logo treatment so the user does not have to guess */
export function analyzePixelsForThermal(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): LogoThermalAnalysis {
  const { bgR, bgG, bgB, bgLuma, hasUniformBackground } = sampleBorderBackground(pixels, width, height);
  const bgIsWhite = hasUniformBackground && bgLuma >= 232;
  const bgIsDark = hasUniformBackground && bgLuma <= 60;

  let fgLumaSum = 0;
  let fgCount = 0;
  let bgMatchCount = 0;
  const tolerance = 45;
  const total = width * height;

  for (let p = 0; p < total; p++) {
    const idx = p * 4;
    if (pixels[idx + 3] < 10) {
      bgMatchCount++;
      continue;
    }
    if (colorDist(pixels[idx], pixels[idx + 1], pixels[idx + 2], bgR, bgG, bgB) <= tolerance) {
      bgMatchCount++;
    } else {
      fgLumaSum += luma(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
      fgCount++;
    }
  }

  const fgMeanLuma = fgCount > 0 ? fgLumaSum / fgCount : 128;
  const foregroundIsLight = fgMeanLuma >= 175;
  const bgCoverage = total > 0 ? bgMatchCount / total : 0;

  if (!hasUniformBackground || bgCoverage < 0.08) {
    return {
      recommendedMode: 'keep_bg',
      recommendedInvert: false,
      backgroundIsWhite: bgIsWhite,
      backgroundIsDark: bgIsDark,
      foregroundIsLight,
      hasUniformBackground,
      hint: 'No clear backdrop detected. Keeping the original image is safest for printing.',
    };
  }

  if (bgIsWhite) {
    return {
      recommendedMode: fgCount > 0 && foregroundIsLight && fgMeanLuma >= 210 ? 'keep_bg' : 'white_clean',
      recommendedInvert: false,
      backgroundIsWhite: true,
      backgroundIsDark: false,
      foregroundIsLight,
      hasUniformBackground,
      hint: 'This logo already has a white background. Clean White is safest — Remove Background can print as a solid black block on a thermal printer.',
    };
  }

  if (bgIsDark && foregroundIsLight) {
    return {
      recommendedMode: 'transparent',
      recommendedInvert: true,
      backgroundIsWhite: false,
      backgroundIsDark: true,
      foregroundIsLight: true,
      hasUniformBackground,
      hint: 'Light logo on a dark background. We will cut the backdrop and invert it so it prints clearly in black on white paper.',
    };
  }

  return {
    recommendedMode: 'transparent',
    recommendedInvert: foregroundIsLight,
    backgroundIsWhite: false,
    backgroundIsDark: bgIsDark,
    foregroundIsLight,
    hasUniformBackground,
    hint: 'Colored background detected. Remove Background will cut it out so the logo prints crisp on white receipts and invoices.',
  };
}

/** Analyze any image source for thermal and background characteristics */
export async function analyzeLogoForThermal(source: string | File): Promise<LogoThermalAnalysis> {
  const { imageData, width, height } = await getImageDataFromSource(source, 600);
  return analyzePixelsForThermal(imageData.data, width, height);
}

/**
 * Process pixels to remove background, clean white, invert, and auto-crop
 */
export function processPixelsRemoveBackground(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: BackgroundRemovalOptions = {}
): { pixels: Uint8ClampedArray; width: number; height: number } {
  const tolerance = options.tolerance ?? 45;
  const softness = options.softness ?? 16;
  const isWhiteClean = options.mode === 'white_clean';
  const invert = Boolean(options.invert);
  const outPixels = new Uint8ClampedArray(pixels);
  const original = new Uint8ClampedArray(pixels);

  // 1. Sample perimeter to detect background color
  const { bgR, bgG, bgB } = sampleBorderBackground(pixels, width, height);
  const getColorDist = (r: number, g: number, b: number) => colorDist(r, g, b, bgR, bgG, bgB);

  // 2. Queue-based Flood Fill starting from all outer boundary pixels
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  for (let x = 0; x < width; x++) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(y * width);
    queue.push(y * width + (width - 1));
  }

  let head = 0;
  while (head < queue.length) {
    const p = queue[head++];
    if (visited[p]) continue;
    visited[p] = 1;

    const pxIdx = p * 4;
    const r = outPixels[pxIdx];
    const g = outPixels[pxIdx + 1];
    const b = outPixels[pxIdx + 2];
    const a = outPixels[pxIdx + 3];

    if (a < 10) {
      outPixels[pxIdx] = 255;
      outPixels[pxIdx + 1] = 255;
      outPixels[pxIdx + 2] = 255;
      outPixels[pxIdx + 3] = isWhiteClean ? 255 : 0;
      continue;
    }

    const dist = getColorDist(r, g, b);

    if (dist <= tolerance) {
      // Background pixel
      outPixels[pxIdx] = 255;
      outPixels[pxIdx + 1] = 255;
      outPixels[pxIdx + 2] = 255;
      outPixels[pxIdx + 3] = isWhiteClean ? 255 : 0;

      const x = p % width;
      const y = Math.floor(p / width);

      if (x > 0 && !visited[p - 1]) queue.push(p - 1);
      if (x < width - 1 && !visited[p + 1]) queue.push(p + 1);
      if (y > 0 && !visited[p - width]) queue.push(p - width);
      if (y < height - 1 && !visited[p + width]) queue.push(p + width);
    } else if (dist <= tolerance + softness && !isWhiteClean) {
      // Soft transition
      const alphaRatio = (dist - tolerance) / softness;
      outPixels[pxIdx + 3] = Math.round(Math.min(a, 255 * alphaRatio));
    }
  }

  // If flood-fill ate the artwork (common with light logos on white), revert.
  let originalFg = 0;
  let remainingFg = 0;
  const totalPx = width * height;
  for (let p = 0; p < totalPx; p++) {
    const idx = p * 4;
    const origIsFg =
      original[idx + 3] >= 10 &&
      getColorDist(original[idx], original[idx + 1], original[idx + 2]) > tolerance;
    if (origIsFg) originalFg++;

    const outA = outPixels[idx + 3];
    const outR = outPixels[idx];
    const outG = outPixels[idx + 1];
    const outB = outPixels[idx + 2];
    const isBgNow = outA < 20 || (outR > 245 && outG > 245 && outB > 245);
    if (!isBgNow) remainingFg++;
  }
  if (originalFg > 80 && remainingFg < Math.max(40, originalFg * 0.12)) {
    outPixels.set(original);
    return { pixels: outPixels, width, height };
  }

  // 3. If Invert Colors is requested (swap dark <-> bright foreground)
  if (invert) {
    for (let p = 0; p < width * height; p++) {
      const idx = p * 4;
      const a = outPixels[idx + 3];
      // Only invert non-background elements
      if (a > 20) {
        outPixels[idx] = 255 - outPixels[idx];
        outPixels[idx + 1] = 255 - outPixels[idx + 1];
        outPixels[idx + 2] = 255 - outPixels[idx + 2];
      }
    }
  }

  // 4. Auto-crop to content bounding box
  if (options.trimPadding) {
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pIdx = (y * width + x) * 4;
        const a = outPixels[pIdx + 3];
        const r = outPixels[pIdx];
        const g = outPixels[pIdx + 1];
        const b = outPixels[pIdx + 2];

        // Content is either non-transparent or non-white
        const isBg = a < 20 || (r > 245 && g > 245 && b > 245);
        if (!isBg) {
          hasContent = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (hasContent && (minX > 0 || minY > 0 || maxX < width - 1 || maxY < height - 1)) {
      const padding = 8;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropW = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
      const cropH = Math.min(height - cropY, maxY - minY + 1 + padding * 2);

      if (cropW > 10 && cropH > 10 && (cropW < width || cropH < height)) {
        const croppedPixels = new Uint8ClampedArray(cropW * cropH * 4);
        for (let row = 0; row < cropH; row++) {
          const srcOffset = ((cropY + row) * width + cropX) * 4;
          const dstOffset = row * cropW * 4;
          croppedPixels.set(outPixels.subarray(srcOffset, srcOffset + cropW * 4), dstOffset);
        }
        return { pixels: croppedPixels, width: cropW, height: cropH };
      }
    }
  }

  return { pixels: outPixels, width, height };
}

/** Flatten RGBA pixels onto an opaque white base */
export function flattenPixelsOntoWhite(pixels: Uint8ClampedArray | Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3] / 255;
    const inv = 1 - a;
    out[i] = Math.round(pixels[i] * a + 255 * inv);
    out[i + 1] = Math.round(pixels[i + 1] * a + 255 * inv);
    out[i + 2] = Math.round(pixels[i + 2] * a + 255 * inv);
    out[i + 3] = 255;
  }
  return out;
}

/**
 * End-to-end background removal / processing for web images.
 * Takes an image source, applies background removal, clean white, or invert, and returns a high-resolution data URL.
 */
export async function removeImageBackground(
  source: string | File,
  options: BackgroundRemovalOptions = {}
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { imageData, width, height } = await getImageDataFromSource(source, 1000);
  const processed = processPixelsRemoveBackground(imageData.data, width, height, options);

  const canvas = document.createElement('canvas');
  canvas.width = processed.width;
  canvas.height = processed.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  const pixels = new Uint8ClampedArray(processed.pixels)
  const finalImageData = new ImageData(pixels, processed.width, processed.height);
  ctx.putImageData(finalImageData, 0, 0);

  const format = options.mode === 'white_clean' ? 'image/jpeg' : 'image/png';
  const quality = options.mode === 'white_clean' ? 0.92 : undefined;
  const dataUrl = canvas.toDataURL(format, quality);

  return {
    dataUrl,
    width: processed.width,
    height: processed.height,
  };
}
