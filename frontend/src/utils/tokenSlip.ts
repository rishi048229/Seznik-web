import type { LucideIcon } from 'lucide-react'
import {
  Bike,
  Car,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Droplets,
  GlassWater,
  IceCream,
  Luggage,
  ParkingCircle,
  Sandwich,
  Shirt,
  Soup,
  Ticket,
  UtensilsCrossed,
} from 'lucide-react'
import { EscPosBuilder, rasterizeImageForEscPos } from './escpos'
import { printReceipt } from './receipt'
import { TOKEN_ICON_ASSETS, tokenIconDataUri } from './tokenIconAssets'
import type { Token } from '@/types/token.types'
import type { Sale } from '@/types/sale.types'

export interface TokenSlipTemplate {
  id: string
  name: string
  icon: string
  color: string
  price: number | null
  taxRate: number
  /** Key into TOKEN_ICON_ASSETS — new templates only need an SVG registered there. */
  iconAssetKey: string
  footerMessage: string
}

const tpl = (
  id: string,
  name: string,
  icon: string,
  color: string,
  price: number | null,
  taxRate: number,
  footerMessage: string,
): TokenSlipTemplate => ({
  id,
  name,
  icon,
  color,
  price,
  taxRate,
  iconAssetKey: id,
  footerMessage,
})

/** Small thermal stubs. Every sample uses the same renderTokenSlip path. */
export const TOKEN_SLIP_TEMPLATES: TokenSlipTemplate[] = [
  tpl('chai', 'Chai Token', 'chai', 'amber', 10, 5, 'Enjoy your chai'),
  tpl('coffee', 'Coffee Token', 'coffee', 'amber', 20, 5, 'Have a nice cup'),
  tpl('lassi', 'Lassi Token', 'lassi', 'rose', 30, 5, 'Fresh & chilled'),
  tpl('water', 'Water Token', 'water', 'sky', 20, 0, 'Stay hydrated'),
  tpl('samosa', 'Samosa Token', 'samosa', 'amber', 15, 5, 'Hot & fresh'),
  tpl('vadapav', 'Vada Pav Token', 'vadapav', 'rose', 25, 5, 'Mumbai special'),
  tpl('icecream', 'Ice Cream Token', 'icecream', 'sky', 40, 18, 'Keep cool'),
  tpl('bakery', 'Bakery Token', 'bakery', 'amber', 25, 5, 'Fresh from oven'),
  tpl('thali', 'Meal Token', 'thali', 'emerald', 80, 5, 'Collect at counter'),
  tpl('canteen', 'Canteen Token', 'canteen', 'blue', 50, 5, 'Show at kitchen'),
  tpl('parking', 'Parking Token', 'parking', 'blue', null, 0, 'Keep this slip'),
  tpl('valet', 'Valet Token', 'valet', 'purple', null, 0, 'Present to collect vehicle'),
  tpl('bike', 'Two-Wheeler Token', 'bike', 'emerald', 20, 0, 'Park at marked bay'),
  tpl('cloak', 'Cloak Room Token', 'cloak', 'purple', 30, 18, 'Claim with this token'),
  tpl('laundry', 'Laundry Token', 'laundry', 'sky', null, 18, 'Collect when ready'),
  tpl('queue', 'Queue Token', 'queue', 'blue', 0, 0, 'Please wait for your number'),
]

export const TOKEN_ICONS: Record<string, LucideIcon> = {
  ticket: Ticket,
  chai: Coffee,
  coffee: Coffee,
  lassi: CupSoda,
  water: Droplets,
  samosa: Cookie,
  vadapav: Sandwich,
  icecream: IceCream,
  bakery: Croissant,
  thali: Soup,
  canteen: UtensilsCrossed,
  parking: ParkingCircle,
  valet: Car,
  bike: Bike,
  cloak: Luggage,
  laundry: Shirt,
  queue: Ticket,
  food: UtensilsCrossed,
  snack: Cookie,
  qrcode: Ticket,
  wallet: Ticket,
  glass: GlassWater,
}

export const TOKEN_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
}

