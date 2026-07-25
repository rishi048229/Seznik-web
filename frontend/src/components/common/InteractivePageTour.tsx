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

    // Small delay to allow scroll and rendering
    const timer = setTimeout(updateRect, 150)
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

  // Calculate popover positioning relative to targetRect
  const getPopoverStyle = () => {
    if (!targetRect) {
      return {
        bottom: '24px',
        right: '24px',
      }
    }

    const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height)
    const spaceAbove = targetRect.top

    let top = 0
    let left = Math.max(16, Math.min(targetRect.left, window.innerWidth - 380))

    if (spaceBelow > 260) {
      // Place below target
      top = targetRect.top + targetRect.height + 14
    } else if (spaceAbove > 260) {
      // Place above target
      top = Math.max(16, targetRect.top - 240)
    } else {
      // Fallback
      top = Math.max(16, Math.min(targetRect.top, window.innerHeight - 260))
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    }
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Background Dimmed Overlay */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto transition-opacity duration-300" />

      {/* Spotlight Ring Highlight Box */}
      {targetRect && (
        <div
          className="absolute rounded-xl ring-4 ring-indigo-500 ring-offset-2 ring-offset-slate-900 shadow-2xl transition-all duration-300 pointer-events-none z-50 animate-pulse"
          style={{
            top: `${Math.max(0, targetRect.top - 6)}px`,
            left: `${Math.max(0, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        />
      )}

      {/* Tour Step Popover Card */}
      <div
        ref={popoverRef}
        style={getPopoverStyle()}
        className="fixed z-50 max-w-sm w-[calc(100vw-32px)] sm:w-[380px] pointer-events-auto transition-all duration-300"
      >
        <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Compass size={18} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Guided Feature Tour
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="info">
                {currentStep + 1} of {steps.length}
              </Badge>
              <button
                onClick={handleFinish}
                className="text-slate-400 hover:text-white transition-colors p-1"
                aria-label="Skip tour"
                title="Skip Tour"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Step Content */}
          <div className="space-y-1.5">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              {step.title}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Navigation & Skip Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
            <button
              type="button"
              onClick={handleFinish}
              className="text-xs text-slate-400 hover:text-slate-200 underline font-medium px-1"
            >
              Skip Tour
            </button>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                disabled={isFirst}
                className="text-slate-300 hover:text-white"
                leftIcon={<ChevronLeft size={14} />}
              >
                Back
              </Button>

              {!isLast ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleFinish}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
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
