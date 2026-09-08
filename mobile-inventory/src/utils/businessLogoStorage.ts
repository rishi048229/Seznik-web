import * as FileSystem from 'expo-file-system/legacy';

const LOGO_DIR = `${FileSystem.documentDirectory || ''}store-assets/`;
const LOGO_FILE = `${LOGO_DIR}business-logo.jpg`;

/** True when the URI already points at our durable on-device copy. */
export function isPersistentLogoUri(uri: string): boolean {
  return uri.startsWith(LOGO_DIR);
}

/**
 * Copies a picked/processed logo into app document storage so it survives cache clears
 * and app restarts. ImagePicker cache URIs are temporary and break receipt printing later.
 */
export async function persistBusinessLogo(sourceUri: string): Promise<string> {
  const trimmed = String(sourceUri || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (isPersistentLogoUri(trimmed)) return trimmed;

  await FileSystem.makeDirectoryAsync(LOGO_DIR, { intermediates: true }).catch(() => {});

  if (trimmed.startsWith('data:')) {
    const base64 = trimmed.split(',')[1] || '';
    if (!base64) return trimmed;
    await FileSystem.writeAsStringAsync(LOGO_FILE, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return LOGO_FILE;
  }

  await FileSystem.copyAsync({ from: trimmed, to: LOGO_FILE });
  return LOGO_FILE;
}

/**
 * Returns a logo URI that still exists on disk, or null when the saved path is stale.
 */
export async function resolveBusinessLogoUri(stored: string | null | undefined): Promise<string | null> {
  const trimmed = String(stored || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  try {
    const info = await FileSystem.getInfoAsync(trimmed);
    if (info.exists) return trimmed;
  } catch {
    /* fall through */
  }

  try {
    const fallback = await FileSystem.getInfoAsync(LOGO_FILE);
    if (fallback.exists) return LOGO_FILE;
  } catch {
    /* fall through */
  }

  return null;
}
