import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'

export const UNIT_OPTIONS: Array<{
  id: number
  key: 'piece' | 'kg' | 'gram' | 'liter' | 'meter' | 'dozen' | 'box'
  label: string
  aliases: string[]
}> = [
  { id: 1, key: 'piece', label: 'Piece / Unit (pcs)', aliases: ['piece', 'pcs', 'pc', 'nos', 'unit', 'units', '1'] },
  { id: 2, key: 'kg', label: 'Kilogram (kg)', aliases: ['kg', 'kgs', 'kilo', 'kilogram', '2'] },
  { id: 3, key: 'gram', label: 'Gram (g)', aliases: ['gram', 'gm', 'gms', 'g', '3'] },
  { id: 4, key: 'liter', label: 'Liter (L)', aliases: ['liter', 'litre', 'ltr', 'l', '4'] },
  { id: 5, key: 'meter', label: 'Meter (m)', aliases: ['meter', 'metre', 'mtr', 'm', '5'] },
  { id: 6, key: 'dozen', label: 'Dozen (12 pcs)', aliases: ['dozen', 'doz', 'dz', '6'] },
  { id: 7, key: 'box', label: 'Box / Pack (box)', aliases: ['box', 'bx', 'pkt', 'packet', '7'] },
]

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
  'dozen': 'dozen',
  'doz': 'dozen',
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

export async function downloadBulkUploadTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
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
      0, // min stock default 0
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

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Seznik Inventory'
    workbook.lastModifiedBy = 'Seznik'
    workbook.created = new Date()
    workbook.modified = new Date()

    // Sheet 1: Products
    const wsProducts = workbook.addWorksheet('Products', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    })

    wsProducts.columns = [
      { header: headers[0], key: 'name', width: 32 },
      { header: headers[1], key: 'category', width: 22 },
      { header: headers[2], key: 'cost_price', width: 14 },
      { header: headers[3], key: 'selling_price', width: 14 },
      { header: headers[4], key: 'stock_quantity', width: 16 },
      { header: headers[5], key: 'unit', width: 16 },
      { header: headers[6], key: 'barcode', width: 22 },
      { header: headers[7], key: 'tax_rate', width: 20 },
      { header: headers[8], key: 'min_stock', width: 24 },
      { header: headers[9], key: 'brand', width: 18 },
      { header: headers[10], key: 'description', width: 36 },
    ]

    // Style Header Row
    const headerRow = wsProducts.getRow(1)
    headerRow.height = 30
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }, // Premium Indigo-Blue
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1D4ED8' } },
        left: { style: 'thin', color: { argb: 'FF1D4ED8' } },
        bottom: { style: 'medium', color: { argb: 'FF1E40AF' } },
        right: { style: 'thin', color: { argb: 'FF1D4ED8' } },
      }
    })

    // Add Sample Rows
    sampleRows.forEach((rowValues) => {
      const row = wsProducts.addRow(rowValues)
      row.height = 22
      row.alignment = { vertical: 'middle' }
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
        // Center align Unit and numbers
        if ([3, 4, 5, 6, 8, 9].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        }
      })
    })

    // Add note to Cell A2 explaining that rows 2-6 are demo items
    wsProducts.getCell('A2').note = 'DEMO SAMPLE PRODUCT: Please delete rows 2 to 6 (or overwrite with your own items) before uploading to Seznik.'

    // Sheet 2: Unit Reference Guide
    const wsGuide = workbook.addWorksheet('Unit_Reference', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    })

    wsGuide.columns = [
      { header: 'Dropdown Unit', key: 'unit', width: 18 },
      { header: 'Numeric Code', key: 'code', width: 14 },
      { header: 'Unit Name / Description', key: 'name', width: 28 },
      { header: 'Accepted Alternative Aliases', key: 'aliases', width: 36 },
    ]

    const guideHeader = wsGuide.getRow(1)
    guideHeader.height = 28
    guideHeader.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF475569' }, // Slate gray
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    UNIT_OPTIONS.forEach((opt) => {
      const r = wsGuide.addRow([opt.key, opt.id, opt.label, opt.aliases.join(', ')])
      r.height = 20
      r.alignment = { vertical: 'middle' }
      r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
      r.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' }
    })

    // Add Instructions Block
    wsGuide.addRow([])
    const noteHeader = wsGuide.addRow(['⚠️ IMPORTANT: HOW TO USE THIS TEMPLATE & REMOVE SAMPLE PRODUCTS'])
    noteHeader.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFDC2626' } }
    wsGuide.addRow(['1. The "Products" sheet contains 5 sample demo products (rows 2 to 6) to illustrate column values.'])
    wsGuide.addRow(['2. REMOVE SAMPLE ROWS: Select rows 2 through 6, right-click, and click "Delete" (or replace with your own items) before uploading to Seznik.'])
    wsGuide.addRow(['3. For Unit: Click any cell in Column F to choose from the native dropdown list (piece, kg, gram, liter, meter, dozen, box).'])

    // Native Excel Data Validation Dropdown on Column F (Unit) for rows 2 to 3000
    // Using reference list from Unit_Reference sheet and inline fallback
    ;(wsProducts as unknown as { dataValidations: { add: (range: string, opts: unknown) => void } }).dataValidations.add('F2:F3000', {
      type: 'list',
      allowBlank: false,
      formulae: ['"piece,kg,gram,liter,meter,dozen,box"'],
      showErrorMessage: true,
      errorTitle: 'Invalid Unit',
      error: 'Please select a unit from the dropdown list (piece, kg, gram, liter, meter, dozen, box).',
      showInputMessage: true,
      promptTitle: 'Unit Selection',
      prompt: 'Click the arrow to select: piece, kg, gram, liter, meter, dozen, or box.',
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'seznik_bulk_products_template.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } else {
    // CSV export
    const wb = XLSX.utils.book_new()
    const wsData = [headers, ...sampleRows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    XLSX.writeFile(wb, 'seznik_bulk_products_template.csv')
  }
}
