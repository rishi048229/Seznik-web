import { useState, useRef, useEffect } from 'react'
import { X, Image as ImageIcon, Trash2, RefreshCw, Wand2 } from 'lucide-react'
import { IOSAlert } from '@/components/ui/IOSAlert'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'
import { LogoBackgroundModal } from '@/components/common/LogoBackgroundModal'

function cn(...inputs: unknown[]): string {
  return twMerge(clsx(inputs))
}

const compressImage = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
        }
        const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const compressedBase64 = canvas.toDataURL(format, quality)
        resolve(compressedBase64)
      }
      img.onerror = () => {
        resolve((e.target?.result as string) || '')
      }
      img.src = (e.target?.result as string) || ''
    }
    reader.onerror = () => {
      resolve('')
    }
    reader.readAsDataURL(file)
  })
}

interface ImageUploadProps {
  label?: string
  value?: string
  onChange: (url: string) => void
  onFileSelect?: (file: File) => Promise<string>
  accept?: string
  maxSizeMB?: number
  className?: string
  previewSize?: 'sm' | 'md' | 'lg'
  enableBackgroundCleanup?: boolean
}

export const ImageUpload = ({
  label,
  value,
  onChange,
  onFileSelect,
  accept = 'image/*',
  maxSizeMB = 5,
  className,
  previewSize = 'md',
  enableBackgroundCleanup = false,
}: ImageUploadProps) => {
  const { t } = useLanguage()
  const [preview, setPreview] = useState<string>(value || '')
  const [isUploading, setIsUploading] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [showCleanupModal, setShowCleanupModal] = useState(false)
  const [cleanupSource, setCleanupSource] = useState<File | string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setPreview(value)
    }
  }, [value])

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      setShowLimitModal(true)
      toast.error(t('image.exceedsLimitMsg'))
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    if (enableBackgroundCleanup) {
      setCleanupSource(file)
      setShowCleanupModal(true)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setIsUploading(true)

    try {
      if (onFileSelect) {
        const url = await onFileSelect(file)
        setPreview(url)
        onChange(url)
        setIsUploading(false)
      } else {
        const base64Url = await compressImage(file, 1000, 1000, 0.85)
        setPreview(base64Url)
        onChange(base64Url)
        setIsUploading(false)
      }
    } catch {
      setIsUploading(false)
    }
  }

  const handleOpenCleanupForExisting = () => {
    if (!preview) return
    setCleanupSource(preview)
    setShowCleanupModal(true)
  }

  const handleRemove = () => {
    setPreview('')
    onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'relative rounded-lg border-2 border-dashed border-gray-300 dark:border-dark-border-strong overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors bg-gray-50 dark:bg-dark-elevated flex-shrink-0',
            sizeClasses[previewSize],
            isUploading && 'opacity-50 cursor-wait'
          )}
          onClick={() => !isUploading && inputRef.current?.click()}
        >
          {preview ? (
            <>
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleRemove() }}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-md transition-colors"
                title={t('image.deletePhoto')}
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center text-gray-400">
              <ImageIcon size={20} />
              <span className="text-[10px] mt-1">Upload</span>
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-xs text-gray-400">
            Click to upload. Recommended: JPG, PNG (Max {maxSizeMB}MB)
          </p>
          {preview ? (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-white hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-md transition-colors"
              >
                <RefreshCw size={12} />
                {t('image.changePhoto')}
              </button>
              {enableBackgroundCleanup && (
                <button
                  type="button"
                  onClick={handleOpenCleanupForExisting}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-md transition-colors"
                  title={t('image.cleanLogo')}
                >
                  <Wand2 size={12} />
                  {t('image.cleanLogo')}
                </button>
              )}
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-md transition-colors"
              >
                <Trash2 size={12} />
                {t('image.deletePhoto')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 w-fit inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-white hover:underline"
            >
              + Upload Image
            </button>
          )}
        </div>
      </div>

      {/* Background Detection & Cleanup Modal */}
      {enableBackgroundCleanup && showCleanupModal && (
        <LogoBackgroundModal
          isOpen={showCleanupModal}
          imageSrc={cleanupSource}
          onApply={(dataUrl) => {
            setPreview(dataUrl)
            onChange(dataUrl)
            setShowCleanupModal(false)
            setCleanupSource(null)
          }}
          onCancel={() => {
            setShowCleanupModal(false)
            setCleanupSource(null)
          }}
        />
      )}

      <IOSAlert
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        title={t('image.exceedsLimitTitle')}
        message={t('image.exceedsLimitMsg')}
      />
    </div>
  )
}
