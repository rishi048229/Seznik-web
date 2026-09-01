import { rasterizeLogoPixels } from '@shared/receiptLogoRaster';
import type { ReceiptSizeChip, ThermalPaper } from '@shared/receiptPrintGeometry';
import {
  encodeRgbaToPng,
  loadImageRgba,
  uint8ArrayToBase64,
} from './imageBackgroundRemoval';
import { debugSessionLog } from './debugSessionLog';

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
  if (cached) {
    debugSessionLog(
      'receiptLogoRaster.ts:cache',
      'raster cache hit',
      { cacheHit: true, widthDots: cached.widthDots },
      'D'
    );
    return cached;
  }

  const t0 = Date.now();
  try {
    const tLoad0 = Date.now();
    const decoded = await loadImageRgba(src);
    const tLoad1 = Date.now();
    debugSessionLog(
      'receiptLogoRaster.ts:load',
      'loadImageRgba done',
      {
        ms: tLoad1 - tLoad0,
        pixelW: decoded?.width ?? 0,
        pixelH: decoded?.height ?? 0,
        cacheHit: false,
      },
      'A'
    );
    if (!decoded) return null;

    const tRaster0 = Date.now();
    const raster = rasterizeLogoPixels(
      decoded.pixels,
      decoded.width,
      decoded.height,
      paperWidth,
      widthPercent,
      chip
    );
    const tRaster1 = Date.now();
    debugSessionLog(
      'receiptLogoRaster.ts:raster',
      'rasterizeLogoPixels done',
      {
        ms: tRaster1 - tRaster0,
        widthDots: raster?.widthDots ?? 0,
        heightDots: raster?.heightDots ?? 0,
        chip,
        paperWidth,
        widthPercent,
      },
      'B'
    );
    if (!raster) return null;

    const tPng0 = Date.now();
    const pngBytes = encodeRgbaToPng(raster.pixels, raster.widthDots, raster.heightDots);
    const base64 = uint8ArrayToBase64(pngBytes);
    const tPng1 = Date.now();
    debugSessionLog(
      'receiptLogoRaster.ts:encode',
      'PNG encode + base64 done',
      {
        encodePngMs: tPng1 - tPng0,
        pngBytes: pngBytes.length,
        base64Len: base64.length,
      },
      'B'
    );
    if (!base64) return null;

    const result: RasterizedReceiptLogo = {
      base64,
      widthDots: raster.widthDots,
      heightDots: raster.heightDots,
    };
    logoRasterCache.set(key, result);

    debugSessionLog(
      'receiptLogoRaster.ts:total',
      'rasterizeReceiptLogoForPrint total',
      { totalMs: Date.now() - t0, cacheHit: false, runId: 'post-fix' },
      'D'
    );

    return result;
  } catch (err) {
    console.warn('[receiptLogoRaster] rasterizeReceiptLogoForPrint failed:', err);
    return null;
  }
}
