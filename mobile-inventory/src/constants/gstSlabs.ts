/** Standard GST rate slabs as notified under the CGST Act (India). */
export interface GstSlabOption {
  rate: string;
  label: string;
  description: string;
}

export const GST_SLAB_OPTIONS: GstSlabOption[] = [
  { rate: '0', label: '0% — Nil Rated / Exempt', description: 'Essential unprocessed items, fresh produce' },
  { rate: '3', label: '3% — Gold & Precious Metals', description: 'Gold, silver, precious stones' },
  { rate: '5', label: '5% — Reduced Rate', description: 'Essential goods, packaged food, medicines' },
  { rate: '12', label: '12% — Standard Rate', description: 'Processed foods, business services' },
  { rate: '18', label: '18% — Standard Rate', description: 'Most goods and services' },
  { rate: '28', label: '28% — Highest Rate', description: 'Luxury goods, demerit items' },
];

export const GST_CUSTOM_OPTION = { rate: 'custom', label: 'Custom Rate', description: 'Non-standard notified rate' };

export function getGstSlabLabel(rate: number | string): string {
  const rateStr = String(rate);
  const match = GST_SLAB_OPTIONS.find((s) => s.rate === rateStr);
  if (match) return match.label;
  return `${rateStr}% — Custom Rate`;
}

export function isStandardGstSlab(rate: number | string): boolean {
  return GST_SLAB_OPTIONS.some((s) => s.rate === String(rate));
}
