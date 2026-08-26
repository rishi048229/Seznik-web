import type { CustomReceiptTemplate } from '@/types/customReceipt'
import type { ReceiptPrintContext } from '@/utils/customReceiptEngine'
import { CustomReceiptPreview } from './CustomReceiptPreview'
import { getReceiptPreviewMaxWidth } from './receiptPreviewStyles'

interface ReceiptLivePreviewPanelProps {
  template: CustomReceiptTemplate
  context: ReceiptPrintContext
  compactMode?: boolean
  className?: string
}

export function ReceiptLivePreviewPanel({
  template,
  context,
  compactMode = false,
  className = '',
}: ReceiptLivePreviewPanelProps) {
  const paperWidth = template.paperWidth || '58mm'
  const previewPaperMaxPx = getReceiptPreviewMaxWidth(paperWidth)

  return (
    <div className={`w-full flex flex-col min-w-0 max-w-full self-start ${className}`}>
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Live Preview — {paperWidth}</span>
        {compactMode ? (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
            Compact Mode
          </span>
        ) : null}
      </div>

      <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 p-3 sm:p-4 overflow-hidden">
        <div className="max-h-[min(640px,calc(100dvh-12rem))] overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin">
          <div
            className="mx-auto flex flex-col items-stretch max-w-full min-w-0"
            style={{ width: `min(100%, ${previewPaperMaxPx}px)` }}
          >
            <CustomReceiptPreview template={template} context={context} />
            <div
              className="h-3 w-full bg-white shrink-0"
              style={{
                backgroundImage: 'radial-gradient(circle at 6px 12px, rgb(241 245 249) 6px, transparent 6.5px)',
                backgroundSize: '12px 12px',
                backgroundRepeat: 'repeat-x',
                backgroundPosition: '0 -6px',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
