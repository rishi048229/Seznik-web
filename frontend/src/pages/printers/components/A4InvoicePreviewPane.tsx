import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Printer,
  ExternalLink,
  FileText,
  X,
  RotateCcw,
} from 'lucide-react'
import { downloadA4InvoicePdf } from '@/utils/a4Invoice'

interface A4InvoicePreviewPaneProps {
  previewHtml: string
  innerHtml: string
  templateName: string
  paperSize?: 'A4' | 'Letter'
}

export function A4InvoicePreviewPane({
  previewHtml,
  innerHtml,
  templateName,
  paperSize = 'A4',
}: A4InvoicePreviewPaneProps) {
  const isLetter = paperSize === 'Letter'
  // Standard 96 DPI CSS pixel dimensions
  // A4: 210mm x 297mm = 793.7px x 1122.5px
  // Letter: 8.5in x 11in = 816px x 1056px
  const NATIVE_WIDTH = isLetter ? 816 : 794
  const NATIVE_HEIGHT = isLetter ? 1056 : 1123

  const stageRef = useRef<HTMLDivElement>(null)
  const modalStageRef = useRef<HTMLDivElement>(null)

  const [containerWidth, setContainerWidth] = useState<number>(440)
  const [zoomMode, setZoomMode] = useState<'fit' | 'custom'>('fit')
  const [customZoom, setCustomZoom] = useState<number>(1.0)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [modalScale, setModalScale] = useState<number>(0.85)
  const [modalZoomMode, setModalZoomMode] = useState<'fit' | 'custom'>('fit')

  // Measure stage width
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth)
      }
    }

    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Close expanded modal on Escape
  useEffect(() => {
    if (!isExpanded) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  // Measure modal container for auto-fitting
  useLayoutEffect(() => {
    if (!isExpanded) return
    const el = modalStageRef.current
    if (!el) return

    const updateModalSize = () => {
      const availW = Math.max(300, el.clientWidth - 48)
      const availH = Math.max(400, el.clientHeight - 48)
      if (modalZoomMode === 'fit') {
        const scaleW = availW / NATIVE_WIDTH
        const scaleH = availH / NATIVE_HEIGHT
        const bestFit = Math.min(scaleW, scaleH, 1.15)
        setModalScale(Math.max(0.35, Math.round(bestFit * 100) / 100))
      }
    }

    updateModalSize()
    const ro = new ResizeObserver(updateModalSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isExpanded, modalZoomMode, NATIVE_WIDTH, NATIVE_HEIGHT])

  // Calculate effective inline scale
  const availableWidth = Math.max(260, containerWidth - 32)
  const fitScale = Math.min(1.0, Math.max(0.25, Math.round((availableWidth / NATIVE_WIDTH) * 100) / 100))
  const effectiveScale = zoomMode === 'fit' ? fitScale : customZoom

  const sheetWidth = Math.round(NATIVE_WIDTH * effectiveScale)
  const sheetHeight = Math.round(NATIVE_HEIGHT * effectiveScale)

  const handleZoomIn = () => {
    setZoomMode('custom')
    setCustomZoom(prev => Math.min(1.6, Math.round((prev + 0.1) * 10) / 10))
  }

  const handleZoomOut = () => {
    setZoomMode('custom')
    setCustomZoom(prev => Math.max(0.3, Math.round((prev - 0.1) * 10) / 10))
  }

  const handleResetZoom = () => {
    if (zoomMode === 'fit') {
      setZoomMode('custom')
      setCustomZoom(1.0)
    } else {
      setZoomMode('fit')
    }
  }

  const handlePrint = () => {
    downloadA4InvoicePdf(innerHtml, `${templateName}_Invoice`, paperSize)
  }

  return (
    <div className="flex flex-col w-full space-y-2.5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50 font-bold text-[11px]">
            <FileText size={12} className="shrink-0" />
            <span>{paperSize}</span>
            <span className="font-normal opacity-70">
              ({isLetter ? '8.5 × 11 in' : '210 × 297 mm'})
            </span>
          </span>
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 hidden sm:inline truncate">
            {templateName}
          </span>
        </div>

        {/* Zoom & Action buttons */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={effectiveScale <= 0.3}
              title="Zoom out"
              aria-label="Zoom out"
              className="p-1 rounded text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-elevated disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title={zoomMode === 'fit' ? 'Click for 100% view' : 'Click to Fit Width'}
              className="px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-dark-elevated rounded transition-colors min-w-[42px] text-center"
            >
              {zoomMode === 'fit' ? 'Fit' : `${Math.round(effectiveScale * 100)}%`}
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={effectiveScale >= 1.6}
              title="Zoom in"
              aria-label="Zoom in"
              className="p-1 rounded text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-elevated disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            title="Print test invoice or open PDF dialog"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-elevated transition-colors shadow-2xs flex items-center gap-1 text-[11px] font-semibold"
          >
            <Printer size={14} className="text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            title="Expand to full screen"
            aria-label="Expand to full screen"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-elevated transition-colors shadow-2xs"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Main Drafting Canvas Stage */}
      <div
        ref={stageRef}
        className="w-full rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-100 dark:bg-[#0c1017] p-3 sm:p-4 overflow-auto max-h-[min(740px,calc(100vh-14rem))] scrollbar-thin flex justify-center items-start shadow-inner"
      >
        <div
          className="relative transition-all duration-150 mx-auto"
          style={{
            width: sheetWidth,
            height: sheetHeight,
            minWidth: sheetWidth,
            minHeight: sheetHeight,
          }}
        >
          <div
            className="absolute top-0 left-0 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.7)] ring-1 ring-slate-900/5 dark:ring-white/10 rounded-xs overflow-hidden"
            style={{
              width: NATIVE_WIDTH,
              height: NATIVE_HEIGHT,
              transform: `scale(${effectiveScale})`,
              transformOrigin: 'top left',
            }}
          >
            <iframe
              title="A4 invoice preview"
              srcDoc={previewHtml}
              className="w-full h-full bg-white pointer-events-auto"
              style={{
                width: `${NATIVE_WIDTH}px`,
                height: `${NATIVE_HEIGHT}px`,
                border: 0,
              }}
            />
          </div>
        </div>
      </div>

      {/* Quick status bar */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-zinc-400">
        <span>Click <strong>Print</strong> to test system print dialog.</span>
        <button
          type="button"
          onClick={() => {
            setZoomMode('custom')
            setCustomZoom(1.0)
          }}
          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
        >
          View at 100% scale
        </button>
      </div>

      {/* Full-Screen Expanded Preview Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-[100] bg-black/75 dark:bg-black/85 backdrop-blur-md flex flex-col animate-in fade-in duration-150">
          {/* Modal Header */}
          <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900/90 border-b border-slate-800 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>{templateName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600/40 text-blue-200 border border-blue-500/40 uppercase">
                    {paperSize} Full Preview
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Full resolution print proof. Adjust zoom or print directly.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Modal Zoom Controls */}
              <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800/80 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setModalZoomMode('custom')
                    setModalScale(prev => Math.max(0.3, Math.round((prev - 0.1) * 10) / 10))
                  }}
                  disabled={modalScale <= 0.3}
                  title="Zoom out"
                  className="p-1.5 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalZoomMode(prev => (prev === 'fit' ? 'custom' : 'fit'))
                    if (modalZoomMode === 'fit') setModalScale(1.0)
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-700 rounded min-w-[48px] text-center"
                >
                  {modalZoomMode === 'fit' ? 'Fit' : `${Math.round(modalScale * 100)}%`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalZoomMode('custom')
                    setModalScale(prev => Math.min(1.8, Math.round((prev + 0.1) * 10) / 10))
                  }}
                  disabled={modalScale >= 1.8}
                  title="Zoom in"
                  className="p-1.5 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                >
                  <ZoomIn size={15} />
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer size={15} />
                <span>Print Bill</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                title="Close full preview (Esc)"
                aria-label="Close"
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* Modal Scroll Canvas */}
          <div
            ref={modalStageRef}
            className="flex-1 overflow-auto p-6 sm:p-8 flex justify-center items-start scrollbar-thin"
          >
            <div
              className="relative transition-all duration-150 mx-auto"
              style={{
                width: Math.round(NATIVE_WIDTH * modalScale),
                height: Math.round(NATIVE_HEIGHT * modalScale),
                minWidth: Math.round(NATIVE_WIDTH * modalScale),
                minHeight: Math.round(NATIVE_HEIGHT * modalScale),
              }}
            >
              <div
                className="absolute top-0 left-0 bg-white shadow-2xl ring-1 ring-white/10 rounded-xs overflow-hidden"
                style={{
                  width: NATIVE_WIDTH,
                  height: NATIVE_HEIGHT,
                  transform: `scale(${modalScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <iframe
                  title="A4 invoice full modal preview"
                  srcDoc={previewHtml}
                  className="w-full h-full bg-white pointer-events-auto"
                  style={{
                    width: `${NATIVE_WIDTH}px`,
                    height: `${NATIVE_HEIGHT}px`,
                    border: 0,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
