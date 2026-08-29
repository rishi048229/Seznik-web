import { EscPosBuilder } from './escpos'
import { printReceipt } from './receipt'

export interface KotSlipItem {
  productName: string
  quantity: number
  notes?: string | null
  modifiers?: string[]
}

export interface KotSlipData {
  orderNumber: number
  tableName: string
  orderType?: string | null
  waiterName?: string | null
  showWaiter?: boolean
  slipTitle?: string | null
  orderTime: string | Date
  notes?: string | null
  priority?: string | null
  items: KotSlipItem[]
}

const formatTime = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const generateKotSlipHTML = (data: KotSlipData, width: '50mm' | '80mm' = '50mm'): string => {
  const is80 = width === '80mm'
  const titleFs = is80 ? '22px' : '18px'
  const baseFs = is80 ? '14px' : '13px'
  const smallFs = is80 ? '12px' : '11px'
  const urgent = data.priority === 'urgent'

  const itemRows = data.items
    .map((it) => {
      const mods = (it.modifiers ?? []).filter(Boolean)
      const notes = it.notes?.trim()
      return `<div style="margin:6px 0;padding-bottom:4px;border-bottom:1px dashed #000;">
        <div style="font-size:${baseFs};font-weight:800;">${it.quantity} x ${escapeHtml(it.productName)}</div>
        ${mods.length ? `<div style="font-size:${smallFs};font-style:italic;">* ${escapeHtml(mods.join(', '))}</div>` : ''}
        ${notes ? `<div style="font-size:${smallFs};font-style:italic;color:#333;">Note: ${escapeHtml(notes)}</div>` : ''}
      </div>`
    })
    .join('')

  const title = (data.slipTitle || 'KITCHEN ORDER TICKET').trim() || 'KITCHEN ORDER TICKET'
  const showWaiter = data.showWaiter !== false && !!data.waiterName

  return `<div style="font-family:ui-monospace,Menlo,monospace;color:#000;width:100%;">
    <div style="text-align:center;font-weight:900;font-size:${smallFs};letter-spacing:1px;">*** ${escapeHtml(title)} ***</div>
    ${urgent ? `<div style="text-align:center;font-weight:900;font-size:${baseFs};margin-top:4px;">*** URGENT ***</div>` : ''}
    <div style="border-top:2px solid #000;margin:8px 0;"></div>
    <div style="text-align:center;font-size:${titleFs};font-weight:900;line-height:1.15;">${escapeHtml(data.tableName)}</div>
    <div style="text-align:center;font-size:${baseFs};font-weight:700;margin-top:4px;">KOT #${data.orderNumber}</div>
    ${data.orderType ? `<div style="text-align:center;font-size:${smallFs};font-weight:700;margin-top:2px;">${escapeHtml(data.orderType.replace('_', ' ').toUpperCase())}</div>` : ''}
    <div style="border-top:1px dashed #000;margin:8px 0;"></div>
    <div style="font-size:${smallFs};">Time: ${escapeHtml(formatTime(data.orderTime))}</div>
    ${showWaiter ? `<div style="font-size:${smallFs};">Waiter: ${escapeHtml(data.waiterName || '')}</div>` : ''}
    <div style="border-top:1px dashed #000;margin:8px 0;"></div>
    ${itemRows || `<div style="font-size:${baseFs};">No new items</div>`}
    ${data.notes ? `<div style="margin-top:8px;font-size:${smallFs};"><strong>Order note:</strong> ${escapeHtml(data.notes)}</div>` : ''}
    <div style="border-top:2px solid #000;margin:10px 0 4px;"></div>
    <div style="text-align:center;font-size:${smallFs};">-- Kitchen Copy --</div>
  </div>`
}

export const generateKotSlipEscPos = (data: KotSlipData, paperSize: '58mm' | '80mm' = '58mm'): Uint8Array => {
  const cols = paperSize === '80mm' ? 48 : 32
  const b = new EscPosBuilder()
  b.init(paperSize)
  const title = (data.slipTitle || 'KITCHEN ORDER TICKET').trim() || 'KITCHEN ORDER TICKET'
  b.align('center')
  b.bold(true)
  b.line(`*** ${title} ***`)
  if (data.priority === 'urgent') {
    b.doubleSize(true)
    b.line('URGENT')
    b.doubleSize(false)
  }
  b.bold(false)
  b.hr(cols, '=')
  b.doubleSize(true)
  b.bold(true)
  b.line(data.tableName)
  b.doubleSize(false)
  b.line(`KOT #${data.orderNumber}`)
  if (data.orderType) b.line(data.orderType.replace('_', ' ').toUpperCase())
  b.bold(false)
  b.hr(cols, '-')
  b.align('left')
  b.line(`Time: ${formatTime(data.orderTime)}`)
  if (data.showWaiter !== false && data.waiterName) b.line(`Waiter: ${data.waiterName}`)
  b.hr(cols, '-')
  data.items.forEach((it) => {
    b.bold(true)
    b.line(`${it.quantity} x ${it.productName}`)
    b.bold(false)
    const mods = (it.modifiers ?? []).filter(Boolean)
    if (mods.length) b.line(`  * ${mods.join(', ')}`)
    if (it.notes?.trim()) b.line(`  Note: ${it.notes.trim()}`)
  })
  if (data.notes?.trim()) {
    b.hr(cols, '-')
    b.line(`Order note: ${data.notes.trim()}`)
  }
  b.hr(cols, '=')
  b.align('center')
  b.line('-- Kitchen Copy --')
  b.feed(2)
  b.cut()
  return b.toBytes()
}

export const printKotSlip = (data: KotSlipData, width: '50mm' | '80mm' = '50mm') => {
  printReceipt(generateKotSlipHTML(data, width), width, `KOT #${data.orderNumber}`)
}

/**
 * Send a kitchen ticket to the Bluetooth printer when that is the destination.
 * Does not open the system print dialog — browser print is only used when the
 * user explicitly chose the system printer on the Printers page.
 */
export const printKotSlipSmart = async (
  data: KotSlipData,
  args: {
    paperSize?: '58mm' | '80mm'
    useBluetooth: boolean
    ble: { status: string; connect: () => Promise<void>; print: (bytes: Uint8Array) => Promise<void> }
  },
): Promise<'ble' | 'browser'> => {
  const paperSize = args.paperSize || '58mm'
  const htmlWidth: '50mm' | '80mm' = paperSize === '80mm' ? '80mm' : '50mm'
  if (args.useBluetooth) {
    if (args.ble.status !== 'connected') await args.ble.connect()
    await args.ble.print(generateKotSlipEscPos(data, paperSize))
    return 'ble'
  }
  printKotSlip(data, htmlWidth)
  return 'browser'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
