import { useEffect, useState } from 'react'
import { CheckCircle2, Printer, Sparkles, X } from 'lucide-react'
import { formatINR } from '@/utils/currency'

interface PrinterAnimationModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceNumber?: string
  grandTotal?: number
  businessName?: string
  itemCount?: number
  autoCloseMs?: number
}

export const PrinterAnimationModal = ({
  isOpen,
  onClose,
  invoiceNumber = 'INV-1001',
  grandTotal = 0,
  businessName = 'Seznik Store',
  itemCount = 1,
  autoCloseMs = 3500,
}: PrinterAnimationModalProps) => {
  const [phase, setPhase] = useState<'printing' | 'cutting' | 'done'>('printing')

  useEffect(() => {
    if (!isOpen) {
      setPhase('printing')
      return
    }

    setPhase('printing')

    const timer1 = setTimeout(() => {
      setPhase('cutting')
    }, 1800)

    const timer2 = setTimeout(() => {
      setPhase('done')
    }, 2600)

    const timer3 = setTimeout(() => {
      onClose()
    }, autoCloseMs)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [isOpen, autoCloseMs, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl overflow-hidden text-center text-white flex flex-col items-center">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-6">
          {phase === 'printing' && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Printing Receipt...</span>
            </>
          )}
          {phase === 'cutting' && (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Cutting Thermal Paper...</span>
            </>
          )}
          {phase === 'done' && (
            <>
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-emerald-400">Receipt Ready!</span>
            </>
          )}
        </div>

        {/* 3D Mini Printer Container */}
        <div className="relative w-64 flex flex-col items-center">
          
          {/* Printer Top Slot Box */}
          <div className="relative z-20 w-56 h-20 bg-gradient-to-b from-gray-800 to-gray-950 rounded-t-2xl border border-gray-700 shadow-lg p-3 flex flex-col justify-between items-center">
            {/* Top slot LED indicators */}
            <div className="w-full flex justify-between items-center px-2">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${phase === 'printing' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-emerald-600'}`} />
                <span className="text-[10px] text-gray-400 font-mono">POWER</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${phase === 'printing' ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]' : 'bg-gray-600'}`} />
                <span className="text-[10px] text-gray-400 font-mono">DATA</span>
              </div>
            </div>

            {/* Printer Paper Eject Slot */}
            <div className="relative w-44 h-2.5 bg-black rounded-full border border-gray-700 shadow-inner flex justify-center items-center overflow-hidden">
              <div className="w-full h-full bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-pulse" />
            </div>

            <div className="text-[9px] font-mono tracking-widest text-gray-500 uppercase font-semibold">
              SEZNIK THERMAL 58MM
            </div>
          </div>

          {/* Animated Receipt Paper Ejecting Out of Slot */}
          <div className="relative z-10 w-48 overflow-hidden transition-all -mt-1 duration-500">
            <div
              className={`w-full bg-white text-gray-900 p-3 shadow-xl rounded-b-lg font-mono text-[10px] border-x border-b border-gray-300 transition-all duration-1000 ease-out origin-top ${
                phase === 'printing'
                  ? 'translate-y-0 opacity-100 max-h-56 animate-[printSlide_1.5s_ease-out_forwards]'
                  : 'translate-y-0 opacity-100 max-h-56'
              }`}
            >
              {/* Receipt Header */}
              <div className="text-center pb-2 border-b border-dashed border-gray-400">
                <div className="font-bold text-xs uppercase tracking-tight">{businessName}</div>
                <div className="text-[9px] text-gray-500">OFFICIAL RECEIPT</div>
              </div>

              {/* Receipt Meta */}
              <div className="py-2 border-b border-dashed border-gray-300 space-y-0.5 text-[9px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice:</span>
                  <span className="font-bold">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Items:</span>
                  <span>{itemCount} item(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span>{new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                </div>
              </div>

              {/* Receipt Total */}
              <div className="py-2 border-b border-dashed border-gray-400">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>TOTAL PAID</span>
                  <span className="text-emerald-700">{formatINR(grandTotal)}</span>
                </div>
              </div>

              {/* Barcode graphic */}
              <div className="pt-2 flex flex-col items-center gap-1 opacity-80">
                <div className="flex items-center gap-0.5 h-6">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full bg-black ${i % 3 === 0 ? 'w-1' : i % 2 === 0 ? 'w-0.5' : 'w-1.5'}`}
                    />
                  ))}
                </div>
                <span className="text-[8px] tracking-widest text-gray-500">*** THANK YOU ***</span>
              </div>

              {/* Zig-Zag Tear Edge */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1.5 bg-repeat-x"
                style={{
                  backgroundImage: `radial-gradient(circle, transparent, transparent 50%, white 50%, white 100%)`,
                  backgroundSize: '8px 8px',
                }}
              />
            </div>
          </div>

          {/* Printer Body Base */}
          <div className="w-60 h-8 bg-gray-950 rounded-b-2xl border-t border-gray-800 shadow-2xl flex items-center justify-between px-6 -mt-0.5 z-20">
            <Printer size={14} className="text-indigo-400" />
            <div className="flex items-center gap-1 text-[9px] text-gray-500 font-mono">
              <Sparkles size={10} className="text-amber-400" />
              HIGH SPEED THERMAL
            </div>
          </div>
        </div>

        {/* Helper footer */}
        <p className="text-xs text-gray-400 mt-6 font-medium">
          {phase === 'done' ? 'Sending print command to printer device...' : 'Generating thermal print output...'}
        </p>

      </div>
    </div>
  )
}
