export const QR_LOGIN_TYPE = 'seznik.qr-login';

/**
 * Pulls the one-time login code out of a scanned QR payload.
 * Accepts the JSON the dashboard encodes, a seznikapp:// deep link, or a bare code.
 */
export function parseQrLoginCode(raw: string): string | null {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as { t?: unknown; c?: unknown };
    if (parsed?.t === QR_LOGIN_TYPE && typeof parsed.c === 'string' && parsed.c.trim()) {
      return parsed.c.trim();
    }
  } catch {
    // not JSON — try URL / bare token below
  }

  try {
    const url = new URL(text);
    const fromQuery = url.searchParams.get('c') || url.searchParams.get('code');
    if (fromQuery?.trim()) return fromQuery.trim();
  } catch {
    // not a URL
  }

  return null;
}
