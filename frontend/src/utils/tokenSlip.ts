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
import { EscPosBuilder } from './escpos'
import { printReceipt } from './receipt'
import type { Token } from '@/types/token.types'
import type { Sale } from '@/types/sale.types'

export interface TokenSlipTemplate {
  id: string
  name: string
  icon: string
  color: string
  price: number | null
  taxRate: number
  art: string[]
  footer: string
}

/** Small thermal stubs — chai cup, parking, canteen, cloak room, etc. */
export const TOKEN_SLIP_TEMPLATES: TokenSlipTemplate[] = [
  {
    id: 'chai',
    name: 'Chai Token',
    icon: 'chai',
    color: 'amber',
    price: 10,
    taxRate: 5,
    art: ['   ( (', '    ) )', ' .--------.', ' |        |]', '  \\      /', "   `----'"],
    footer: 'Enjoy your chai',
  },
  {
    id: 'coffee',
    name: 'Coffee Token',
    icon: 'coffee',
    color: 'amber',
    price: 20,
    taxRate: 5,
    art: ['    )  (', '   (    )', ' .--------.', ' |  COFFEE|]', '  \\      /', "   `----'"],
    footer: 'Have a nice cup',
  },
  {
    id: 'lassi',
    name: 'Lassi Token',
    icon: 'lassi',
    color: 'rose',
    price: 30,
    taxRate: 5,
    art: ['   .----.', '  / LASSI\\', ' |        |', ' |        |', '  \\______/'],
    footer: 'Fresh & chilled',
  },
  {
    id: 'water',
    name: 'Water Token',
    icon: 'water',
    color: 'sky',
    price: 20,
    taxRate: 0,
    art: ['    .--.', '   /    \\', '  | WATER |', '   \\    /', "    '--'"],
    footer: 'Stay hydrated',
  },
  {
    id: 'samosa',
    name: 'Samosa Token',
    icon: 'samosa',
    color: 'amber',
    price: 15,
    taxRate: 5,
    art: ['     /\\', '    /  \\', '   /    \\', '  /SAMOSA\\', '  `------`'],
    footer: 'Hot & fresh',
  },
  {
    id: 'vadapav',
    name: 'Vada Pav Token',
    icon: 'vadapav',
    color: 'rose',
    price: 25,
    taxRate: 5,
    art: ['  .=======.', '  | VADA  |', '  |  PAV  |', '  `=======`'],
    footer: 'Mumbai special',
  },
  {
    id: 'icecream',
    name: 'Ice Cream Token',
    icon: 'icecream',
    color: 'sky',
    price: 40,
    taxRate: 18,
    art: ['    (  )', '   (    )', '    \\  /', '     \\/', '     ||', '     ||'],
    footer: 'Keep cool',
  },
  {
    id: 'bakery',
    name: 'Bakery Token',
    icon: 'bakery',
    color: 'amber',
    price: 25,
    taxRate: 5,
    art: ['   (((((((', '  (  BUN  )', '   \\_____/'],
    footer: 'Fresh from oven',
  },
  {
    id: 'thali',
    name: 'Meal Token',
    icon: 'thali',
    color: 'emerald',
    price: 80,
    taxRate: 5,
    art: ['  .--------.', ' (  THALI   )', '  `--------`'],
    footer: 'Collect at counter',
  },
  {
    id: 'canteen',
    name: 'Canteen Token',
    icon: 'canteen',
    color: 'blue',
    price: 50,
    taxRate: 5,
    art: ['  =========', '  | LUNCH |', '  ========='],
    footer: 'Show at kitchen',
  },
  {
    id: 'parking',
    name: 'Parking Token',
    icon: 'parking',
    color: 'blue',
    price: null,
    taxRate: 0,
    art: ['    ____', '  _/    \\_', ' |  PARK  |', '  `------`', '   o    o'],
    footer: 'Keep this slip',
  },
  {
    id: 'valet',
    name: 'Valet Token',
    icon: 'valet',
    color: 'purple',
    price: null,
    taxRate: 0,
    art: ['   .----.', '  / VALET\\', ' |  KEYS  |', '  `------`'],
    footer: 'Present to collect vehicle',
  },
  {
    id: 'bike',
    name: 'Two-Wheeler Token',
    icon: 'bike',
    color: 'emerald',
    price: 20,
    taxRate: 0,
    art: ['    o   o', '   /|\\_/|\\', '    O   O'],
    footer: 'Park at marked bay',
  },
  {
    id: 'cloak',
    name: 'Cloak Room Token',
    icon: 'cloak',
    color: 'purple',
    price: 30,
    taxRate: 18,
    art: ['   \\ | /', '    \\|/', '   .-|-. ', '  | BAG |', '   `---`'],
    footer: 'Claim with this token',
  },
  {
    id: 'laundry',
    name: 'Laundry Token',
    icon: 'laundry',
    color: 'sky',
    price: null,
    taxRate: 18,
    art: ['  .=======.', '  | WASH  |', '  | FOLD  |', '  `=======`'],
    footer: 'Collect when ready',
  },
  {
    id: 'queue',
    name: 'Queue Token',
    icon: 'queue',
    color: 'blue',
    price: 0,
    taxRate: 0,
    art: ['  *********', '  * WAIT  *', '  *********'],
    footer: 'Please wait for your number',
  },
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

const templateByIcon = (icon?: string | null, name?: string | null): TokenSlipTemplate => {
  const byIcon = TOKEN_SLIP_TEMPLATES.find((t) => t.icon === icon)
  if (byIcon) return byIcon
  const byName = TOKEN_SLIP_TEMPLATES.find((t) => name && t.name.toLowerCase() === name.toLowerCase())
  if (byName) return byName
  const lowered = (name || '').toLowerCase()
  const fuzzy = TOKEN_SLIP_TEMPLATES.find((t) => lowered.includes(t.id) || lowered.includes(t.name.split(' ')[0].toLowerCase()))
  return fuzzy || TOKEN_SLIP_TEMPLATES[TOKEN_SLIP_TEMPLATES.length - 1]
}

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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
  const tpl = templateByIcon(data.icon, data.typeName)
  const when = new Date(data.time).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const amt = data.amount > 0 ? `Rs.${data.amount.toFixed(2)}` : ''
  return `<div style="font-family:'Courier New',Courier,monospace;color:#000;width:100%;text-align:center;">
    ${data.businessName ? `<div style="font-size:11px;font-weight:800;letter-spacing:0.5px;">${esc(data.businessName)}</div>` : ''}
    <div style="font-size:11px;font-weight:900;margin:6px 0 4px;letter-spacing:1px;">${esc(data.typeName.toUpperCase())}</div>
    <div style="font-size:10px;line-height:1.15;font-weight:700;white-space:pre;text-align:center;">${tpl.art.map((line) => esc(line)).join('\n')}</div>
    <div style="border-top:1px dashed #000;margin:8px 0;"></div>
    <div style="font-size:11px;">TOKEN</div>
    <div style="font-size:28px;font-weight:900;line-height:1.1;">#${data.tokenNumber}</div>
    ${data.qty > 1 ? `<div style="font-size:11px;margin-top:2px;">Qty ${data.qty}</div>` : ''}
    ${amt ? `<div style="font-size:14px;font-weight:800;margin-top:4px;">${esc(amt)}</div>` : ''}
    <div style="font-size:10px;margin-top:4px;">${esc(when)}</div>
    ${data.paymentMethod ? `<div style="font-size:10px;">${esc(data.paymentMethod.toUpperCase())}</div>` : ''}
    <div style="border-top:1px dashed #000;margin:8px 0 4px;"></div>
    <div style="font-size:10px;">${esc(tpl.footer)}</div>
  </div>`
}

