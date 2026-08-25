/** Round to 2 decimal places (paise) as per GST invoicing practice. */
export function roundGstAmount(value: number): number {
  return Math.round(value * 100) / 100
}

export interface ProductGstBreakdown {
  taxableValue: number
  cgstRate: number
  sgstRate: number
  cgstAmount: number
  sgstAmount: number
  totalGst: number
  finalPrice: number
  enteredPrice: number
  gstRate: number
  priceIncludesGst: boolean
}

export function calculateProductGstBreakdown(
  enteredPrice: number,
  gstRate: number,
  priceIncludesGst: boolean,
): ProductGstBreakdown {
  const rate = Math.max(0, gstRate)
  const price = Math.max(0, enteredPrice)

  let taxableValue: number
  let totalGst: number
  let finalPrice: number

  if (rate === 0 || price === 0) {
    taxableValue = price
    totalGst = 0
    finalPrice = price
  } else if (priceIncludesGst) {
    taxableValue = roundGstAmount(price / (1 + rate / 100))
    totalGst = roundGstAmount(price - taxableValue)
    finalPrice = price
  } else {
    taxableValue = price
    totalGst = roundGstAmount(price * (rate / 100))
    finalPrice = roundGstAmount(price + totalGst)
  }

  const halfRate = rate / 2
  const cgstAmount = roundGstAmount(totalGst / 2)
  const sgstAmount = roundGstAmount(totalGst - cgstAmount)

  return {
    taxableValue,
    cgstRate: halfRate,
    sgstRate: halfRate,
    cgstAmount,
    sgstAmount,
    totalGst,
    finalPrice,
    enteredPrice: price,
    gstRate: rate,
    priceIncludesGst,
  }
}

export interface GstLineInput {
  sellingPrice: number
  quantity: number
  discount: number
  taxRate: number
  priceIncludesGst: boolean
}

export interface GstSlabRow {
  gstRate: number
  cgstRate: number
  sgstRate: number
  taxableValue: number
  cgstAmount: number
  sgstAmount: number
  totalGst: number
}

export interface GstBillSummary {
  taxableValue: number
  totalGst: number
  cgstAmount: number
  sgstAmount: number
  slabs: GstSlabRow[]
}

export function calculateLineGstBreakdown(
  sellingPrice: number,
  quantity: number,
  discount: number,
  gstRate: number,
  priceIncludesGst: boolean,
): ProductGstBreakdown {
  const lineEntered = Math.max(0, sellingPrice * quantity - Math.max(0, discount))
  return calculateProductGstBreakdown(lineEntered, gstRate, priceIncludesGst)
}

export function splitCgstSgst(totalGst: number): { cgst: number; sgst: number } {
  const cgst = roundGstAmount(totalGst / 2)
  const sgst = roundGstAmount(totalGst - cgst)
  return { cgst, sgst }
}

export function computeGstBillSummary(lines: GstLineInput[]): GstBillSummary {
  const slabMap = new Map<number, { taxable: number; gst: number }>()

  for (const line of lines) {
    const breakdown = calculateLineGstBreakdown(
      line.sellingPrice,
      line.quantity,
      line.discount,
      line.taxRate,
      line.priceIncludesGst,
    )
    const existing = slabMap.get(breakdown.gstRate) || { taxable: 0, gst: 0 }
    existing.taxable = roundGstAmount(existing.taxable + breakdown.taxableValue)
    existing.gst = roundGstAmount(existing.gst + breakdown.totalGst)
    slabMap.set(breakdown.gstRate, existing)
  }

  const slabs: GstSlabRow[] = [...slabMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, value]) => {
      const { cgst, sgst } = splitCgstSgst(value.gst)
      return {
        gstRate: rate,
        cgstRate: rate / 2,
        sgstRate: rate / 2,
        taxableValue: value.taxable,
        cgstAmount: cgst,
        sgstAmount: sgst,
        totalGst: value.gst,
      }
    })

  const taxableValue = roundGstAmount(slabs.reduce((sum, slab) => sum + slab.taxableValue, 0))
  const totalGst = roundGstAmount(slabs.reduce((sum, slab) => sum + slab.totalGst, 0))
  const { cgst: cgstAmount, sgst: sgstAmount } = splitCgstSgst(totalGst)

  return { taxableValue, totalGst, cgstAmount, sgstAmount, slabs }
}

export function gstSummaryFromCart(
  items: {
    sellingPrice: number
    quantity: number
    discount?: number
    taxRate?: number
    priceIncludesGst?: boolean
  }[],
  extraDiscount = 0,
): GstBillSummary {
  const rawGross = items.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0)
  const lineDisc = items.reduce((sum, item) => sum + (item.discount || 0), 0)
  const totalDisc = lineDisc + extraDiscount
  const factor = rawGross > 0 ? Math.max(0, rawGross - totalDisc) / rawGross : 1
  return computeGstBillSummary(
    items.map((item) => ({
      sellingPrice: item.sellingPrice * factor,
      quantity: item.quantity,
      discount: 0,
      taxRate: item.taxRate || 0,
      priceIncludesGst: Boolean(item.priceIncludesGst),
    })),
  )
}

export function gstLinesFromSaleItems(
  items: {
    unitPrice?: number
    sellingPrice?: number
    quantity?: number
    discount?: number
    discountAmount?: number
    taxRate?: number
    priceIncludesGst?: boolean
  }[],
): GstLineInput[] {
  return items.map((item) => ({
    sellingPrice: item.unitPrice ?? item.sellingPrice ?? 0,
    quantity: item.quantity ?? 1,
    discount: item.discountAmount ?? item.discount ?? 0,
    taxRate: item.taxRate ?? 0,
    priceIncludesGst: Boolean(item.priceIncludesGst),
  }))
}
