import { rasterizeLogoPixels } from '@shared/receiptLogoRaster';
import type { ReceiptSizeChip, ThermalPaper } from '@shared/receiptPrintGeometry';
import {
  encodeRgbaToPng,
  loadImageRgba,
  uint8ArrayToBase64,
} from './imageBackgroundRemoval';

export type RasterizedReceiptLogo = {
  base64: string;
  widthDots: number;
  heightDots: number;
};

const logoRasterCache = new Map<string, RasterizedReceiptLogo>();

function cacheKey(
  src: string,
  paperWidth: ThermalPaper,
  widthPercent: number,
  chip: ReceiptSizeChip
): string {
  return `${src}|${paperWidth}|${widthPercent}|${chip}`;
}

/** Clear cached rasterized logos (call when store logo URL changes). */
export function clearLogoRasterCache(): void {
  logoRasterCache.clear();
}

/**
 * Rasterize a store logo for thermal Bluetooth printPic — same pipeline as web
 * (flatten → trim → proportional scale → 1bpp-style mono) but outputs PNG base64 for native printPic.
 *
 * Performance: single loadImageRgba + single PNG encode; rasterizeLogoPixels handles flatten/trim in-memory.
 */
export async function rasterizeReceiptLogoForPrint(
  uri: string | undefined,
  paperWidth: ThermalPaper,
  widthPercent: number,
  chip: ReceiptSizeChip = 'medium'
): Promise<RasterizedReceiptLogo | null> {
  const src = String(uri || '').trim();
  if (!src) return null;

  const key = cacheKey(src, paperWidth, widthPercent, chip);
  const cached = logoRasterCache.get(key);
  if (cached) return cached;

  try {
    const decoded = await loadImageRgba(src);
    if (!decoded) return null;

    const raster = rasterizeLogoPixels(
      decoded.pixels,
      decoded.width,
      decoded.height,
      paperWidth,
      widthPercent,
      chip
    );
    if (!raster) return null;

    const pngBytes = encodeRgbaToPng(raster.pixels, raster.widthDots, raster.heightDots);
    const base64 = uint8ArrayToBase64(pngBytes);
    if (!base64) return null;

    const result: RasterizedReceiptLogo = {
      base64,
      widthDots: raster.widthDots,
      heightDots: raster.heightDots,
    };
    logoRasterCache.set(key, result);
    return result;
  } catch (err) {
    console.warn('[receiptLogoRaster] rasterizeReceiptLogoForPrint failed:', err);
    return null;
  }
}
