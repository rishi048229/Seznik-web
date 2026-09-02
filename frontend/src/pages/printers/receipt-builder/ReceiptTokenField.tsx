import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  VARIABLE_GROUPS,
  labelForTemplateKey,
  parseTemplateText,
  serializeTemplateRuns,
  type TemplateVariableGroup,
} from '@/utils/receiptTemplateTokens'

const PILL_CLASS =
  'receipt-token-pill inline-flex items-center mx-0.5 px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-[10px] font-semibold align-middle select-none cursor-default'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function runsToHtml(text: string): string {
  return parseTemplateText(text)
    .map((run) => {
      if (run.kind === 'text') {
        return escapeHtml(run.value).replace(/\n/g, '<br>')
      }
      const key = escapeHtml(run.key)
      return `<span contenteditable="false" data-field="${key}" class="${PILL_CLASS}">${escapeHtml(labelForTemplateKey(run.key))}</span>`
    })
    .join('')
}

function htmlToValue(root: HTMLElement): string {
  const runs: { kind: 'text' | 'field'; value?: string; key?: string }[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent || ''
      if (value) runs.push({ kind: 'text', value })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const field = el.getAttribute('data-field')
    if (field) {
      runs.push({ kind: 'field', key: field })
      return
    }
    if (el.tagName === 'BR') {
      runs.push({ kind: 'text', value: '\n' })
      return
    }
    if (el.tagName === 'DIV' || el.tagName === 'P') {
      if (runs.length && runs[runs.length - 1].kind === 'text' && !runs[runs.length - 1].value?.endsWith('\n')) {
        runs.push({ kind: 'text', value: '\n' })
      }
    }
    Array.from(el.childNodes).forEach(walk)
  }
  Array.from(root.childNodes).forEach(walk)
  return serializeTemplateRuns(
    runs.map((run) =>
      run.kind === 'field' ? { kind: 'field' as const, key: run.key || '' } : { kind: 'text' as const, value: run.value || '' }
    )
  )
}

interface ReceiptFieldPickerProps {
  onSelect: (key: string) => void
  groups?: readonly TemplateVariableGroup[]
}

export function ReceiptFieldPicker({ onSelect, groups = VARIABLE_GROUPS }: ReceiptFieldPickerProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
      >
        <Plus size={12} /> Insert field
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-dark-border-strong bg-white dark:bg-dark-card shadow-lg p-2">
          {groups.map((group) => (
            <div key={group.id} className="mb-2 last:mb-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 px-1.5 py-1">{group.label}</div>
              {group.keys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="w-full text-left text-xs px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-800 dark:text-gray-100"
                  onClick={() => {
                    onSelect(key)
                    setOpen(false)
                  }}
                >
                  {labelForTemplateKey(key)}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

interface ReceiptTokenFieldProps {
  value: string
  onChange: (next: string) => void
  multiline?: boolean
  placeholder?: string
  showInsert?: boolean
}

export function ReceiptTokenField({
  value,
  onChange,
  multiline = false,
  placeholder = 'Type here, or insert a field',
  showInsert = true,
}: ReceiptTokenFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef(value)

  const paint = useCallback((text: string) => {
    if (!editorRef.current) return
    editorRef.current.innerHTML = runsToHtml(text)
  }, [])

  useLayoutEffect(() => {
    paint(value)
    lastEmitted.current = value
    // initial paint only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    paint(value)
  }, [value, paint])

  const emitFromDom = () => {
    if (!editorRef.current) return
    const next = htmlToValue(editorRef.current)
    lastEmitted.current = next
    onChange(next)
  }

  const insertField = (key: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const sel = window.getSelection()
    const span = document.createElement('span')
    span.contentEditable = 'false'
    span.setAttribute('data-field', key)
    span.className = PILL_CLASS
    span.textContent = labelForTemplateKey(key)

    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(span)
      range.setStartAfter(span)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      editor.appendChild(span)
    }
    emitFromDom()
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline={multiline}
          aria-label={placeholder}
          data-placeholder={placeholder}
          contentEditable
          suppressContentEditableWarning
          className={`w-full px-2 py-1.5 border border-gray-300 dark:border-dark-border-strong rounded-lg bg-white dark:bg-dark-elevated text-xs min-h-[2.1rem] ${
            multiline ? 'min-h-[4.5rem]' : ''
          } focus:outline-none focus:ring-2 focus:ring-blue-500/30 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none`}
          onInput={emitFromDom}
          onBlur={emitFromDom}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (!multiline) return
              document.execCommand('insertLineBreak')
              emitFromDom()
            }
          }}
        />
      </div>
      {showInsert ? <ReceiptFieldPicker onSelect={insertField} /> : null}
    </div>
  )
}