export const resolveTokenTemplate = (icon?: string | null, name?: string | null): TokenSlipTemplate => {
  const byId = TOKEN_SLIP_TEMPLATES.find((t) => t.id === icon || t.iconAssetKey === icon)
  if (byId) return byId
  const byIcon = TOKEN_SLIP_TEMPLATES.find((t) => t.icon === icon)
  if (byIcon) return byIcon
  const byName = TOKEN_SLIP_TEMPLATES.find((t) => name && t.name.toLowerCase() === name.toLowerCase())
  if (byName) return byName
  const lowered = (name || '').toLowerCase()
  const fuzzy = TOKEN_SLIP_TEMPLATES.find(
    (t) => lowered.includes(t.id) || lowered.includes(t.name.split(' ')[0].toLowerCase()),
  )
  return fuzzy || TOKEN_SLIP_TEMPLATES.find((t) => t.id === 'queue')!
}

export interface TokenSlipData {
  tokenNumber: number
  typeName: string
  icon?: string | null
  amount: number
  qty: number
  time: string | Date
  businessName?: string
  paymentMethod?: string
}

export interface TokenSlipRaster {
  packed: Uint8Array
  widthBytes: number
  heightDots: number
}

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const formatWhen = (time: string | Date) =>
  new Date(time).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

const paperWidthDots = (paperSize: '58mm' | '80mm') => (paperSize === '80mm' ? 576 : 384)

const iconMaxDots = (paperSize: '58mm' | '80mm') =>
  paperSize === '80mm' ? { w: 160, h: 112 } : { w: 128, h: 96 }

/** Pad a 1bpp raster with white so GS v 0 prints centered on the receipt grid. */
export const centerRasterOnPaper = (raster: TokenSlipRaster, targetWidthDots: number): TokenSlipRaster => {
  const targetBytes = Math.ceil(targetWidthDots / 8)
  if (raster.widthBytes >= targetBytes) return raster
  const left = Math.floor((targetBytes - raster.widthBytes) / 2)
  const packed = new Uint8Array(targetBytes * raster.heightDots)
  for (let y = 0; y < raster.heightDots; y++) {
    packed.set(
      raster.packed.subarray(y * raster.widthBytes, (y + 1) * raster.widthBytes),
      y * targetBytes + left,
    )
  }
  return { packed, widthBytes: targetBytes, heightDots: raster.heightDots }
}

export const composeTokenSlipHTML = (template: TokenSlipTemplate, token: TokenSlipData): string => {
  const when = formatWhen(token.time)
  const amt = token.amount > 0 ? `Rs.${token.amount.toFixed(2)}` : ''
  const iconSrc = tokenIconDataUri(template.iconAssetKey)
  return `<div style="font-family:'Courier New',Courier,monospace;color:#000;width:100%;text-align:center;">
    ${token.businessName ? `<div style="font-size:11px;font-weight:800;letter-spacing:0.5px;">${esc(token.businessName)}</div>` : ''}
    <div style="font-size:11px;font-weight:900;margin:6px 0 4px;letter-spacing:1px;">${esc(token.typeName.toUpperCase())}</div>
    <img src="${iconSrc}" alt="" width="72" height="72" style="width:72px;height:72px;margin:4px auto 6px;display:block;" />
    <div style="border-top:1px dashed #000;margin:8px 0;"></div>
    <div style="font-size:11px;">TOKEN</div>
    <div style="font-size:28px;font-weight:900;line-height:1.1;">#${token.tokenNumber}</div>
    ${token.qty > 1 ? `<div style="font-size:11px;margin-top:2px;">Qty ${token.qty}</div>` : ''}
    ${amt ? `<div style="font-size:14px;font-weight:800;margin-top:4px;">${esc(amt)}</div>` : ''}
    <div style="font-size:10px;margin-top:4px;">${esc(when)}</div>
    ${token.paymentMethod ? `<div style="font-size:10px;">${esc(token.paymentMethod.toUpperCase())}</div>` : ''}
    <div style="border-top:1px dashed #000;margin:8px 0 4px;"></div>
    <div style="font-size:10px;">${esc(template.footerMessage)}</div>
  </div>`
}

