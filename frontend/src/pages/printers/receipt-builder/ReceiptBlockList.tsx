import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import type { CustomReceiptEntry } from '@/types/customReceipt'
import { BLOCK_TYPE_LABELS } from '@/types/customReceipt'
import { humanizeTemplateText } from '@/utils/receiptTemplateTokens'
import { inferQrPurpose } from './receiptSimpleSections'

function blockSummary(entry: CustomReceiptEntry): string {
  switch (entry.type) {
    case 'text':
    case 'text_special':
      return humanizeTemplateText(entry.text || '').slice(0, 48) || 'Text line'
    case 'left_right_text':
      return `${humanizeTemplateText(entry.left)} / ${humanizeTemplateText(entry.right)}`.slice(0, 48)
    case 'table':
      return entry.tableType === 'advanced' ? 'Advanced items table' : 'Simple items table'
    case 'barcode': {
      const purpose = inferQrPurpose(entry)
      if (purpose === 'upi') return 'UPI payment QR'
      if (purpose === 'invoice_barcode') return 'Invoice barcode'
      if (purpose === 'digital_bill') return 'Digital bill QR'
      return humanizeTemplateText(entry.value || '') || 'Custom QR'
    }
    case 'image':
      return 'Logo / image'
    case 'horizontal_line':
      return `${entry.lineStyle} line`
    case 'multi_format':
      return humanizeTemplateText((entry.segments || []).map((s) => s.text).join(' ')).slice(0, 48) || 'Mixed line'
    case 'files_note':
      return humanizeTemplateText(entry.title || entry.content || 'Note').slice(0, 48)
    default:
      return 'Block'
  }
}

interface SortableBlockProps {
  entry: CustomReceiptEntry
  index: number
  total: number
  expanded: boolean
  onToggle: (enabled: boolean) => void
  onExpand: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  editor: React.ReactNode
}

function SortableBlock({
  entry,
  index,
  total,
  expanded,
  onToggle,
  onExpand,
  onDelete,
  onMove,
  editor,
}: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: entry.enabled ? 1 : 0.55,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white dark:bg-dark-card ${isDragging ? 'border-blue-500 shadow-lg z-10' : 'border-gray-200 dark:border-dark-border'}`}
    >
      <div className="flex items-center gap-2 p-3">
        <button type="button" className="cursor-grab text-gray-400 hover:text-gray-600 touch-none" {...attributes} {...listeners}>
          <GripVertical size={18} />
        </button>
        <button type="button" onClick={onExpand} className="flex-1 text-left min-w-0">
          <div className="text-xs font-bold text-gray-900 dark:text-gray-100">{BLOCK_TYPE_LABELS[entry.type]}</div>
          <div className="text-[11px] text-gray-500 truncate">{blockSummary(entry)}</div>
        </button>
        <Switch checked={entry.enabled} onChange={onToggle} label="" />
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="p-1 text-gray-400 disabled:opacity-30"><ChevronUp size={16} /></button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 text-gray-400 disabled:opacity-30"><ChevronDown size={16} /></button>
        <button type="button" onClick={onDelete} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
      </div>
      {expanded ? <div className="px-3 pb-3 border-t border-gray-100 dark:border-dark-border pt-3">{editor}</div> : null}
    </div>
  )
}

interface ReceiptBlockListProps {
  entries: CustomReceiptEntry[]
  expandedId: string | null
  onReorder: (entries: CustomReceiptEntry[]) => void
  onToggle: (id: string, enabled: boolean) => void
  onExpand: (id: string | null) => void
  onDelete: (id: string) => void
  renderEditor: (entry: CustomReceiptEntry) => React.ReactNode
}

export function ReceiptBlockList({
  entries,
  expandedId,
  onReorder,
  onToggle,
  onExpand,
  onDelete,
  renderEditor,
}: ReceiptBlockListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = entries.findIndex((e) => e.id === active.id)
    const newIndex = entries.findIndex((e) => e.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(entries, oldIndex, newIndex))
  }

  const move = (id: string, dir: -1 | 1) => {
    const idx = entries.findIndex((e) => e.id === id)
    const next = idx + dir
    if (idx < 0 || next < 0 || next >= entries.length) return
    onReorder(arrayMove(entries, idx, next))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <SortableBlock
              key={entry.id}
              entry={entry}
              index={index}
              total={entries.length}
              expanded={expandedId === entry.id}
              onToggle={(v) => onToggle(entry.id, v)}
              onExpand={() => onExpand(expandedId === entry.id ? null : entry.id)}
              onDelete={() => onDelete(entry.id)}
              onMove={(dir) => move(entry.id, dir)}
              editor={renderEditor(entry)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
