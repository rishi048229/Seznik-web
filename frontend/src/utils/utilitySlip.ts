import { EscPosBuilder } from './escpos'
import { printReceipt } from './receipt'
import { downloadA4InvoicePdf } from './invoicePdf'
import { formatINR } from './currency'
import { formatReceiptDateTime } from './date'
import type { UtilityBill } from '@/types/utilityBill'

export type UtilitySlipDraft = Pick<
  UtilityBill,
  | 'receiptNumber'
  | 'kioskName'
  | 'billType'
  | 'provider'
  | 'consumerNumber'
  | 'consumerName'
  | 'dueDate'
  | 'billDate'
  | 'unitsConsumed'
  | 'billAmount'
  | 'convenienceFee'
  | 'totalAmount'
  | 'paymentMode'
  | 'status'
  | 'customerPhone'
  | 'createdAt'
>

const dash = (value?: string | null) => (value && String(value).trim()) || '—'

export const billTypeLabel = (type?: string) => {
  switch (String(type || '').toUpperCase()) {
    case 'ELECTRICITY': return 'Electricity'
    case 'WATER': return 'Water'
    case 'GAS': return 'Gas'
    case 'BROADBAND': return 'Broadband'
    default: return 'Utility'
  }
}

const colsFor = (paperSize: '58mm' | '80mm') => (paperSize === '80mm' ? 48 : 32)

export const utilitySlipBytes = (bill: UtilitySlipDraft, paperSize: '58mm' | '80mm' = '58mm'): Uint8Array => {
  const w = colsFor(paperSize)
  const when = formatReceiptDateTime(bill.createdAt || new Date().toISOString())
  const b = new EscPosBuilder()
  b.init(paperSize)
    .align('center')
    .bold(true)
    .line(dash(bill.kioskName).toUpperCase())
    .bold(false)
    .line('UTILITY PAYMENT RECEIPT')
    .line(when)
    .line(`Receipt # ${bill.receiptNumber}`)
    .hr(w)
    .align('left')
    .twoCol('Bill Type', billTypeLabel(bill.billType).toUpperCase(), w)
    .twoCol('Board', dash(bill.provider), w)
    .twoCol('Consumer No', dash(bill.consumerNumber), w)
    .twoCol('Name', dash(bill.consumerName), w)
    .twoCol('Due Date', dash(bill.dueDate), w)
    .twoCol('Units', dash(bill.unitsConsumed), w)
    .hr(w)
    .twoCol('Bill Amount', formatINR(bill.billAmount).replace('₹', 'Rs.'), w)
    .twoCol('Conv. Fee', formatINR(bill.convenienceFee).replace('₹', 'Rs.'), w)
    .bold(true)
    .twoCol('TOTAL PAID', formatINR(bill.totalAmount).replace('₹', 'Rs.'), w)
    .bold(false)
    .twoCol('Payment', String(bill.paymentMode || 'CASH').toUpperCase(), w)
    .twoCol('Status', String(bill.status || 'SUCCESS (PAID)'), w)
    .hr(w)
    .align('center')
    .barcode('CODE128', bill.receiptNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 20) || 'UB', 48)
    .newline()
    .qr(bill.receiptNumber, paperSize === '80mm' ? 5 : 4)
    .newline()
    .line('Thank You')
    .line('Powered by SEZNIK')
    .ejectAndCut()
  return b.toBytes()
}

export const generateUtilitySlipHTML = (bill: UtilitySlipDraft, paperSize: '58mm' | '80mm' = '58mm'): string => {
  const maxW = paperSize === '80mm' ? '76mm' : '52mm'
  const when = formatReceiptDateTime(bill.createdAt || new Date().toISOString())
  const row = (label: string, value: string, strong = false) => `
    <div style="display:flex;justify-content:space-between;gap:8px;margin:2px 0;font-weight:${strong ? 700 : 500};">
      <span style="color:#475569">${label}</span>
      <span style="text-align:right">${value}</span>
    </div>`

  return `
  <div style="width:${maxW};max-width:100%;margin:0 auto;font-family:'Courier New',ui-monospace,monospace;font-size:12px;color:#0f172a;line-height:1.35;">
    <div style="text-align:center">
      <div style="font-weight:800;font-size:14px;letter-spacing:0.04em">${dash(bill.kioskName).toUpperCase()}</div>
      <div style="font-weight:700;margin-top:2px">UTILITY PAYMENT RECEIPT</div>
      <div style="color:#64748b;font-size:11px;margin-top:2px">${when}</div>
      <div style="font-size:11px">Receipt # ${bill.receiptNumber}</div>
    </div>
    <div style="border-top:1px dashed #94a3b8;margin:8px 0"></div>
    <div style="display:inline-block;background:#0f172a;color:#fff;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;letter-spacing:0.06em;margin-bottom:6px">
      ${billTypeLabel(bill.billType).toUpperCase()}
    </div>
    ${row('Board / Provider', dash(bill.provider))}
    ${row('Consumer No', dash(bill.consumerNumber))}
    ${row('Consumer Name', dash(bill.consumerName))}
    ${row('Due Date', dash(bill.dueDate))}
    ${row('Units Consumed', dash(bill.unitsConsumed))}
    <div style="border-top:1px dashed #94a3b8;margin:8px 0"></div>
    ${row('Bill Amount', formatINR(bill.billAmount))}
    ${row('Convenience Fee', formatINR(bill.convenienceFee))}
    ${row('Total Paid', formatINR(bill.totalAmount), true)}
    ${row('Payment Mode', String(bill.paymentMode || 'CASH').toUpperCase())}
    ${row('Status', String(bill.status || 'SUCCESS (PAID)'))}
    <div style="border-top:1px dashed #94a3b8;margin:8px 0"></div>
    <div style="text-align:center;font-family:monospace;letter-spacing:0.18em;font-size:13px;margin:6px 0">
      ||||| ${bill.receiptNumber} |||||
    </div>
    <div style="text-align:center;font-size:11px;color:#334155">Thank You</div>
    <div style="text-align:center;font-size:10px;color:#64748b">Powered by SEZNIK</div>
    <div style="height:2mm"></div>
  </div>`
}

