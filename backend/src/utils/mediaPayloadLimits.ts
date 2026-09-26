/** Max decoded image payload when clients send base64 data URLs in settings / products. */
export const MAX_IMAGE_DATA_URL_BYTES = 1024 * 1024;

function dataUrlByteLength(value: string): number {
  const comma = value.indexOf(',');
  const base64 = comma >= 0 ? value.slice(comma + 1) : value;
  return Buffer.byteLength(base64, 'base64');
}

export function isOversizedDataUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.startsWith('data:')) return false;
  return dataUrlByteLength(value) > MAX_IMAGE_DATA_URL_BYTES;
}

/** Walk known settings/product fields; returns user-facing error or null. */
export function validateImagePayloads(body: Record<string, unknown>): string | null {
  const topKeys = ['businessLogoURL', 'imageUrl', 'imageURL'] as const;
  for (const key of topKeys) {
    if (isOversizedDataUrl(body[key])) {
      return `Image in "${key}" exceeds 1 MB. Compress or use a smaller file.`;
    }
  }

  const receipt = body.receiptConfig;
  if (receipt && typeof receipt === 'object') {
    const r = receipt as Record<string, unknown>;
    for (const key of ['logoURL', 'paymentQrURL']) {
      if (isOversizedDataUrl(r[key])) {
        return `Receipt ${key} image exceeds 1 MB. Use a smaller PNG or JPG.`;
      }
    }
  }

  return null;
}