export const generateTokenSlipEscPos = (data: TokenSlipData, paperSize: '58mm' | '80mm' = '58mm'): Uint8Array => {
  const tpl = templateByIcon(data.icon, data.typeName)
  const cols = paperSize === '80mm' ? 48 : 32
  const when = new Date(data.time).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const b = new EscPosBuilder()
  b.init(paperSize)
  b.align('center')
  if (data.businessName) b.line(data.businessName)
  b.bold(true)
  b.line(data.typeName.toUpperCase())
  b.bold(false)
  tpl.art.forEach((line) => b.line(line))
  b.hr(cols, '-')
  b.line('TOKEN')
  b.doubleSize(true)
  b.bold(true)
  b.line(`#${data.tokenNumber}`)
  b.doubleSize(false)
  b.bold(false)
  if (data.qty > 1) b.line(`Qty ${data.qty}`)
  if (data.amount > 0) {
    b.bold(true)
    b.line(`Rs.${data.amount.toFixed(2)}`)
    b.bold(false)
  }
  b.line(when)
  if (data.paymentMethod) b.line(data.paymentMethod.toUpperCase())
  b.hr(cols, '-')
  b.line(tpl.footer)
  b.feed(2)
  b.cut()
  return b.toBytes()
}

export const printTokenSlip = (token: Token, businessName?: string, paperSize: '58mm' | '80mm' = '58mm') => {
  const data = toSlipData(token, businessName)
  const width: '50mm' | '80mm' = paperSize === '80mm' ? '80mm' : '50mm'
  printReceipt(generateTokenSlipHTML(data), width, `Token #${token.tokenNumber}`)
}

export const tokenSlipBytes = (token: Token, businessName?: string, paperSize: '58mm' | '80mm' = '58mm') =>
  generateTokenSlipEscPos(toSlipData(token, businessName), paperSize)