export const printUtilitySlip = (bill: UtilitySlipDraft, paperSize: '58mm' | '80mm' = '58mm') => {
  const html = generateUtilitySlipHTML(bill, paperSize)
  printReceipt(html, paperSize === '80mm' ? '80mm' : '50mm', `Utility ${bill.receiptNumber}`)
}

export const generateUtilityA4HTML = (bill: UtilitySlipDraft): string => {
  const when = formatReceiptDateTime(bill.createdAt || new Date().toISOString())
  const cell = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 10px;color:#64748b;width:38%;border-bottom:1px solid #e2e8f0">${label}</td>
      <td style="padding:8px 10px;font-weight:600;border-bottom:1px solid #e2e8f0">${value}</td>
    </tr>`
  return `
  <div style="font-family:Inter,system-ui,sans-serif;color:#0f172a;max-width:720px;margin:0 auto;padding:24px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div>
        <div style="font-size:22px;font-weight:800">${dash(bill.kioskName)}</div>
        <div style="color:#2563eb;font-weight:700;margin-top:4px">Utility Payment Receipt</div>
      </div>
      <div style="text-align:right;font-size:13px;color:#475569">
        <div><strong>${bill.receiptNumber}</strong></div>
        <div>${when}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:14px">
      ${cell('Bill Type', billTypeLabel(bill.billType))}
      ${cell('Board / Provider', dash(bill.provider))}
      ${cell('Consumer Number', dash(bill.consumerNumber))}
      ${cell('Consumer Name', dash(bill.consumerName))}
      ${cell('Due Date', dash(bill.dueDate))}
      ${cell('Units Consumed', dash(bill.unitsConsumed))}
      ${cell('Bill Amount', formatINR(bill.billAmount))}
      ${cell('Convenience Fee', formatINR(bill.convenienceFee))}
      ${cell('Total Paid', formatINR(bill.totalAmount))}
      ${cell('Payment Mode', String(bill.paymentMode || 'CASH').toUpperCase())}
      ${cell('Status', String(bill.status || 'SUCCESS (PAID)'))}
    </table>
    <p style="margin-top:28px;text-align:center;color:#64748b;font-size:12px">Thank you · Powered by SEZNIK</p>
  </div>`
}

export const downloadUtilityA4Pdf = async (bill: UtilitySlipDraft) => {
  await downloadA4InvoicePdf(generateUtilityA4HTML(bill), `${bill.receiptNumber}.pdf`, 'A4')
}

export const downloadUtilityThermalPdf = async (bill: UtilitySlipDraft, paperSize: '58mm' | '80mm' = '58mm') => {
  const html = generateUtilitySlipHTML(bill, paperSize)
  await downloadA4InvoicePdf(
    `<div style="padding:16px;background:#fff">${html}</div>`,
    `${bill.receiptNumber}-thermal.pdf`,
    'A4',
  )
}

export const whatsappUtilityMessage = (bill: UtilitySlipDraft) => {
  return [
    `*${dash(bill.kioskName)}*`,
    'Utility Payment Receipt',
    `Receipt: ${bill.receiptNumber}`,
    `Type: ${billTypeLabel(bill.billType)}`,
    bill.provider ? `Board: ${bill.provider}` : '',
    bill.consumerNumber ? `Consumer No: ${bill.consumerNumber}` : '',
    bill.consumerName ? `Name: ${bill.consumerName}` : '',
    bill.dueDate ? `Due: ${bill.dueDate}` : '',
    `Bill Amount: ${formatINR(bill.billAmount)}`,
    `Convenience Fee: ${formatINR(bill.convenienceFee)}`,
    `*Total Paid: ${formatINR(bill.totalAmount)}*`,
    `Mode: ${String(bill.paymentMode || 'CASH').toUpperCase()}`,
    `Status: ${bill.status || 'SUCCESS (PAID)'}`,
    'Powered by SEZNIK',
  ].filter(Boolean).join('\n')
}

export const openUtilityWhatsApp = (bill: UtilitySlipDraft, phone?: string | null) => {
  const digits = String(phone || '').replace(/\D/g, '')
  const withCc = digits.length === 10 ? `91${digits}` : digits
  const text = encodeURIComponent(whatsappUtilityMessage(bill))
  const url = withCc ? `https://wa.me/${withCc}?text=${text}` : `https://wa.me/?text=${text}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
