import * as XLSX from 'xlsx'
import { formatINR } from './currency'
import type { Category } from '@/services/categoryService'
import type { Product } from '@/types/product.types'
import { formatDisplayUnit } from '@/pages/products/components/ProductDetailModal'

export interface BusinessMetadata {
  businessName?: string
  businessAddress?: string
  businessPhone?: string
  businessGSTIN?: string
  businessLogoURL?: string
  storeName?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CATEGORIES DATA PREPARATION & EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryExportItem {
  id: string
  name: string
  parentId?: string | null
  parentName?: string
  isSubcategory: boolean
  productCount: number
  isActive: boolean
}

export function prepareCategoriesExportData(
  categories: Category[],
  products: Product[] = []
): { items: CategoryExportItem[]; topLevelCount: number; subCount: number; totalProducts: number } {
  const productCountMap = new Map<string, number>()

  products.forEach(p => {
    if (p.categoryId) {
      productCountMap.set(p.categoryId, (productCountMap.get(p.categoryId) || 0) + 1)
    }
  })

  const topLevel = categories.filter(c => !c.parentId)
  const childrenMap = new Map<string, Category[]>()

  categories.forEach(c => {
    if (c.parentId) {
      const arr = childrenMap.get(c.parentId) || []
      arr.push(c)
      childrenMap.set(c.parentId, arr)
    }
  })

  const items: CategoryExportItem[] = []
  let totalProductsCount = 0

  topLevel.forEach(parent => {
    const pCount = productCountMap.get(parent.id) || 0
    totalProductsCount += pCount
    items.push({
      id: parent.id,
      name: parent.name,
      parentId: null,
      parentName: '— Main Category —',
      isSubcategory: false,
      productCount: pCount,
      isActive: parent.isActive !== false,
    })

    const children = childrenMap.get(parent.id) || []
    children.forEach(child => {
      const cCount = productCountMap.get(child.id) || 0
      totalProductsCount += cCount
      items.push({
        id: child.id,
        name: child.name,
        parentId: parent.id,
        parentName: parent.name,
        isSubcategory: true,
        productCount: cCount,
        isActive: child.isActive !== false,
      })
    })
  })

  return {
    items,
    topLevelCount: topLevel.length,
    subCount: categories.length - topLevel.length,
    totalProducts: totalProductsCount,
  }
}

/**
 * Exports Categories & Subcategories into professional Excel Sheet
 */
export function exportCategoriesToExcel(
  categories: Category[],
  products: Product[] = [],
  meta: BusinessMetadata = {}
): void {
  const { items, topLevelCount, subCount, totalProducts } = prepareCategoriesExportData(categories, products)
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const headerRows = [
    [meta.businessName || 'SEZNIK ENTERPRISES'],
    [meta.storeName ? `Store Location: ${meta.storeName}` : 'All Locations / Stores'],
    [
      `GSTIN: ${meta.businessGSTIN || 'N/A'}`,
      `Phone: ${meta.businessPhone || 'N/A'}`,
      `Address: ${meta.businessAddress || 'N/A'}`,
    ],
    ['REPORT: CATEGORY & SUBCATEGORY DIRECTORY', `Export Date: ${today}`],
    [`Summary: ${topLevelCount} Categories, ${subCount} Subcategories, ${totalProducts} Total Products`],
    [], // Blank separator
    ['S.No', 'Category / Subcategory Name', 'Type', 'Parent Category', 'Products Count', 'Status'],
  ]

  const dataRows = items.map((item, index) => [
    index + 1,
    item.isSubcategory ? `   ↳ ${item.name}` : item.name,
    item.isSubcategory ? 'Subcategory' : 'Main Category',
    item.parentName,
    item.productCount,
    item.isActive ? 'Active' : 'Inactive',
  ])

  const totalsRow = [
    'TOTAL',
    `${items.length} Categories/Subcategories`,
    '',
    '',
    totalProducts,
    '',
  ]

  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows, [], totalsRow])

  ws['!cols'] = [
    { wch: 8 },  // S.No
    { wch: 36 }, // Name
    { wch: 18 }, // Type
    { wch: 28 }, // Parent
    { wch: 18 }, // Products Count
    { wch: 14 }, // Status
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Categories')
  const filename = `categories-directory-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * Builds HTML report for Categories PDF Print
 */
export function buildCategoriesHtmlReport(
  categories: Category[],
  products: Product[] = [],
  meta: BusinessMetadata = {}
): string {
  const { items, topLevelCount, subCount, totalProducts } = prepareCategoriesExportData(categories, products)
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const tableRows = items.map((item, index) => `
    <tr style="border-bottom: 1px solid #e2e8f0; background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 9px 12px; font-size: 11px; text-align: center; color: #64748b;">${index + 1}</td>
      <td style="padding: 9px 12px; font-size: 12px; font-weight: ${item.isSubcategory ? '500' : '700'}; color: ${item.isSubcategory ? '#475569' : '#0f172a'};">
        ${item.isSubcategory ? `<span style="color:#94a3b8; margin-right:4px;">↳</span>` : ''}
        ${item.name}
      </td>
      <td style="padding: 9px 12px; font-size: 11px; text-align: center;">
        <span style="display:inline-block; padding: 3px 8px; border-radius: 9999px; font-weight: 600; font-size: 10px; ${
          item.isSubcategory ? 'background: #ede9fe; color: #6d28d9;' : 'background: #e0f2fe; color: #0369a1;'
        }">
          ${item.isSubcategory ? 'Subcategory' : 'Main Category'}
        </span>
      </td>
      <td style="padding: 9px 12px; font-size: 11px; color: #64748b;">${item.parentName}</td>
      <td style="padding: 9px 12px; font-size: 12px; font-weight: 700; text-align: right; color: #0f172a;">${item.productCount}</td>
      <td style="padding: 9px 12px; font-size: 11px; text-align: center;">
        <span style="display:inline-block; padding: 3px 8px; border-radius: 9999px; font-weight: 600; font-size: 10px; ${
          item.isActive ? 'background: #dcfce7; color: #15803d;' : 'background: #fee2e2; color: #b91c1c;'
        }">
          ${item.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
    </tr>
  `).join('')

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; max-width: 100%; margin: 0 auto; background: #ffffff; padding: 24px; box-sizing: border-box;">
      <!-- Header Banner -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 16px;">
        <div>
          ${meta.businessLogoURL ? `<img src="${meta.businessLogoURL}" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 6px; display: block;" />` : ''}
          <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #1e3a8a;">${meta.businessName || 'SEZNIK ENTERPRISES'}</h1>
          ${meta.storeName ? `<div style="font-size: 13px; font-weight: 700; color: #4338ca; margin-top: 3px;">Store: ${meta.storeName}</div>` : ''}
          ${meta.businessAddress ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px;">${meta.businessAddress}</div>` : ''}
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
            ${meta.businessGSTIN ? `<strong>GSTIN:</strong> ${meta.businessGSTIN} &nbsp;·&nbsp; ` : ''}
            ${meta.businessPhone ? `<strong>Phone:</strong> ${meta.businessPhone}` : ''}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">CATEGORY DIRECTORY</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Generated: ${today} at ${time}</div>
          <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 6px; background: #eff6ff; padding: 4px 10px; border-radius: 6px; border: 1px solid #bfdbfe; display: inline-block;">
            ${topLevelCount} Categories · ${subCount} Subcategories · ${totalProducts} Products
          </div>
        </div>
      </div>

      <!-- Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 45px;">#</th>
            <th style="padding: 10px 12px; font-size: 11px; text-align: left;">Category Name</th>
            <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 120px;">Type</th>
            <th style="padding: 10px 12px; font-size: 11px; text-align: left; width: 180px;">Parent Category</th>
            <th style="padding: 10px 12px; font-size: 11px; text-align: right; width: 100px;">Products</th>
            <th style="padding: 10px 12px; font-size: 11px; text-align: center; width: 90px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #0f172a;">
            <td colspan="4" style="padding: 11px 12px; font-size: 12px;">TOTAL: ${items.length} DIRECTORY ITEMS</td>
            <td style="padding: 11px 12px; font-size: 12px; text-align: right;">${totalProducts} Items</td>
            <td style="padding: 11px 12px;"></td>
          </tr>
        </tfoot>
      </table>

      <!-- Footer -->
      <div style="margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
        <div>SEZNIK Inventory Management · Confidential Category Export</div>
        <div>Page 1 of 1</div>
      </div>
    </div>
  `
}

/**
 * Draws crisp Categories Report onto a Canvas element and triggers PNG download
 */
export function exportCategoriesToImage(
  categories: Category[],
  products: Product[] = [],
  meta: BusinessMetadata = {}
): void {
  const { items, topLevelCount, subCount, totalProducts } = prepareCategoriesExportData(categories, products)
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const width = 1250
  const rowHeight = 36
  const headerHeight = 170
  const tableHeaderHeight = 40
  const footerHeight = 70
  const height = headerHeight + tableHeaderHeight + items.length * rowHeight + footerHeight

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Top Accent Bar
  ctx.fillStyle = '#1e3a8a'
  ctx.fillRect(0, 0, width, 6)

  // Business Details Header
  const padX = 36
  let curY = 44

  ctx.fillStyle = '#1e3a8a'
  ctx.font = 'bold 22px Arial, sans-serif'
  ctx.fillText(meta.businessName || 'SEZNIK ENTERPRISES', padX, curY)

  curY += 24
  if (meta.storeName) {
    ctx.fillStyle = '#4338ca'
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.fillText(`Store Location: ${meta.storeName}`, padX, curY)
    curY += 20
  }

  ctx.fillStyle = '#64748b'
  ctx.font = '12px Arial, sans-serif'
  if (meta.businessAddress) {
    ctx.fillText(meta.businessAddress, padX, curY)
    curY += 18
  }

  const gstinText = meta.businessGSTIN ? `GSTIN: ${meta.businessGSTIN}` : ''
  const phoneText = meta.businessPhone ? `Phone: ${meta.businessPhone}` : ''
  const contactLine = [gstinText, phoneText].filter(Boolean).join('   |   ')
  if (contactLine) {
    ctx.fillText(contactLine, padX, curY)
  }

  // Right-aligned report header
  ctx.textAlign = 'right'
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 18px Arial, sans-serif'
  ctx.fillText('CATEGORY DIRECTORY', width - padX, 44)

  ctx.fillStyle = '#64748b'
  ctx.font = '12px Arial, sans-serif'
  ctx.fillText(`Generated: ${today} at ${time}`, width - padX, 68)

  ctx.fillStyle = '#eff6ff'
  ctx.fillRect(width - padX - 320, 84, 320, 30)
  ctx.strokeStyle = '#bfdbfe'
  ctx.strokeRect(width - padX - 320, 84, 320, 30)

  ctx.fillStyle = '#1e3a8a'
  ctx.font = 'bold 12px Arial, sans-serif'
  ctx.fillText(`${topLevelCount} Categories · ${subCount} Subcategories · ${totalProducts} Products`, width - padX - 10, 104)

  ctx.textAlign = 'left'

  // Divider
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padX, headerHeight - 10)
  ctx.lineTo(width - padX, headerHeight - 10)
  ctx.stroke()

  // Table Column Definitions
  const colX = {
    sno: padX,
    name: padX + 50,
    type: padX + 440,
    parent: padX + 620,
    products: width - padX - 140,
    status: width - padX - 50,
  }

  // Table Header
  const tableY = headerHeight
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(padX, tableY, width - padX * 2, tableHeaderHeight)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 12px Arial, sans-serif'
  ctx.fillText('#', colX.sno + 12, tableY + 25)
  ctx.fillText('Category / Subcategory Name', colX.name, tableY + 25)
  ctx.fillText('Type', colX.type, tableY + 25)
  ctx.fillText('Parent Category', colX.parent, tableY + 25)
  ctx.textAlign = 'right'
  ctx.fillText('Products', colX.products, tableY + 25)
  ctx.textAlign = 'center'
  ctx.fillText('Status', colX.status - 20, tableY + 25)
  ctx.textAlign = 'left'

  // Rows
  let rowY = tableY + tableHeaderHeight
  items.forEach((item, index) => {
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f8fafc'
    ctx.fillRect(padX, rowY, width - padX * 2, rowHeight)

    // S.No
    ctx.fillStyle = '#64748b'
    ctx.font = '11px Arial, sans-serif'
    ctx.fillText(String(index + 1), colX.sno + 14, rowY + 22)

    // Name
    ctx.fillStyle = item.isSubcategory ? '#475569' : '#0f172a'
    ctx.font = item.isSubcategory ? '12px Arial, sans-serif' : 'bold 12px Arial, sans-serif'
    const prefix = item.isSubcategory ? '    ↳ ' : ''
    ctx.fillText(prefix + item.name, colX.name, rowY + 22)

    // Type Badge
    ctx.fillStyle = item.isSubcategory ? '#6d28d9' : '#0369a1'
    ctx.font = 'bold 11px Arial, sans-serif'
    ctx.fillText(item.isSubcategory ? 'Subcategory' : 'Main Category', colX.type, rowY + 22)

    // Parent
    ctx.fillStyle = '#64748b'
    ctx.font = '11px Arial, sans-serif'
    ctx.fillText(item.parentName || '—', colX.parent, rowY + 22)

    // Products Count
    ctx.textAlign = 'right'
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 12px Arial, sans-serif'
    ctx.fillText(String(item.productCount), colX.products, rowY + 22)

    // Status
    ctx.textAlign = 'center'
    ctx.fillStyle = item.isActive ? '#15803d' : '#b91c1c'
    ctx.font = 'bold 11px Arial, sans-serif'
    ctx.fillText(item.isActive ? 'Active' : 'Inactive', colX.status - 20, rowY + 22)
    ctx.textAlign = 'left'

    // Bottom row border
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padX, rowY + rowHeight)
    ctx.lineTo(width - padX, rowY + rowHeight)
    ctx.stroke()

    rowY += rowHeight
  })

  // Totals Row
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(padX, rowY, width - padX * 2, 40)
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2
  ctx.strokeRect(padX, rowY, width - padX * 2, 40)

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 13px Arial, sans-serif'
  ctx.fillText(`TOTAL: ${items.length} DIRECTORY ITEMS`, colX.name, rowY + 25)

  ctx.textAlign = 'right'
  ctx.fillText(`${totalProducts} Products`, colX.products, rowY + 25)
  ctx.textAlign = 'left'

  // Footer
  ctx.fillStyle = '#94a3b8'
  ctx.font = '10px Arial, sans-serif'
  ctx.fillText('SEZNIK Inventory Management · Confidential Category Export', padX, height - 20)
  ctx.textAlign = 'right'
  ctx.fillText(`Exported on ${today}`, width - padX, height - 20)

  // Trigger Download
  downloadCanvas(canvas, `categories-directory-${new Date().toISOString().slice(0, 10)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PRODUCTS DATA PREPARATION & EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductExportRow {
  id: string
  name: string
  sku: string
  barcode?: string
  categoryName: string
  brand?: string
  unit: string
  costPrice: number
  sellingPrice: number
  taxRate: number
  priceIncludesGst?: boolean
  currentStock: number
  lowStockThreshold: number
  stockValue: number
  status: string
}

export function prepareProductsExportData(
  products: Product[],
  categories: Category[] = [],
  storeStockMap?: Map<string, { stock: number; priceOverride?: number | null }>
): {
  rows: ProductExportRow[]
  totalItems: number
  totalUnits: number
  totalStockValue: number
} {
  const catMap = new Map(categories.map(c => [c.id, c.name]))
  let totalUnits = 0
  let totalStockValue = 0

  const rows: ProductExportRow[] = products.map(p => {
    const storeEntry = storeStockMap?.get(p.id)
    const effectiveStock = storeEntry ? storeEntry.stock : p.currentStock
    const effectivePrice = (storeEntry?.priceOverride != null) ? storeEntry.priceOverride : p.sellingPrice
    const cost = p.costPrice || 0
    const stockVal = effectiveStock * (cost || effectivePrice)

    totalUnits += effectiveStock
    totalStockValue += stockVal

    const status = effectiveStock <= 0
      ? 'Out of Stock'
      : effectiveStock <= p.lowStockThreshold
      ? 'Low Stock'
      : 'In Stock'

    return {
      id: p.id,
      name: p.name,
      sku: p.sku || '—',
      barcode: p.barcode || '—',
      categoryName: catMap.get(p.categoryId) || 'Uncategorised',
      brand: p.brand || '—',
      unit: formatDisplayUnit(p.unit),
      costPrice: cost,
      sellingPrice: effectivePrice,
      taxRate: p.taxRate || 0,
      priceIncludesGst: p.priceIncludesGst,
      currentStock: effectiveStock,
      lowStockThreshold: p.lowStockThreshold || 0,
      stockValue: stockVal,
      status,
    }
  })

  return {
    rows,
    totalItems: rows.length,
    totalUnits,
    totalStockValue,
  }
}

/**
 * Exports Products Catalog & Stock Valuation to formatted Excel
 */
export function exportProductsToExcel(
  products: Product[],
  categories: Category[] = [],
  meta: BusinessMetadata = {},
  storeStockMap?: Map<string, { stock: number; priceOverride?: number | null }>
): void {
  const { rows, totalItems, totalUnits, totalStockValue } = prepareProductsExportData(products, categories, storeStockMap)
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const headerRows = [
    [meta.businessName || 'SEZNIK ENTERPRISES'],
    [meta.storeName ? `Store Location: ${meta.storeName}` : 'All Locations / Global Catalog'],
    [
      `GSTIN: ${meta.businessGSTIN || 'N/A'}`,
      `Phone: ${meta.businessPhone || 'N/A'}`,
      `Address: ${meta.businessAddress || 'N/A'}`,
    ],
    ['REPORT: PRODUCT CATALOG & INVENTORY VALUATION', `Export Date: ${today}`],
    [`Summary: ${totalItems} Products, ${totalUnits} Total Units, Total Valuation: ₹${totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    [], // Blank separator
    [
      'S.No',
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Brand',
      'Unit',
      'Cost Price (INR)',
      'Selling Price (INR)',
      'GST Slab (%)',
      'Tax Mode',
      'Current Stock',
      'Min Alert Qty',
      'Total Stock Value (INR)',
      'Stock Status',
    ],
  ]

  const dataRows = rows.map((r, index) => [
    index + 1,
    r.name,
    r.sku,
    r.barcode,
    r.categoryName,
    r.brand,
    r.unit,
    r.costPrice,
    r.sellingPrice,
    `${r.taxRate}%`,
    r.priceIncludesGst ? 'Incl. GST' : 'Excl. GST',
    r.currentStock,
    r.lowStockThreshold,
    r.stockValue,
    r.status,
  ])

  const totalsRow = [
    'TOTAL',
    `${totalItems} Products`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalUnits,
    '',
    totalStockValue,
    '',
  ]

  const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows, [], totalsRow])

  ws['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 32 }, // Name
    { wch: 18 }, // SKU
    { wch: 18 }, // Barcode
    { wch: 22 }, // Category
    { wch: 16 }, // Brand
    { wch: 8 },  // Unit
    { wch: 16 }, // Cost
    { wch: 18 }, // Selling
    { wch: 12 }, // GST
    { wch: 12 }, // Mode
    { wch: 14 }, // Stock
    { wch: 14 }, // Low Stock
    { wch: 22 }, // Valuation
    { wch: 14 }, // Status
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  const filename = `products-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * Builds HTML report for Products PDF Print
 */
export function buildProductsHtmlReport(
  products: Product[],
  categories: Category[] = [],
  meta: BusinessMetadata = {},
  storeStockMap?: Map<string, { stock: number; priceOverride?: number | null }>
): string {
  const { rows, totalItems, totalUnits, totalStockValue } = prepareProductsExportData(products, categories, storeStockMap)
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const tableRows = rows.map((r, index) => `
    <tr style="border-bottom: 1px solid #e2e8f0; background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 11px;">
      <td style="padding: 7px 8px; text-align: center; color: #64748b;">${index + 1}</td>
      <td style="padding: 7px 8px; font-weight: 700; color: #0f172a;">${r.name}</td>
      <td style="padding: 7px 8px; font-family: monospace; color: #334155;">${r.sku}</td>
      <td style="padding: 7px 8px; font-family: monospace; color: #64748b;">${r.barcode}</td>
      <td style="padding: 7px 8px; color: #475569;">${r.categoryName}</td>
      <td style="padding: 7px 8px; text-align: right; font-weight: 600;">${formatINR(r.sellingPrice)}</td>
      <td style="padding: 7px 8px; text-align: center;">${r.taxRate}%</td>
      <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: ${r.currentStock <= 0 ? '#dc2626' : r.currentStock <= r.lowStockThreshold ? '#d97706' : '#0f172a'};">
        ${r.currentStock} <span style="font-size:9px;color:#64748b;">${r.unit}</span>
      </td>
      <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: #2563eb;">${formatINR(r.stockValue)}</td>
      <td style="padding: 7px 8px; text-align: center;">
        <span style="display:inline-block; padding: 2px 6px; border-radius: 9999px; font-weight: 700; font-size: 9px; ${
          r.currentStock <= 0
            ? 'background:#fee2e2;color:#b91c1c;'
            : r.currentStock <= r.lowStockThreshold
            ? 'background:#fef3c7;color:#b45309;'
            : 'background:#dcfce7;color:#15803d;'
        }">
          ${r.status}
        </span>
      </td>
    </tr>
  `).join('')

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; max-width: 100%; margin: 0 auto; background: #ffffff; padding: 20px; box-sizing: border-box;">
      <!-- Header Banner -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 14px;">
        <div>
          ${meta.businessLogoURL ? `<img src="${meta.businessLogoURL}" style="max-height: 44px; max-width: 150px; object-fit: contain; margin-bottom: 4px; display: block;" />` : ''}
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #1e3a8a;">${meta.businessName || 'SEZNIK ENTERPRISES'}</h1>
          ${meta.storeName ? `<div style="font-size: 12px; font-weight: 700; color: #4338ca; margin-top: 2px;">Store: ${meta.storeName}</div>` : ''}
          ${meta.businessAddress ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${meta.businessAddress}</div>` : ''}
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            ${meta.businessGSTIN ? `<strong>GSTIN:</strong> ${meta.businessGSTIN} &nbsp;·&nbsp; ` : ''}
            ${meta.businessPhone ? `<strong>Phone:</strong> ${meta.businessPhone}` : ''}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: 900; color: #0f172a;">PRODUCT CATALOG &amp; INVENTORY REPORT</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Date: ${today} at ${time}</div>
          <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 5px; background: #eff6ff; padding: 4px 8px; border-radius: 4px; border: 1px solid #bfdbfe; display: inline-block;">
            ${totalItems} Items &nbsp;|&nbsp; ${totalUnits} Units &nbsp;|&nbsp; Total Valuation: ${formatINR(totalStockValue)}
          </div>
        </div>
      </div>

      <!-- Table -->
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; font-size: 10px; text-transform: uppercase;">
            <th style="padding: 8px 8px; text-align: center; width: 30px;">#</th>
            <th style="padding: 8px 8px; text-align: left;">Product Name</th>
            <th style="padding: 8px 8px; text-align: left; width: 85px;">SKU</th>
            <th style="padding: 8px 8px; text-align: left; width: 90px;">Barcode</th>
            <th style="padding: 8px 8px; text-align: left; width: 120px;">Category</th>
            <th style="padding: 8px 8px; text-align: right; width: 80px;">Price</th>
            <th style="padding: 8px 8px; text-align: center; width: 45px;">GST</th>
            <th style="padding: 8px 8px; text-align: right; width: 75px;">Stock</th>
            <th style="padding: 8px 8px; text-align: right; width: 95px;">Valuation</th>
            <th style="padding: 8px 8px; text-align: center; width: 80px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800; font-size: 11px; border-top: 2px solid #0f172a;">
            <td colspan="7" style="padding: 10px; text-align: right;">GRAND TOTALS:</td>
            <td style="padding: 10px; text-align: right;">${totalUnits} Units</td>
            <td style="padding: 10px; text-align: right; color: #2563eb;">${formatINR(totalStockValue)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <!-- Footer -->
      <div style="margin-top: 20px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
        <div>Generated via SEZNIK Cloud Inventory Manager</div>
        <div>Page 1 of 1</div>
      </div>
    </div>
  `
}

/**
 * Draws crisp Products Catalog Report onto a Canvas element and triggers PNG download
 */
export function exportProductsToImage(
  products: Product[],
  categories: Category[] = [],
  meta: BusinessMetadata = {},
  storeStockMap?: Map<string, { stock: number; priceOverride?: number | null }>
): void {
  const { rows, totalItems, totalUnits, totalStockValue } = prepareProductsExportData(products, categories, storeStockMap)
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const width = 1500
  const rowHeight = 34
  const headerHeight = 160
  const tableHeaderHeight = 38
  const footerHeight = 60
  const height = headerHeight + tableHeaderHeight + rows.length * rowHeight + footerHeight

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Top Accent Bar
  ctx.fillStyle = '#1e3a8a'
  ctx.fillRect(0, 0, width, 6)

  // Business Details Header
  const padX = 30
  let curY = 40

  ctx.fillStyle = '#1e3a8a'
  ctx.font = 'bold 22px Arial, sans-serif'
  ctx.fillText(meta.businessName || 'SEZNIK ENTERPRISES', padX, curY)

  curY += 22
  if (meta.storeName) {
    ctx.fillStyle = '#4338ca'
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.fillText(`Store Location: ${meta.storeName}`, padX, curY)
    curY += 18
  }

  ctx.fillStyle = '#64748b'
  ctx.font = '11px Arial, sans-serif'
  if (meta.businessAddress) {
    ctx.fillText(meta.businessAddress, padX, curY)
    curY += 16
  }

  const gstinText = meta.businessGSTIN ? `GSTIN: ${meta.businessGSTIN}` : ''
  const phoneText = meta.businessPhone ? `Phone: ${meta.businessPhone}` : ''
  const contactLine = [gstinText, phoneText].filter(Boolean).join('   |   ')
  if (contactLine) {
    ctx.fillText(contactLine, padX, curY)
  }

  // Right-aligned report header
  ctx.textAlign = 'right'
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 17px Arial, sans-serif'
  ctx.fillText('PRODUCT CATALOG & INVENTORY VALUATION', width - padX, 40)

  ctx.fillStyle = '#64748b'
  ctx.font = '11px Arial, sans-serif'
  ctx.fillText(`Generated: ${today} at ${time}`, width - padX, 60)

  ctx.fillStyle = '#eff6ff'
  ctx.fillRect(width - padX - 440, 74, 440, 30)
  ctx.strokeStyle = '#bfdbfe'
  ctx.strokeRect(width - padX - 440, 74, 440, 30)

  ctx.fillStyle = '#1e3a8a'
  ctx.font = 'bold 12px Arial, sans-serif'
  ctx.fillText(`${totalItems} Items   |   ${totalUnits} Units   |   Valuation: ${formatINR(totalStockValue)}`, width - padX - 10, 94)

  ctx.textAlign = 'left'

  // Divider
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padX, headerHeight - 8)
  ctx.lineTo(width - padX, headerHeight - 8)
  ctx.stroke()

  // Columns X coordinates
  const colX = {
    sno: padX,
    name: padX + 45,
    sku: padX + 410,
    barcode: padX + 540,
    category: padX + 680,
    price: padX + 880,
    gst: padX + 980,
    stock: padX + 1100,
    valuation: width - padX - 130,
    status: width - padX - 40,
  }

  // Table Header
  const tableY = headerHeight
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(padX, tableY, width - padX * 2, tableHeaderHeight)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 11px Arial, sans-serif'
  ctx.fillText('#', colX.sno + 10, tableY + 24)
  ctx.fillText('Product Name', colX.name, tableY + 24)
  ctx.fillText('SKU', colX.sku, tableY + 24)
  ctx.fillText('Barcode', colX.barcode, tableY + 24)
  ctx.fillText('Category', colX.category, tableY + 24)
  ctx.textAlign = 'right'
  ctx.fillText('Price', colX.price, tableY + 24)
  ctx.textAlign = 'center'
  ctx.fillText('GST', colX.gst, tableY + 24)
  ctx.textAlign = 'right'
  ctx.fillText('Stock', colX.stock, tableY + 24)
  ctx.fillText('Valuation', colX.valuation, tableY + 24)
  ctx.textAlign = 'center'
  ctx.fillText('Status', colX.status - 15, tableY + 24)
  ctx.textAlign = 'left'

  // Rows
  let rowY = tableY + tableHeaderHeight
  rows.forEach((r, index) => {
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f8fafc'
    ctx.fillRect(padX, rowY, width - padX * 2, rowHeight)

    // S.No
    ctx.fillStyle = '#64748b'
    ctx.font = '10px Arial, sans-serif'
    ctx.fillText(String(index + 1), colX.sno + 10, rowY + 21)

    // Name (truncated if too long)
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 11px Arial, sans-serif'
    const truncatedName = r.name.length > 40 ? r.name.slice(0, 38) + '...' : r.name
    ctx.fillText(truncatedName, colX.name, rowY + 21)

    // SKU & Barcode
    ctx.fillStyle = '#334155'
    ctx.font = '10px monospace'
    ctx.fillText(r.sku, colX.sku, rowY + 21)
    ctx.fillStyle = '#64748b'
    ctx.fillText(r.barcode || '—', colX.barcode, rowY + 21)

    // Category
    ctx.fillStyle = '#475569'
    ctx.font = '11px Arial, sans-serif'
    ctx.fillText(r.categoryName, colX.category, rowY + 21)

    // Price
    ctx.textAlign = 'right'
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 11px Arial, sans-serif'
    ctx.fillText(formatINR(r.sellingPrice), colX.price, rowY + 21)

    // GST
    ctx.textAlign = 'center'
    ctx.fillStyle = '#64748b'
    ctx.font = '11px Arial, sans-serif'
    ctx.fillText(`${r.taxRate}%`, colX.gst, rowY + 21)

    // Stock
    ctx.textAlign = 'right'
    ctx.fillStyle = r.currentStock <= 0 ? '#dc2626' : r.currentStock <= r.lowStockThreshold ? '#d97706' : '#0f172a'
    ctx.font = 'bold 11px Arial, sans-serif'
    ctx.fillText(`${r.currentStock} ${r.unit}`, colX.stock, rowY + 21)

    // Valuation
    ctx.fillStyle = '#2563eb'
    ctx.font = 'bold 11px Arial, sans-serif'
    ctx.fillText(formatINR(r.stockValue), colX.valuation, rowY + 21)

    // Status Pill
    ctx.textAlign = 'center'
    ctx.fillStyle = r.currentStock <= 0 ? '#b91c1c' : r.currentStock <= r.lowStockThreshold ? '#b45309' : '#15803d'
    ctx.font = 'bold 10px Arial, sans-serif'
    ctx.fillText(r.status, colX.status - 15, rowY + 21)
    ctx.textAlign = 'left'

    // Gridline
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padX, rowY + rowHeight)
    ctx.lineTo(width - padX, rowY + rowHeight)
    ctx.stroke()

    rowY += rowHeight
  })

  // Totals Row
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(padX, rowY, width - padX * 2, 38)
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2
  ctx.strokeRect(padX, rowY, width - padX * 2, 38)

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 12px Arial, sans-serif'
  ctx.fillText(`TOTAL: ${rows.length} PRODUCTS`, colX.name, rowY + 24)

  ctx.textAlign = 'right'
  ctx.fillText(`${totalUnits} Total Units`, colX.stock, rowY + 24)
  ctx.fillStyle = '#2563eb'
  ctx.fillText(formatINR(totalStockValue), colX.valuation, rowY + 24)
  ctx.textAlign = 'left'

  // Footer
  ctx.fillStyle = '#94a3b8'
  ctx.font = '10px Arial, sans-serif'
  ctx.fillText('Generated by SEZNIK Cloud Inventory Manager', padX, height - 16)
  ctx.textAlign = 'right'
  ctx.fillText(`Exported on ${today}`, width - padX, height - 16)

  // Download
  downloadCanvas(canvas, `products-catalog-${new Date().toISOString().slice(0, 10)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PRINT / PDF TRIGGER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggers clean browser print-to-PDF window with action toolbar
 */
export function triggerPrintReport(htmlContent: string, title = 'Report'): void {
  const printWindow = window.open('', '_blank', 'width=1150,height=850,menubar=no,toolbar=no,location=no,status=no')

  if (printWindow) {
    printWindow.document.open()
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          @media print {
            .no-print { display: none !important; }
            html, body { width: 100%; margin: 0; padding: 0; background: #ffffff !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #f1f5f9;
            color: #0f172a;
          }
          .print-toolbar {
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            background: #0f172a;
            color: #ffffff;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
            z-index: 9999;
          }
          .print-btn {
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 9px 20px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .print-btn:hover { background: #1d4ed8; }
          .close-btn {
            background: #334155;
            color: #ffffff;
            border: none;
            padding: 9px 16px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
          }
          .close-btn:hover { background: #475569; }
          .report-wrapper {
            max-width: 1100px;
            margin: 24px auto;
            background: #ffffff;
            padding: 24px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.08);
            border-radius: 8px;
          }
          @media print {
            .report-wrapper {
              margin: 0;
              padding: 0;
              box-shadow: none;
              border-radius: 0;
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar no-print">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: 800; font-size: 15px;">📄 ${title}</span>
            <span style="font-size: 12px; color: #94a3b8;">(Select "Save as PDF" under Destination to download as PDF)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
            <button class="close-btn" onclick="window.close()">✕ Close</button>
          </div>
        </div>
        <div class="report-wrapper">
          ${htmlContent}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
    return
  }

  // Fallback if popup blocker was triggered
  const printDiv = document.createElement('div')
  printDiv.id = 'inline-print-report'
  printDiv.innerHTML = `
    <style>
      @media print {
        body > *:not(#inline-print-report) { display: none !important; }
        #inline-print-report { display: block !important; width: 100%; }
        @page { size: A4 landscape; margin: 8mm; }
      }
    </style>
    ${htmlContent}
  `
  document.body.appendChild(printDiv)
  window.print()
  setTimeout(() => printDiv.remove(), 1000)
}

/**
 * Downloads a canvas element as PNG file
 */
function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }, 'image/png')
}
