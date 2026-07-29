import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Video, Sparkles, CheckCircle2, Lightbulb, Compass } from 'lucide-react'
import type { PageTutorialData } from '@/data/pageTutorials'

interface PageVideoTutorialModalProps {
  isOpen: boolean
  onClose: () => void
  tutorial: PageTutorialData
  onStartTour?: () => void
}

export const PageVideoTutorialModal = ({
  isOpen,
  onClose,
  tutorial,
  onStartTour,
}: PageVideoTutorialModalProps) => {
  const [videoError, setVideoError] = useState(false)
  const [_isPlaying, setIsPlaying] = useState(false)


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tutorial.title} size="lg">
      <div className="space-y-6">
        {/* Subtitle */}
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {tutorial.subtitle}
        </p>

        {/* Video Player Box / Placeholder */}
        <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 shadow-lg aspect-video flex items-center justify-center group">
          {!videoError ? (
            <video
              src={tutorial.videoUrl}
              poster={tutorial.videoPoster}
              controls
              playsInline
              className="w-full h-full object-cover"
              onError={() => setVideoError(true)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            /* Video Placeholder State when video recording is pending */
            <div className="p-6 text-center flex flex-col items-center justify-center space-y-3 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white w-full h-full">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 animate-pulse">
                <Video size={32} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                  <span>Video Guide Coming Soon</span>
                  <Badge variant="info">In Progress</Badge>
                </h4>
                <p className="text-xs text-gray-300 max-w-md mt-1 leading-relaxed">
                  Video tutorial for <strong className="text-indigo-300">{tutorial.title}</strong> is being recorded. Review the feature guide and interactive tour below!
                </p>
              </div>
              {onStartTour && (
                <Button
                  size="sm"
                  onClick={() => {
                    onClose()
                    onStartTour()
                  }}
                  className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                  leftIcon={<Compass size={16} />}
                >
                  Start Interactive Guided Tour
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Summary Description */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
          <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed">
            {tutorial.summary}
          </p>
        </div>

        {/* Key Features Section */}
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            Key Features & Capabilities
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tutorial.keyFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-start gap-3"
              >
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {feat.title}
                  </h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pro Tips Section */}
        {tutorial.proTips.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-600 dark:text-amber-400" />
              Pro Tips
            </h4>
            <ul className="space-y-1.5 text-xs text-amber-800 dark:text-amber-300 list-disc list-inside">
              {tutorial.proTips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Footer Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {onStartTour && (
            <Button
              variant="outline"
              onClick={() => {
                onClose()
                onStartTour()
              }}
              leftIcon={<Compass size={16} />}
              className="flex-1"
            >
              Start Step-by-Step Tour
            </Button>
          )}
          <Button onClick={onClose} className="flex-1">
            Got It
          </Button>
        </div>
      </div>
    </Modal>
  )
}
