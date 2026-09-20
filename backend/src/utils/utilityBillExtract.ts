export type UtilityBillType = 'ELECTRICITY' | 'WATER' | 'GAS' | 'BROADBAND' | 'UTILITY'

export interface UtilityBillExtractResult {
  billType: UtilityBillType | ''
  provider: string
  consumerNumber: string
  consumerName: string
  dueDate: string
  billDate: string
  unitsConsumed: string
  billAmount: number
  rawTextSnippet?: string
}

const EMPTY: UtilityBillExtractResult = {
  billType: '',
  provider: '',
  consumerNumber: '',
  consumerName: '',
  dueDate: '',
  billDate: '',
  unitsConsumed: '',
  billAmount: 0,
}

const PROVIDERS: Array<{ name: string; type: UtilityBillType; needles: RegExp }> = [
  { name: 'UPPCL Urban', type: 'ELECTRICITY', needles: /\bUPPCL\b|MADHYANCHAL|PURVANCHAL|PASCHIMANCHAL|DAKSHINANCHAL/i },
  { name: 'Tata Power', type: 'ELECTRICITY', needles: /TATA\s*POWER/i },
  { name: 'BSES Rajdhani', type: 'ELECTRICITY', needles: /BSES\s*RAJDHANI|\bBRPL\b/i },
  { name: 'BSES Yamuna', type: 'ELECTRICITY', needles: /BSES\s*YAMUNA|\bBYPL\b/i },
  { name: 'Adani Electricity', type: 'ELECTRICITY', needles: /ADANI\s*ELECTRIC/i },
  { name: 'BESCOM', type: 'ELECTRICITY', needles: /\bBESCOM\b/i },
  { name: 'MSEDCL', type: 'ELECTRICITY', needles: /\bMSEDCL\b|MAHAVITARAN|MSEB/i },
  { name: 'Torrent Power', type: 'ELECTRICITY', needles: /TORRENT\s*POWER/i },
  { name: 'PSPCL', type: 'ELECTRICITY', needles: /\bPSPCL\b/i },
  { name: 'WBSEDCL', type: 'ELECTRICITY', needles: /\bWBSEDCL\b/i },
  { name: 'TANGEDCO', type: 'ELECTRICITY', needles: /\bTANGEDCO\b|\bTNEB\b/i },
  { name: 'KSEB', type: 'ELECTRICITY', needles: /\bKSEB\b|\bKSEBL\b/i },
  { name: 'Delhi Jal Board', type: 'WATER', needles: /DELHI\s*JAL|\bDJB\b/i },
  { name: 'BMC Water', type: 'WATER', needles: /\bBMC\b.*WATER|WATER\s*BILL.*BMC/i },
  { name: 'IGL', type: 'GAS', needles: /\bIGL\b|INDRAPRASTHA\s*GAS/i },
  { name: 'Mahanagar Gas', type: 'GAS', needles: /MAHANAGAR\s*GAS|\bMGL\b/i },
  { name: 'Gujarat Gas', type: 'GAS', needles: /GUJARAT\s*GAS/i },
  { name: 'Airtel Fiber', type: 'BROADBAND', needles: /AIRTEL\s*(FIBER|FIBRE|XSTREAM|BROADBAND)/i },
  { name: 'JioFiber', type: 'BROADBAND', needles: /JIO\s*FIBER|JIOFIBER|JIO\s*FIBRE/i },
  { name: 'ACT Fibernet', type: 'BROADBAND', needles: /\bACT\s*FIBER|\bACT\s*FIBRE/i },
  { name: 'BSNL', type: 'BROADBAND', needles: /\bBSNL\b/i },
]

const DESIGNATION_RE = /^(mr|mrs|ms|shri|smt|sri|dr|m\/s|messrs)\.?\s+/i

export function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1')
  const chunks: string[] = []
  const paren = /\((?:\\.|[^\\)]){2,}\)(?:\s*Tj|\s*TJ)/g
  let match: RegExpExecArray | null
  while ((match = paren.exec(raw))) {
    const inner = match[0].slice(1, match[0].lastIndexOf(')'))
    const decoded = inner
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    if (/[A-Za-z0-9]/.test(decoded)) chunks.push(decoded)
  }
  const arrayTj = /\[(.*?)\]\s*TJ/gs
  while ((match = arrayTj.exec(raw))) {
    const parts = match[1].match(/\((?:\\.|[^\\)])*\)/g) || []
    const line = parts
      .map(p => p.slice(1, -1).replace(/\\n/g, ' ').replace(/\\\(/g, '(').replace(/\\\)/g, ')'))
      .join('')
    if (/[A-Za-z0-9]/.test(line)) chunks.push(line)
  }
  return chunks.join('\n')
}

