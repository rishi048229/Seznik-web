import { useState, useEffect } from 'react'
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

export const InteractivePageTour = ({
  pageKey,
  steps,
  isOpen,
  onClose,
}: InteractivePageTourProps) => {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0)
    }
  }, [isOpen])

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

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Compass size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Interactive Guide
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">
              {currentStep + 1} of {steps.length}
            </Badge>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1"
              aria-label="Close tour"
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

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
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
  )
}
