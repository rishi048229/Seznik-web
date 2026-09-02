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
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0a0a2e] dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold"
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
                selected ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card'
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
                  <button type="button" onClick={(e) => { e.stopPropagation(); onActivate(t.id) }} className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Activate</button>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Active</span>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(t.id) }} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><Copy size={12} /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this template?')) onDelete(t.id) }} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
