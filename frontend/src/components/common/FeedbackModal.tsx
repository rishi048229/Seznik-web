import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Star } from 'lucide-react'
import { submitFeedback } from '@/services/feedbackService'
import toast from 'react-hot-toast'

const AREA_OPTIONS = [
  { value: 'general', label: 'General / Overall' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'pos', label: 'Billing / POS' },
  { value: 'products', label: 'Products & Inventory' },
  { value: 'categories', label: 'Categories' },
  { value: 'customers', label: 'Customers' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'sales', label: 'Sales History' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'credits', label: 'Credits / Daybook' },
  { value: 'reports', label: 'Reports' },
  { value: 'printers', label: 'Printers & Labels' },
  { value: 'settings', label: 'Settings' },
  { value: 'other', label: 'Something else' },
]

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

export const FeedbackModal = ({ isOpen, onClose }: FeedbackModalProps) => {
  const [area, setArea] = useState('general')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setArea('general')
    setRating(0)
    setHoverRating(0)
    setMessage('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Please write your feedback before submitting')
      return
    }
    setSubmitting(true)
    try {
      await submitFeedback({ area, rating: rating || null, message: message.trim() })
      toast.success('Thank you! Your feedback helps us improve.')
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Help Us Be Better"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!message.trim()}>
            Send Feedback
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Tell us what's working, what's confusing, or what you wish Seznik could do. Every message goes straight to the team.
        </p>

        <Select
          label="What is this about?"
          options={AREA_OPTIONS}
          value={area}
          onChange={e => setArea(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            How's your experience? <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star === rating ? 0 : star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110 active:scale-95"
                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              >
                <Star
                  size={26}
                  className={
                    star <= (hoverRating || rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-300 dark:text-gray-600'
                  }
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                {rating}/5
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Your feedback *
          </label>
          <textarea
            rows={4}
            maxLength={2000}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="What can we improve? What do you need that's missing?"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            autoFocus
          />
          <p className="text-[11px] text-gray-400 mt-1 text-right">{message.length}/2000</p>
        </div>
      </div>
    </Modal>
  )
}
