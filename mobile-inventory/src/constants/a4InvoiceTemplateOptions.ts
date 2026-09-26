/** Minimal A4 template catalog — ids must match web `a4InvoiceTemplates.ts`. */
export type A4TemplateId =
  | 'retail'
  | 'grocery'
  | 'pharmacy'
  | 'restaurant'
  | 'hotel'
  | 'salon'
  | 'garment'
  | 'hardware'
  | 'wholesale'
  | 'electronics'
  | 'clinic'
  | 'electrician'
  | 'contractor'
  | 'automotive'
  | 'services';

export const A4_INVOICE_TEMPLATE_OPTIONS: Array<{ id: A4TemplateId; name: string; category: string }> = [
  { id: 'retail', name: 'Retail / Kirana', category: 'Shop' },
  { id: 'grocery', name: 'Grocery / Supermarket', category: 'Shop' },
  { id: 'pharmacy', name: 'Pharmacy / Medical', category: 'Healthcare' },
  { id: 'restaurant', name: 'Restaurant / Café', category: 'Food' },
  { id: 'hotel', name: 'Hotel / Lodging', category: 'Hospitality' },
  { id: 'salon', name: 'Salon / Spa', category: 'Services' },
  { id: 'garment', name: 'Garments / Boutique', category: 'Retail' },
  { id: 'hardware', name: 'Hardware / Tools', category: 'Trade' },
  { id: 'wholesale', name: 'Wholesale / Distributor', category: 'B2B' },
  { id: 'electronics', name: 'Electronics / Mobile', category: 'Retail' },
  { id: 'clinic', name: 'Clinic / Diagnostics', category: 'Healthcare' },
  { id: 'electrician', name: 'Electrician / Plumbing', category: 'Trade' },
  { id: 'contractor', name: 'Contractor / Builder', category: 'Trade' },
  { id: 'automotive', name: 'Automotive / Garage', category: 'Trade' },
  { id: 'services', name: 'Professional Services', category: 'Services' },
];

export const A4_COLOR_THEMES = [
  { id: 'navy', label: 'Navy' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'slate', label: 'Slate' },
  { id: 'royal', label: 'Royal' },
  { id: 'rose', label: 'Rose' },
  { id: 'amber', label: 'Amber' },
  { id: 'teal', label: 'Teal' },
  { id: 'wine', label: 'Wine' },
] as const;