function pickAmount(text: string): number {
  const labels = [
    /(?:net\s*payable|amount\s*payable|total\s*amount\s*due|current\s*demand|pay\s*by\s*due\s*date|grand\s*total|total\s*due|bill\s*amount)[^\d]{0,24}(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/gi,
  ]
  for (const re of labels) {
    const found = [...text.matchAll(re)]
    if (found.length) {
      const raw = found[found.length - 1][1].replace(/,/g, '')
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return 0
}

function pickDate(text: string, labels: RegExp): string {
  const match = text.match(labels)
  if (!match) return ''
  return normalizeDate(match[1] || match[2] || '')
}

function normalizeDate(raw: string): string {
  const cleaned = raw.replace(/[|]/g, '/').trim()
  if (!cleaned) return ''
  const parsed = Date.parse(cleaned.replace(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/, (_, d, m, y) => {
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }))
  if (!Number.isFinite(parsed)) return cleaned.toUpperCase()
  const d = new Date(parsed)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`
}

function titleCaseName(raw: string): string {
  const stripped = raw.replace(DESIGNATION_RE, '').replace(/\s+/g, ' ').trim()
  if (!stripped || stripped.length > 60) return ''
  if (/\d{4,}/.test(stripped) || /road|nagar|colony|sector|dist|pin/i.test(stripped)) return ''
  return stripped
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function extractFromText(text: string): UtilityBillExtractResult {
  const result: UtilityBillExtractResult = { ...EMPTY, rawTextSnippet: text.slice(0, 400) }
  if (!text.trim()) return result

  const provider = PROVIDERS.find(p => p.needles.test(text))
  if (provider) {
    result.provider = provider.name
    result.billType = provider.type
  } else if (/electric|kwh|kvah|power\s*bill/i.test(text)) {
    result.billType = 'ELECTRICITY'
  } else if (/water\s*bill|kilolitre|\bkl\b/i.test(text)) {
    result.billType = 'WATER'
  } else if (/\bpng\b|piped\s*gas|scm/i.test(text)) {
    result.billType = 'GAS'
  } else if (/broadband|fiber|fibre|internet/i.test(text)) {
    result.billType = 'BROADBAND'
  }

  const consumer =
    text.match(/(?:consumer\s*(?:no|number|id)|ca\s*(?:no|number)|account\s*(?:no|number)|k-?no|bp\s*no|ivrs|connection\s*(?:no|id))[^\nA-Za-z0-9]{0,12}([A-Z0-9][A-Z0-9\-\/]{5,22})/i)
    || text.match(/\b(?:CA|KNO|BP)\s*[:.\-]?\s*([A-Z0-9\-\/]{6,22})/i)
  if (consumer) result.consumerNumber = consumer[1].toUpperCase()

  const name = text.match(/(?:consumer\s*name|customer\s*name|name\s*of\s*(?:consumer|customer))[:\s]+([A-Za-z][A-Za-z .']{2,50})/i)
  if (name) result.consumerName = titleCaseName(name[1])

  result.dueDate = pickDate(text, /(?:due\s*date|pay\s*by|last\s*date)[:\s]+([0-9]{1,2}[-/][A-Za-z0-9]{2,9}[-/][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{2,4})/i)
  result.billDate = pickDate(text, /(?:bill\s*date|bill\s*period|issue\s*date)[:\s]+([0-9]{1,2}[-/][A-Za-z0-9]{2,9}[-/][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{2,4})/i)

  const units = text.match(/((?:[0-9]{1,6}(?:\.\d{1,2})?)\s*(?:kwh|kvah|units|kl|scm|gb))/i)
  if (units) result.unitsConsumed = units[1].replace(/\s+/g, ' ')

  result.billAmount = pickAmount(text)
  return result
}

export function mergeExtract(base: UtilityBillExtractResult, overlay: Partial<UtilityBillExtractResult>): UtilityBillExtractResult {
  const next = { ...base }
  const keys: Array<keyof UtilityBillExtractResult> = [
    'billType', 'provider', 'consumerNumber', 'consumerName', 'dueDate', 'billDate', 'unitsConsumed',
  ]
  for (const key of keys) {
    const value = overlay[key]
    if (typeof value === 'string' && value.trim() && !String(next[key] || '').trim()) {
      ;(next as any)[key] = value.trim()
    }
  }
  if ((!next.billAmount || next.billAmount <= 0) && typeof overlay.billAmount === 'number' && overlay.billAmount > 0) {
    next.billAmount = overlay.billAmount
  }
  return next
}

export function sanitizeExtract(raw: any): UtilityBillExtractResult {
  const billTypeRaw = String(raw?.billType || '').toUpperCase()
  const billType: UtilityBillExtractResult['billType'] =
    billTypeRaw === 'ELECTRICITY' || billTypeRaw === 'WATER' || billTypeRaw === 'GAS' || billTypeRaw === 'BROADBAND' || billTypeRaw === 'UTILITY'
      ? billTypeRaw
      : ''
  const amount = Number(String(raw?.billAmount ?? '').replace(/[^0-9.]/g, ''))
  return {
    billType,
    provider: String(raw?.provider || '').trim(),
    consumerNumber: String(raw?.consumerNumber || '').trim(),
    consumerName: titleCaseName(String(raw?.consumerName || '')),
    dueDate: String(raw?.dueDate || '').trim(),
    billDate: String(raw?.billDate || '').trim(),
    unitsConsumed: String(raw?.unitsConsumed || '').trim(),
    billAmount: Number.isFinite(amount) && amount > 0 ? amount : 0,
  }
}

export function isExtractThin(result: UtilityBillExtractResult): boolean {
  const filled = [result.provider, result.consumerNumber, result.consumerName, result.dueDate].filter(Boolean).length
  return filled < 2 || !(result.billAmount > 0)
}
