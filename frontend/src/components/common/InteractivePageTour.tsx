import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Compass, ChevronRight, ChevronLeft, CheckCircle2, X } from 'lucide-react'
import type { TourStep } from '@/data/pageTutorials'

interface InteractivePageTourProps {
  pageKey: string
  steps: TourStep[]
  isOpen: boolean
  onClose: () => void
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

export const InteractivePageTour = ({
  pageKey,
  steps,
  isOpen,
  onClose,
}: InteractivePageTourProps) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [arrowPosition, setArrowPosition] = useState<'top' | 'bottom'>('top')
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0)
    }
  }, [isOpen])

  // Update target element bounds and scroll target into view when step changes
  useEffect(() => {
    if (!isOpen || !steps || steps.length === 0) {
      setTargetRect(null)
      return
    }

    const step = steps[currentStep]
    if (!step?.targetSelector) {
      setTargetRect(null)
      return
    }

    const updateRect = () => {
      const el = document.querySelector(step.targetSelector!)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        const rect = el.getBoundingClientRect()
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        })
      } else {
        setTargetRect(null)
      }
    }

    const timer = setTimeout(updateRect, 180)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect)
    }
  }, [isOpen, currentStep, steps])

  if (!isOpen || !steps || steps.length === 0) return null

  const step = steps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  const handleFinish = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`seznik_tour_completed_${pageKey}`, 'true')
    }
    onClose()
  }

  // Calculate speech bubble popover positioning OUTSIDE target element
  const getPopoverStyle = () => {
    if (!targetRect) {
      return {
        bottom: '24px',
        right: '24px',
      }
    }

    const popoverWidth = Math.min(340, window.innerWidth - 32)
    const popoverHeight = 180

    const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height)
    const spaceAbove = targetRect.top

    let top = 0
    let left = targetRect.left + targetRect.width / 2 - popoverWidth / 2

    // Bound horizontal position within viewport
    left = Math.max(16, Math.min(left, window.innerWidth - popoverWidth - 16))

    if (spaceBelow >= popoverHeight + 20) {
      // Place BELOW target element
      top = targetRect.top + targetRect.height + 14
      if (arrowPosition !== 'top') setArrowPosition('top')
    } else if (spaceAbove >= popoverHeight + 20) {
      // Place ABOVE target element
      top = Math.max(16, targetRect.top - popoverHeight - 14)
      if (arrowPosition !== 'bottom') setArrowPosition('bottom')
    } else {
      // Side fallback
      top = Math.max(16, Math.min(targetRect.top, window.innerHeight - popoverHeight - 16))
      if (arrowPosition !== 'top') setArrowPosition('top')
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
    }
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Background Dimmed Overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto transition-opacity duration-300" />

      {/* Spotlight Ring Highlight Box */}
      {targetRect && (
        <div
          className="absolute rounded-xl ring-4 ring-indigo-500 ring-offset-2 ring-offset-slate-900 shadow-2xl transition-all duration-300 pointer-events-none z-50 animate-pulse bg-indigo-500/10"
          style={{
            top: `${Math.max(0, targetRect.top - 4)}px`,
            left: `${Math.max(0, targetRect.left - 4)}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
          }}
        />
      )}

      {/* Speech Bubble Popover */}
      <div
        ref={popoverRef}
        style={getPopoverStyle()}
        className="fixed z-50 pointer-events-auto transition-all duration-300 animate-in fade-in zoom-in-95"
      >
        <div className="relative bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-4 space-y-3">
          {/* Arrow Beak */}
          {targetRect && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 border-slate-700 rotate-45 ${
                arrowPosition === 'top'
                  ? '-top-2 border-t border-l'
                  : '-bottom-2 border-b border-r'
              }`}
            />
          )}

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 relative z-10">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-indigo-500/20 text-indigo-400">
                <Compass size={16} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                Guide
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="info" className="text-[10px] px-2 py-0.5">
                {currentStep + 1} / {steps.length}
              </Badge>
              <button
                onClick={handleFinish}
                className="text-slate-400 hover:text-white transition-colors p-0.5"
                aria-label="Skip tour"
                title="Skip Tour"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Step Content */}
          <div className="space-y-1 relative z-10">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              {step.title}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Controls Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2 relative z-10">
            <button
              type="button"
              onClick={handleFinish}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline font-medium"
            >
              Skip Tour
            </button>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                disabled={isFirst}
                className="text-slate-300 hover:text-white text-xs px-2.5 py-1 h-8"
                leftIcon={<ChevronLeft size={14} />}
              >
                Back
              </Button>

              {!isLast ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 text-xs px-3 py-1 h-8"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleFinish}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1 h-8"
                  leftIcon={<CheckCircle2 size={14} />}
                >
                  Got It!
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
