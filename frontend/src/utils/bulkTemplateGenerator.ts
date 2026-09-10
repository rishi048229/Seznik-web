import * as XLSX from 'xlsx'

export const UNIT_INDEX_MAP: Record<string, 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box'> = {
  '1': 'piece',
  'piece': 'piece',
  'pcs': 'piece',
  'pc': 'piece',
  'nos': 'piece',
  'unit': 'piece',
  'units': 'piece',
  '2': 'kg',
  'kg': 'kg',
  'kgs': 'kg',
  'kilo': 'kg',
  'kilogram': 'kg',
  '3': 'gram',
  'gram': 'gram',
  'gm': 'gram',
  'gms': 'gram',
  'g': 'gram',
  '4': 'liter',
  'litre': 'liter',
  'liter': 'liter',
  'ltr': 'liter',
  'l': 'liter',
  '5': 'meter',
  'metre': 'meter',
  'meter': 'meter',
  'mtr': 'meter',
  'm': 'meter',
  '6': 'dozen',
  'doz': 'dozen',
  'dozen': 'dozen',
  'dz': 'dozen',
  '7': 'box',
  'box': 'box',
  'bx': 'box',
  'pkt': 'box',
  'packet': 'box',
}

export function normalizeUnit(raw: string | number | undefined | null): 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box' {
  if (raw === undefined || raw === null) return 'piece'
  const trimmed = String(raw).trim().toLowerCase()
  if (!trimmed) return 'piece'
  return UNIT_INDEX_MAP[trimmed] || 'piece'
}

export function downloadBulkUploadTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const headers = [
    'Product Name*',
    'Category*',
    'Cost Price*',
    'Selling Price*',
    'Stock Quantity*',
    'Unit*',
    'Barcode (Optional)',
    'Tax Rate % (Optional)',
    'Min Stock Alert (Optional)',
    'Brand (Optional)',
    'Description (Optional)',
  ]

  const sampleRows = [
    [
      'Parle-G Gold 100g',
      'Snacks & Biscuits',
      18.00,
      22.50,
      100,
      'piece',
      '8901030383451',
      5,
      10,
      'Parle',
      'Glucose Biscuits 100g Pack',
    ],
    [
      'Amul Butter 500g',
      'Dairy & Breakfast',
      185.00,
      212.00,
      30,
      'piece',
      '8901262010051',
      12,
      5,
      'Amul',
      'Pasteurised Salted Butter',
    ],
    [
      'Basmati Rice Classic 1kg',
      'Staples & Grains',
      95.00,
      120.00,
      50,
      'kg',
      '', // empty to demonstrate auto barcode generation
      0,
      0, // min stock empty or 0
      'India Gate',
      'Aged Long Grain Basmati Rice',
    ],
    [
      'Ariel Matic Detergent Powder 2kg',
      'Household',
      280.00,
      328.00,
      20,
      'box',
      '789100000133',
      18,
      0,
      'Ariel',
      'Front Load Laundry Detergent',
    ],
    [
      'Fresh Cow Milk 1L',
      'Dairy & Breakfast',
      54.00,
      62.00,
      40,
      'liter',
      '', // empty barcode
      0,
      0,
      'Mother Dairy',
      'Pasteurized Milk Pouch',
    ],
  ]

  const wb = XLSX.utils.book_new()

  // Sheet 1: Products
  const wsData = [headers, ...sampleRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Auto-size column widths
  ws['!cols'] = [
    { wch: 32 }, // Product Name*
    { wch: 22 }, // Category*
    { wch: 14 }, // Cost Price*
    { wch: 14 }, // Selling Price*
    { wch: 16 }, // Stock Quantity*
    { wch: 16 }, // Unit*
    { wch: 22 }, // Barcode (Optional)
    { wch: 20 }, // Tax Rate % (Optional)
    { wch: 24 }, // Min Stock Alert (Optional)
    { wch: 18 }, // Brand (Optional)
    { wch: 35 }, // Description (Optional)
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Products')

  // Sheet 2: Unit Reference Guide (For XLSX)
  if (format === 'xlsx') {
    const unitGuideHeaders = ['Index', 'Unit Code', 'Unit Name', 'Accepted Values / Aliases']
    const unitGuideRows = [
      [1, 'piece', 'Piece / Unit / Item', 'piece, pcs, pc, nos, unit, 1'],
      [2, 'kg', 'Kilogram', 'kg, kgs, kilo, kilogram, 2'],
      [3, 'gram', 'Gram', 'gram, gm, gms, g, 3'],
      [4, 'liter', 'Liter / Litre', 'liter, litre, ltr, l, 4'],
      [5, 'meter', 'Meter / Metre', 'meter, metre, mtr, m, 5'],
      [6, 'dozen', 'Dozen (12 pcs)', 'dozen, doz, dz, 6'],
      [7, 'box', 'Box / Pack', 'box, bx, pkt, packet, 7'],
    ]
    const wsGuide = XLSX.utils.aoa_to_sheet([unitGuideHeaders, ...unitGuideRows])
    wsGuide['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 24 }, { wch: 36 }]
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Unit_Index_Guide')
  }

  const fileName = `seznik_bulk_products_template.${format}`
  XLSX.writeFile(wb, fileName)
}
