import { TEMPLATE_VARIABLES } from '@/types/customReceipt'

export type TemplateTextRun =
  | { kind: 'text'; value: string }
  | { kind: 'field'; key: string }

export type TemplateVariableGroupId = 'store' | 'bill' | 'customer' | 'amounts' | 'codes'

export interface TemplateVariableGroup {
  id: TemplateVariableGroupId
  label: string
  keys: readonly string[]
}

const VAR_TAG_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

const LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  TEMPLATE_VARIABLES.map((v) => [unwrapTemplateKey(v.key), v.label])
)

export const VARIABLE_GROUPS: readonly TemplateVariableGroup[] = [
  { id: 'store', label: 'Store', keys: ['store_name', 'store_address', 'store_phone', 'store_gstin'] },
  { id: 'bill', label: 'Bill', keys: ['invoice_no', 'date', 'time', 'footer_message', 'token_no', 'table_no', 'waiter_name'] },
  { id: 'customer', label: 'Customer', keys: ['customer_name', 'customer_phone'] },
  {
    id: 'amounts',
    label: 'Amounts',
    keys: ['subtotal', 'discount', 'tax', 'grand_total', 'paid_amount', 'change_returned', 'payment_method'],
  },
  { id: 'codes', label: 'Codes', keys: ['upi_qr', 'bill_pdf_url'] },
] as const

export function unwrapTemplateKey(keyOrTag: string): string {
  const trimmed = keyOrTag.trim()
  const wrapped = trimmed.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/)
  return wrapped ? wrapped[1] : trimmed.replace(/\{\{|\}\}/g, '').trim()
}

export function wrapTemplateKey(key: string): string {
  const inner = unwrapTemplateKey(key)
  return `{{${inner}}}`
}

export function labelForTemplateKey(key: string): string {
  const inner = unwrapTemplateKey(key)
  if (LABEL_BY_KEY[inner]) return LABEL_BY_KEY[inner]
  return inner.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function containsTemplateVar(text: string, key: string): boolean {
  if (!text) return false
  const inner = unwrapTemplateKey(key)
  return new RegExp(`\\{\\{\\s*${inner}\\s*\\}\\}`, 'i').test(text)
}

export function isOnlyTemplateVar(text: string, key: string): boolean {
  return text.trim().toLowerCase() === wrapTemplateKey(key).toLowerCase()
}

export function mergeAdjacentTextRuns(runs: TemplateTextRun[]): TemplateTextRun[] {
  const out: TemplateTextRun[] = []
  for (const run of runs) {
    if (run.kind === 'text' && run.value === '') continue
    const last = out[out.length - 1]
    if (run.kind === 'text' && last?.kind === 'text') {
      last.value += run.value
    } else {
      out.push(run.kind === 'text' ? { kind: 'text', value: run.value } : { kind: 'field', key: run.key })
    }
  }
  return out
}

export function parseTemplateText(str: string): TemplateTextRun[] {
  if (!str) return []
  const runs: TemplateTextRun[] = []
  let lastIndex = 0
  const re = new RegExp(VAR_TAG_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(str)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ kind: 'text', value: str.slice(lastIndex, match.index) })
    }
    runs.push({ kind: 'field', key: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < str.length) {
    runs.push({ kind: 'text', value: str.slice(lastIndex) })
  }
  return mergeAdjacentTextRuns(runs)
}

export function serializeTemplateRuns(runs: TemplateTextRun[]): string {
  return mergeAdjacentTextRuns(runs)
    .map((run) => (run.kind === 'field' ? wrapTemplateKey(run.key) : run.value))
    .join('')
}

export function humanizeTemplateText(str: string): string {
  if (!str) return ''
  return parseTemplateText(str)
    .map((run) => (run.kind === 'field' ? labelForTemplateKey(run.key) : run.value))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
}

export function insertFieldAt(text: string, fieldKey: string, start: number, end = start): string {
  const safeStart = Math.max(0, Math.min(start, text.length))
  const safeEnd = Math.max(safeStart, Math.min(end, text.length))
  return text.slice(0, safeStart) + wrapTemplateKey(fieldKey) + text.slice(safeEnd)
}

export interface TemplateSideContent {
  prefix: string
  fieldKey: string | null
  complex: boolean
}

export function parseTemplateSide(text: string): TemplateSideContent {
  const runs = parseTemplateText(text)
  const fields = runs.filter((r): r is { kind: 'field'; key: string } => r.kind === 'field')
  if (fields.length === 1) {
    return {
      prefix: runs.filter((r) => r.kind === 'text').map((r) => (r as { kind: 'text'; value: string }).value).join(''),
      fieldKey: fields[0].key,
      complex: false,
    }
  }
  if (fields.length === 0) {
    return { prefix: text, fieldKey: null, complex: false }
  }
  return { prefix: text, fieldKey: null, complex: true }
}

export function serializeTemplateSide(side: TemplateSideContent): string {
  if (side.complex) return side.prefix
  if (!side.fieldKey) return side.prefix
  return `${side.prefix}${wrapTemplateKey(side.fieldKey)}`
}
