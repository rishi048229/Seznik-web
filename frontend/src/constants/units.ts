export const PRODUCT_UNITS = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'gram', label: 'Gram (g)' },
  { value: 'liter', label: 'Liter (L)' },
  { value: 'meter', label: 'Meter (m)' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'box', label: 'Box' },
] as const

export type ProductUnit = typeof PRODUCT_UNITS[number]['value']
