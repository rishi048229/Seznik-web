import * as FileSystem from 'expo-file-system/legacy';

let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch {
  ImageManipulator = null;
}

const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.82;

function isRemoteOrDataUri(uri: string): boolean {
  const trimmed = uri.trim();
  return (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  );
}

function isLocalPickUri(uri: string): boolean {
  const trimmed = uri.trim();
  return (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('assets-library://')
  );
}

/**
 * Converts a camera/gallery pick into a compressed data URL the backend can store,
 * matching the web ImageUpload flow. Raw file:// URIs are device-local and break
 * after cache clears or on other clients.
 */
export async function prepareProductImageForUpload(
  sourceUri: string | null | undefined
): Promise<string | undefined> {
  const trimmed = String(sourceUri || '').trim();
  if (!trimmed) return undefined;
  if (isRemoteOrDataUri(trimmed)) return trimmed;
  if (!isLocalPickUri(trimmed)) return trimmed;

  if (ImageManipulator && typeof ImageManipulator.manipulateAsync === 'function') {
    try {
      const result = await ImageManipulator.manipulateAsync(
        trimmed,
        [{ resize: { width: MAX_DIMENSION } }],
        {
          compress: JPEG_QUALITY,
          format: 'jpeg' as const,
          base64: true,
        }
      );
      if (result.base64) {
        return `data:image/jpeg;base64,${result.base64}`;
      }
    } catch (err) {
      console.warn('Product image compression failed, falling back to raw base64:', err);
    }
  }

  const base64 = await FileSystem.readAsStringAsync(trimmed, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64}`;
}
