import { Plus, Copy, Trash2, CheckCircle2 } from 'lucide-react'
import type { CustomReceiptTemplate } from '@/types/customReceipt'

interface ReceiptTemplateHubProps {
  templates: CustomReceiptTemplate[]
  activeId: string | null
  selectedId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onActivate: (id: string) => void
  isSaving?: boolean
}

export function ReceiptTemplateHub({
  templates,
  activeId,
  selectedId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onActivate,
  isSaving,
}: ReceiptTemplateHubProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Receipt Templates</h3>
        <button
          type="button"
          onClick={onCreate}
          disabled={isSaving}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-400 text-xs font-semibold transition-colors"
        >
          <Plus size={14} /> New
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {templates.map((t) => {
          const selected = t.id === selectedId
          const active = t.id === activeId
          return (
            <div
              key={t.id}
              className={`flex-shrink-0 min-w-[160px] rounded-xl border p-3 cursor-pointer transition-all ${
                selected
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/50 dark:border-blue-500/80 shadow-sm shadow-blue-500/10'
                  : 'border-gray-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/50 hover:border-blue-400/40 dark:hover:border-blue-500/40'
              }`}
              onClick={() => onSelect(t.id)}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate text-gray-900 dark:text-gray-100">{t.name}</div>
                  <div className="text-[10px] text-gray-500">{t.paperWidth} · {t.entries.length} blocks</div>
                </div>
                {active ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : null}
              </div>
              <div className="flex gap-1 mt-2">
                {!active ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onActivate(t.id) }} className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">Activate</button>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">Active</span>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(t.id) }} className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-elevated rounded"><Copy size={12} /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this template?')) onDelete(t.id) }} className="p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"><Trash2 size={12} /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