export const composeTokenSlipEscPos = (
  template: TokenSlipTemplate,
  token: TokenSlipData,
  paperSize: '58mm' | '80mm',
  icon?: TokenSlipRaster | null,
): Uint8Array => {
  const cols = paperSize === '80mm' ? 48 : 32
  const when = formatWhen(token.time)
  const b = new EscPosBuilder()
  b.init(paperSize)
  b.align('center')
  if (token.businessName) b.line(token.businessName)
  b.bold(true)
  b.line(token.typeName.toUpperCase())
  b.bold(false)
  if (icon && icon.heightDots > 0 && icon.widthBytes > 0) {
    b.feed(1)
    b.image(icon.packed, icon.widthBytes, icon.heightDots)
    b.feed(1)
  }
  b.hr(cols, '-')
  b.line('TOKEN')
  b.doubleSize(true)
  b.bold(true)
  b.line(`#${token.tokenNumber}`)
  b.doubleSize(false)
  b.bold(false)
  if (token.qty > 1) b.line(`Qty ${token.qty}`)
  if (token.amount > 0) {
    b.bold(true)
    b.line(`Rs.${token.amount.toFixed(2)}`)
    b.bold(false)
  }
  b.line(when)
  if (token.paymentMethod) b.line(token.paymentMethod.toUpperCase())
  b.hr(cols, '-')
  b.line(template.footerMessage)
  b.feed(2)
  b.cut()
  return b.toBytes()
}

/**
 * Shared token slip engine. Every template (current 16 and future ones) uses
 * this path: header, raster icon, token number, qty, price, time, payment, footer.
 */
export const renderTokenSlip = async (
  templateConfig: TokenSlipTemplate,
  tokenData: TokenSlipData,
  paperSize: '58mm' | '80mm' = '58mm',
): Promise<{ html: string; bytes: Uint8Array }> => {
  const max = iconMaxDots(paperSize)
  const raw = await rasterizeImageForEscPos(tokenIconDataUri(templateConfig.iconAssetKey), max.w, max.h)
  const icon = raw ? centerRasterOnPaper(raw, paperWidthDots(paperSize)) : null
  return {
    html: composeTokenSlipHTML(templateConfig, tokenData),
    bytes: composeTokenSlipEscPos(templateConfig, tokenData, paperSize, icon),
  }
}

const toSlipData = (token: Token, businessName?: string): TokenSlipData => {
  const sale = token.sale as Sale | undefined
  return {
    tokenNumber: token.tokenNumber,
    typeName: token.tokenType?.name ?? sale?.items?.[0]?.productName ?? 'Token',
    icon: token.tokenType?.icon,
    amount: sale?.grandTotal ?? 0,
    qty: sale?.items?.[0]?.quantity ?? 1,
    time: token.createdAt,
    businessName,
    paymentMethod: sale?.paymentMethod,
  }
}

export const generateTokenSlipHTML = (data: TokenSlipData): string => {
  const template = resolveTokenTemplate(data.icon, data.typeName)
  return composeTokenSlipHTML(template, data)
}

export const generateTokenSlipEscPos = async (
  data: TokenSlipData,
  paperSize: '58mm' | '80mm' = '58mm',
): Promise<Uint8Array> => {
  const template = resolveTokenTemplate(data.icon, data.typeName)
  const { bytes } = await renderTokenSlip(template, data, paperSize)
  return bytes
}

export const printTokenSlip = (token: Token, businessName?: string, paperSize: '58mm' | '80mm' = '58mm') => {
  const data = toSlipData(token, businessName)
  const width: '50mm' | '80mm' = paperSize === '80mm' ? '80mm' : '50mm'
  printReceipt(generateTokenSlipHTML(data), width, `Token #${token.tokenNumber}`)
}

export const tokenSlipBytes = async (token: Token, businessName?: string, paperSize: '58mm' | '80mm' = '58mm') =>
  generateTokenSlipEscPos(toSlipData(token, businessName), paperSize)

export { TOKEN_ICON_ASSETS, tokenIconDataUri }
