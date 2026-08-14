// Shared option lists for product forms — used by the full Products page form
// and the lighter-weight quick-edit form surfaced from POS ("Scan to Bill").

export type UnitType = 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box'

export const UNIT_OPTIONS: { value: UnitType; label: string }[] = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kg' },
  { value: 'gram', label: 'Gram' },
  { value: 'liter', label: 'Liter' },
  { value: 'meter', label: 'Meter' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'box', label: 'Box' },
]

// Standard Indian GST slabs, plus a custom escape hatch for anything unusual.
export const GST_SLAB_OPTIONS = [
  { value: '0', label: '0% — Exempt' },
  { value: '3', label: '3% — Gold, precious stones' },
  { value: '5', label: '5% — Essentials' },
  { value: '12', label: '12% — Standard' },
  { value: '18', label: '18% — Standard' },
  { value: '28', label: '28% — Luxury' },
  { value: 'custom', label: 'Custom rate…' },
]
