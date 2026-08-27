import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Star, Search, ChevronDown } from 'lucide-react'
import { submitFeedback } from '@/services/feedbackService'
import { SEZNIK_WEBSITE_PRODUCTS } from '@/data/seznikWebsiteProducts'
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
  const [productId, setProductId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productOpen, setProductOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const productPickerRef = useRef<HTMLDivElement>(null)

  const selectedProduct = useMemo(
    () => SEZNIK_WEBSITE_PRODUCTS.find((p) => p.id === productId),
    [productId]
  )

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return SEZNIK_WEBSITE_PRODUCTS.slice(0, 40)
    return SEZNIK_WEBSITE_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    ).slice(0, 40)
  }, [productSearch])

  useEffect(() => {
    if (!productOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) {
        setProductOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [productOpen])

  const reset = () => {
    setArea('general')
    setProductId('')
    setProductSearch('')
    setProductOpen(false)
    setRating(0)
    setHoverRating(0)
    setMessage('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!productId) {
      toast.error('Please select a product')
      return
    }
    if (!message.trim()) {
      toast.error('Please write your feedback before submitting')
      return
    }
    setSubmitting(true)
    try {
      await submitFeedback({
        area,
        rating: rating || null,
        message: message.trim(),
        platform: 'web',
        productId,
      })
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
      title="Review and suggest"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!message.trim() || !productId}
          >
            Send Feedback
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Tell us what's working, what's confusing, or what you wish Seznik could do. Every message goes straight to the team.
        </p>

        <div ref={productPickerRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Which Seznik product is this about? *
          </label>
          <button
            type="button"
            onClick={() => setProductOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <span className={selectedProduct ? 'text-gray-900 dark:text-gray-100 line-clamp-2' : 'text-gray-400'}>
              {selectedProduct ? selectedProduct.name : 'Search and select a product...'}
            </span>
            <ChevronDown size={18} className="shrink-0 text-gray-400" />
          </button>
          {productOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
              <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search by name, SKU, or category..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />
                </div>
              </div>
              <ul className="max-h-52 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-gray-500">No products found</li>
                ) : (
                  filteredProducts.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setProductId(p.id)
                          setProductOpen(false)
                          setProductSearch('')
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                          productId === p.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.categoryName} · {p.sku}</div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

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
          />
          <p className="text-[11px] text-gray-400 mt-1 text-right">{message.length}/2000</p>
        </div>
      </div>
    </Modal>
  )
}
