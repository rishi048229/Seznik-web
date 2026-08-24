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
// 1. CATEGORIES EXPORT
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
  const categoryMap = new Map(categories.map(c => [c.id, c]))
  const productCountMap = new Map<string, number>()

  products.forEach(p => {
    if (p.categoryId) {
      productCountMap.set(p.categoryId, (productCountMap.get(p.categoryId) || 0) + 1)
    }
  })

  // Separate top-level and subcategories, and order children directly under their parents
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
 * Exports Categories & Subcategories into professional Excel Sheet with store & business headers
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

  // Configure column widths
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
      <td style="padding: 8px 12px; font-size: 11px; text-align: center; color: #64748b;">${index + 1}</td>
      <td style="padding: 8px 12px; font-size: 12px; font-weight: ${item.isSubcategory ? '500' : '700'}; color: ${item.isSubcategory ? '#475569' : '#0f172a'};">
        ${item.isSubcategory ? `<span style="color:#94a3b8; margin-right:4px;">↳</span>` : ''}
        ${item.name}
      </td>
      <td style="padding: 8px 12px; font-size: 11px; text-align: center;">
        <span style="display:inline-block; padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 10px; ${
          item.isSubcategory ? 'background: #ede9fe; color: #6d28d9;' : 'background: #e0f2fe; color: #0369a1;'
        }">
          ${item.isSubcategory ? 'Subcategory' : 'Main Category'}
        </span>
      </td>
      <td style="padding: 8px 12px; font-size: 11px; color: #64748b;">${item.parentName}</td>
      <td style="padding: 8px 12px; font-size: 12px; font-weight: 700; text-align: right; color: #0f172a;">${item.productCount}</td>
      <td style="padding: 8px 12px; font-size: 11px; text-align: center;">
        <span style="display:inline-block; padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 10px; ${
          item.isActive ? 'background: #dcfce7; color: #15803d;' : 'background: #fee2e2; color: #b91c1c;'
        }">
          ${item.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
    </tr>
  `).join('')

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 100%; margin: 0 auto; background: #ffffff; padding: 24px; box-sizing: border-box;">
      <!-- Header Banner -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 16px;">
        <div>
          ${meta.businessLogoURL ? `<img src="${meta.businessLogoURL}" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 6px; display: block;" />` : ''}
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #1e3a8a;">${meta.businessName || 'SEZNIK ENTERPRISES'}</h1>
          ${meta.storeName ? `<div style="font-size: 12px; font-weight: 700; color: #4338ca; margin-top: 2px;">Store: ${meta.storeName}</div>` : ''}
          ${meta.businessAddress ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${meta.businessAddress}</div>` : ''}
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            ${meta.businessGSTIN ? `<strong>GSTIN:</strong> ${meta.businessGSTIN} &nbsp;·&nbsp; ` : ''}
            ${meta.businessPhone ? `<strong>Phone:</strong> ${meta.businessPhone}` : ''}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">CATEGORY DIRECTORY</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Generated: ${today} at ${time}</div>
          <div style="font-size: 11px; font-weight: 600; color: #1e293b; margin-top: 4px; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; display: inline-block;">
            ${topLevelCount} Categories · ${subCount} Subcategories
          </div>
        </div>
      </div>

      <!-- Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="padding: 8px 12px; font-size: 11px; text-align: center; width: 40px;">#</th>
            <th style="padding: 8px 12px; font-size: 11px; text-align: left;">Category Name</th>
            <th style="padding: 8px 12px; font-size: 11px; text-align: center; width: 110px;">Type</th>
            <th style="padding: 8px 12px; font-size: 11px; text-align: left; width: 150px;">Parent Category</th>
            <th style="padding: 8px 12px; font-size: 11px; text-align: right; width: 100px;">Products</th>
            <th style="padding: 8px 12px; font-size: 11px; text-align: center; width: 80px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #0f172a;">
            <td colspan="4" style="padding: 10px 12px; font-size: 12px;">TOTAL SUMMARY: ${items.length} DIRECTORY ITEMS</td>
            <td style="padding: 10px 12px; font-size: 12px; text-align: right;">${totalProducts} Items</td>
            <td style="padding: 10px 12px;"></td>
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. PRODUCTS EXPORT
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
      <td style="padding: 6px 8px; text-align: center; color: #64748b;">${index + 1}</td>
      <td style="padding: 6px 8px; font-weight: 700; color: #0f172a;">${r.name}</td>
      <td style="padding: 6px 8px; font-family: monospace; color: #334155;">${r.sku}</td>
      <td style="padding: 6px 8px; font-family: monospace; color: #64748b;">${r.barcode}</td>
      <td style="padding: 6px 8px; color: #475569;">${r.categoryName}</td>
      <td style="padding: 6px 8px; text-align: right; font-weight: 600;">${formatINR(r.sellingPrice)}</td>
      <td style="padding: 6px 8px; text-align: center;">${r.taxRate}%</td>
      <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: ${r.currentStock <= 0 ? '#dc2626' : r.currentStock <= r.lowStockThreshold ? '#d97706' : '#0f172a'};">
        ${r.currentStock} <span style="font-size:9px;color:#64748b;">${r.unit}</span>
      </td>
      <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #2563eb;">${formatINR(r.stockValue)}</td>
      <td style="padding: 6px 8px; text-align: center;">
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
    <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 100%; margin: 0 auto; background: #ffffff; padding: 20px; box-sizing: border-box;">
      <!-- Header Banner -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 14px;">
        <div>
          ${meta.businessLogoURL ? `<img src="${meta.businessLogoURL}" style="max-height: 44px; max-width: 150px; object-fit: contain; margin-bottom: 4px; display: block;" />` : ''}
          <h1 style="margin: 0; font-size: 18px; font-weight: 900; color: #1e3a8a;">${meta.businessName || 'SEZNIK ENTERPRISES'}</h1>
          ${meta.storeName ? `<div style="font-size: 11px; font-weight: 700; color: #4338ca; margin-top: 1px;">Store: ${meta.storeName}</div>` : ''}
          ${meta.businessAddress ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">${meta.businessAddress}</div>` : ''}
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
            ${meta.businessGSTIN ? `<strong>GSTIN:</strong> ${meta.businessGSTIN} &nbsp;·&nbsp; ` : ''}
            ${meta.businessPhone ? `<strong>Phone:</strong> ${meta.businessPhone}` : ''}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 15px; font-weight: 900; color: #0f172a;">PRODUCT CATALOG &amp; INVENTORY REPORT</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Date: ${today} at ${time}</div>
          <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 4px; background: #eff6ff; padding: 4px 8px; border-radius: 4px; border: 1px solid #bfdbfe; display: inline-block;">
            ${totalItems} Items &nbsp;|&nbsp; ${totalUnits} Units &nbsp;|&nbsp; Total Valuation: ${formatINR(totalStockValue)}
          </div>
        </div>
      </div>

      <!-- Table -->
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; font-size: 10px; text-transform: uppercase;">
            <th style="padding: 6px 8px; text-align: center; width: 30px;">#</th>
            <th style="padding: 6px 8px; text-align: left;">Product Name</th>
            <th style="padding: 6px 8px; text-align: left; width: 80px;">SKU</th>
            <th style="padding: 6px 8px; text-align: left; width: 85px;">Barcode</th>
            <th style="padding: 6px 8px; text-align: left; width: 110px;">Category</th>
            <th style="padding: 6px 8px; text-align: right; width: 75px;">Price</th>
            <th style="padding: 6px 8px; text-align: center; width: 45px;">GST</th>
            <th style="padding: 6px 8px; text-align: right; width: 70px;">Stock</th>
            <th style="padding: 6px 8px; text-align: right; width: 90px;">Valuation</th>
            <th style="padding: 6px 8px; text-align: center; width: 75px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800; font-size: 11px; border-top: 2px solid #0f172a;">
            <td colspan="7" style="padding: 8px; text-align: right;">GRAND TOTALS:</td>
            <td style="padding: 8px; text-align: right;">${totalUnits} Units</td>
            <td style="padding: 8px; text-align: right; color: #2563eb;">${formatINR(totalStockValue)}</td>
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. PRINT / PDF & IMAGE TRIGGER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggers clean browser print-to-PDF modal for given HTML report
 */
export function triggerPrintReport(htmlContent: string, title = 'Report'): void {
  const existing = document.getElementById('report-export-iframe')
  if (existing) existing.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'report-export-iframe'
  iframe.style.cssText =
    'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;border:none;visibility:hidden'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) return

  doc.open()
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          html, body { width: 100%; margin: 0; padding: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `)
  doc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(() => iframe.remove(), 2500)
    }
  }, 350)
}

/**
 * Renders HTML report to an offscreen high-res canvas and triggers a PNG download
 */
export async function triggerImageReportDownload(htmlContent: string, filename: string): Promise<void> {
  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1200px;background:#ffffff;padding:0;margin:0;z-index:-10;'
  container.innerHTML = htmlContent
  document.body.appendChild(container)

  try {
    // Wrap rendered HTML into an SVG ForeignObject image
    const width = 1200
    const height = Math.max(700, container.scrollHeight + 40)
    const encodedHtml = encodeURIComponent(container.innerHTML)

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff; width:100%; height:100%; font-family:Arial,sans-serif;">
            ${container.innerHTML}
          </div>
        </foreignObject>
      </svg>
    `

    const img = new Image()
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width * 2 // 2x Retina resolution
        canvas.height = height * 2
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(2, 2)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0)

          const a = document.createElement('a')
          a.download = `${filename}.png`
          a.href = canvas.toDataURL('image/png')
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
        URL.revokeObjectURL(url)
        resolve()
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to rasterize report image'))
      }
      img.src = url
    })
  } finally {
    container.remove()
  }
}
