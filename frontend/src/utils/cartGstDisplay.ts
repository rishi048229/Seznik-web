import type { CartItem } from '@/types/product.types'
import type { SaleItem } from '@/types/sale.types'
import { computeSaleLineGst, roundMoney } from './gstLedger'

export type CartLineGstFigures = {
  base: number
  tax: number
  payable: number
  taxRate: number
  priceIncludesGst: boolean
}

export function getCartLineGstFigures(
  item: Pick<CartItem, 'quantity' | 'sellingPrice' | 'discount' | 'taxRate' | 'priceIncludesGst' | 'productName'>
): CartLineGstFigures {
  const gst = computeSaleLineGst({
    productName: item.productName,
    quantity: item.quantity,
    sellingPrice: item.sellingPrice,
    discount: item.discount ?? 0,
    taxRate: item.taxRate ?? 0,
    priceIncludesGst: item.priceIncludesGst ?? false,
  })
  return {
    base: gst.taxable,
    tax: gst.tax,
    payable: roundMoney(gst.taxable + gst.tax),
    taxRate: gst.rate,
    priceIncludesGst: item.priceIncludesGst ?? false,
  }
}

export function getSaleLineGstFigures(item: SaleItem): CartLineGstFigures {
  return getCartLineGstFigures({
    productName: item.productName,
    quantity: item.quantity,
    sellingPrice: item.sellingPrice,
    discount: item.discount ?? 0,
    taxRate: item.taxRate ?? 0,
    priceIncludesGst: item.priceIncludesGst ?? false,
  })
}

/** Short label under unit price in cart / checkout. */
export function formatCartLineGstHint(fig: CartLineGstFigures): string | null {
  if (fig.taxRate <= 0 || fig.tax <= 0) return null
  if (fig.priceIncludesGst) {
    return `Incl. ${fig.taxRate}% GST`
  }
  return `+${fig.taxRate}% GST (${fig.tax.toFixed(2)} extra)`
}
