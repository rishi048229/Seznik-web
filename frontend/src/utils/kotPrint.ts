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
      return `<tr>
        <td style="padding:5px 4px 5px 0;font-weight:900;vertical-align:top;width:28px;white-space:nowrap;">${it.quantity}x</td>
        <td style="padding:5px 0;border-bottom:1px dashed #000;">
          <div style="font-weight:800;">${escapeHtml(it.productName)}</div>
          ${mods.length ? `<div style="font-size:${smallFs};font-style:italic;">* ${escapeHtml(mods.join(', '))}</div>` : ''}
          ${notes ? `<div style="font-size:${smallFs};font-style:italic;">Note: ${escapeHtml(notes)}</div>` : ''}
        </td>
      </tr>`
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
    <table style="width:100%;border-collapse:collapse;font-size:${baseFs};">
      ${itemRows || `<tr><td style="font-size:${baseFs};">No new items</td></tr>`}
    </table>
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
  b.feed(3)
  b.cut()
  return b.toBytes()
}

export const printKotSlip = (data: KotSlipData, width: '50mm' | '80mm' = '50mm') => {
  printReceipt(generateKotSlipHTML(data, width), width, `KOT #${data.orderNumber}`)
}

export interface KotDeltaChangeLine {
  type: 'new' | 'void' | 'qty_change'
  productName: string
  quantity: number
  oldQuantity?: number
  notes?: string
  reason?: string
}

export interface KotDeltaSlipData {
  orderNumber: number
  tableName?: string | null
  partyLabel?: string | null
  waiterName?: string | null
  time: string
  version?: number
  changes: KotDeltaChangeLine[]
}

export const generateKotDeltaSlipHTML = (
  data: KotDeltaSlipData,
  width: '50mm' | '80mm' = '50mm'
): string => {
  const is80 = width === '80mm'
  const baseFs = is80 ? '14px' : '13px'
  const smallFs = is80 ? '12px' : '11px'
  const versionTag = data.version ? ` v${data.version}` : ''
  const tableLabel = data.tableName || data.partyLabel || 'Counter'

  const changesHtml = data.changes
    .map((c) => {
      if (c.type === 'new') {
        return `<div style="color:#15803D;font-weight:800;margin-bottom:6px;font-size:${baseFs};">+ NEW &nbsp; ${c.quantity}x ${escapeHtml(c.productName)}${
          c.notes
            ? `<div style="font-weight:400;font-size:${smallFs};padding-left:14px;">- ${escapeHtml(c.notes)}</div>`
            : ''
        }</div>`
      }
      if (c.type === 'void') {
        return `<div style="color:#DC2626;font-weight:800;margin-bottom:6px;font-size:${baseFs};">- VOID &nbsp; ${c.quantity}x ${escapeHtml(c.productName)}${
          c.reason
            ? `<div style="font-weight:400;font-size:${smallFs};padding-left:14px;font-style:italic;">(${escapeHtml(c.reason)})</div>`
            : ''
        }</div>`
      }
      return `<div style="color:#B45309;font-weight:800;margin-bottom:6px;font-size:${baseFs};">~ CHG &nbsp; ${c.oldQuantity || 1}x → ${c.quantity}x ${escapeHtml(c.productName)}${
        c.notes
          ? `<div style="font-weight:400;font-size:${smallFs};padding-left:14px;">- ${escapeHtml(c.notes)}</div>`
          : ''
      }</div>`
    })
    .join('<hr style="border:none;border-top:1px dashed #000;margin:4px 0;">')

  return `<div style="font-family:ui-monospace,Menlo,monospace;color:#000;width:100%;">
    <div style="text-align:center;font-weight:900;font-size:${baseFs};">======MODIFIED KOT #${String(data.orderNumber).padStart(4, '0')}======</div>
    <div style="text-align:center;font-size:${smallFs};margin-top:4px;">Table: ${escapeHtml(tableLabel)} &nbsp; Time: ${escapeHtml(data.time)}</div>
    ${data.waiterName ? `<div style="text-align:center;font-size:${smallFs};">Waiter: ${escapeHtml(data.waiterName)}</div>` : ''}
    <div style="text-align:center;font-weight:900;color:#B45309;margin-top:4px;">[ MODIFIED${versionTag} ]</div>
    <div style="border-top:1px solid #000;margin:8px 0;"></div>
    ${changesHtml}
    <div style="border-top:1px solid #000;margin:8px 0;"></div>
    <div style="text-align:center;font-size:${smallFs};font-style:italic;">This ticket shows CHANGES ONLY</div>
    <div style="border-top:2px solid #000;margin:8px 0 4px;"></div>
  </div>`
}

export const generateKotDeltaSlipEscPos = (
  data: KotDeltaSlipData,
  paperSize: '58mm' | '80mm' = '58mm'
): Uint8Array => {
  const cols = paperSize === '80mm' ? 48 : 32
  const b = new EscPosBuilder()
  b.init(paperSize)
  b.align('center')
  b.bold(true)
  b.line(`======MODIFIED KOT #${String(data.orderNumber).padStart(4, '0')}======`)
  b.bold(false)
  const tableLabel = data.tableName || data.partyLabel || 'Counter'
  b.line(`Table: ${tableLabel}  Time: ${data.time}`)
  if (data.waiterName) b.line(`Waiter: ${data.waiterName}`)
  b.bold(true)
  b.line(`[ MODIFIED${data.version ? ` v${data.version}` : ''} ]`)
  b.bold(false)
  b.hr(cols, '-')
  b.align('left')
  data.changes.forEach((c) => {
    b.bold(true)
    if (c.type === 'new') {
      b.line(`+ NEW  ${c.quantity}x  ${c.productName}`)
      b.bold(false)
      if (c.notes) b.line(`       - ${c.notes}`)
    } else if (c.type === 'void') {
      b.line(`- VOID ${c.quantity}x  ${c.productName}`)
      b.bold(false)
      if (c.reason) b.line(`       (${c.reason})`)
    } else {
      b.line(`~ CHG  ${c.oldQuantity || 1}x -> ${c.quantity}x  ${c.productName}`)
      b.bold(false)
      if (c.notes) b.line(`       - ${c.notes}`)
    }
  })
  b.hr(cols, '-')
  b.align('center')
  b.line('This ticket shows CHANGES ONLY')
  b.hr(cols, '=')
  b.feed(3)
  b.cut()
  return b.toBytes()
}

export const printKotDeltaSlip = (data: KotDeltaSlipData, width: '50mm' | '80mm' = '50mm') => {
  printReceipt(generateKotDeltaSlipHTML(data, width), width, `Delta KOT #${data.orderNumber}`)
}

export const printKotDeltaSlipSmart = async (
  data: KotDeltaSlipData,
  args: {
    paperSize?: '58mm' | '80mm'
    useBluetooth: boolean
    ble: { status: string; connect: () => Promise<void>; print: (bytes: Uint8Array) => Promise<void> }
  }
): Promise<'ble' | 'browser'> => {
  const paperSize = args.paperSize || '58mm'
  const htmlWidth: '50mm' | '80mm' = paperSize === '80mm' ? '80mm' : '50mm'
  if (args.useBluetooth) {
    if (args.ble.status !== 'connected') await args.ble.connect()
    await args.ble.print(generateKotDeltaSlipEscPos(data, paperSize))
    return 'ble'
  }
  printKotDeltaSlip(data, htmlWidth)
  return 'browser'
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
