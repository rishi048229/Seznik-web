import { useState, useRef, useEffect } from 'react'
import { X, Image as ImageIcon, AlertTriangle, Trash2, RefreshCw, Wand2, Eye, Maximize2, Crop, Scan } from 'lucide-react'
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
  aspectRatio?: 'square' | 'banner' | 'auto'
  defaultFit?: 'contain' | 'cover'
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
  aspectRatio = 'square',
  defaultFit = 'contain',
  enableBackgroundCleanup = false,
}: ImageUploadProps) => {
  const { t } = useLanguage()
  const [preview, setPreview] = useState<string>(value || '')
  const [isUploading, setIsUploading] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [showFullView, setShowFullView] = useState(false)
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>(defaultFit)
  const [bgModalFile, setBgModalFile] = useState<File | string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setPreview(value)
    }
  }, [value])

  const sizeClasses = {
    square: {
      sm: 'w-16 h-16',
      md: 'w-24 h-24',
      lg: 'w-32 h-32',
    },
    banner: {
      sm: 'w-24 h-16',
      md: 'w-36 h-24',
      lg: 'w-48 sm:w-56 h-28',
    },
    auto: {
      sm: 'min-w-[4rem] max-w-[6rem] h-16',
      md: 'min-w-[6rem] max-w-[10rem] h-24',
      lg: 'min-w-[8rem] max-w-[14rem] h-28',
    },
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
      setBgModalFile(file)
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
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 min-w-0">
        <div
          className={cn(
            'group relative rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-500/80 transition-all bg-slate-50 dark:bg-dark-card flex-shrink-0 shadow-2xs',
            sizeClasses[aspectRatio][previewSize],
            isUploading && 'opacity-50 cursor-wait'
          )}
          onClick={() => {
            if (isUploading) return
            if (preview) {
              setShowFullView(true)
            } else {
              inputRef.current?.click()
            }
          }}
          title={preview ? 'Click to view full image' : 'Click to upload image'}
        >
          {preview ? (
            <>
              {/* Checkerboard backdrop for transparent/white logos */}
              <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:8px_8px] opacity-70 pointer-events-none" />

              <img
                src={preview}
                alt="Preview"
                className={cn(
                  'w-full h-full relative z-1 transition-all duration-200 select-none',
                  fitMode === 'contain' ? 'object-contain p-2' : 'object-cover'
                )}
              />

              {/* Hover overlay hint */}
              <div className="absolute inset-0 z-2 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-medium pointer-events-none">
                <Maximize2 size={14} />
                <span>View Full</span>
              </div>

              {/* Top-Right Quick Delete Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer"
                title={t('image.deletePhoto')}
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center text-gray-400 dark:text-gray-500">
              <ImageIcon size={22} className="stroke-[1.5]" />
              <span className="text-[11px] font-medium mt-1">Upload</span>
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-2xs flex items-center justify-center">
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
            <div className="space-y-1.5 mt-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullView(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200 dark:hover:bg-zinc-700/60 px-2.5 py-1 rounded-md transition-colors"
                  title="View full image in popup"
                >
                  <Eye size={13} />
                  <span>View Full</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFitMode(fitMode === 'contain' ? 'cover' : 'contain')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200 dark:hover:bg-zinc-700/60 px-2.5 py-1 rounded-md transition-colors"
                  title={fitMode === 'contain' ? 'Switch to Fill Frame (Cover)' : 'Switch to Fit Entire Image'}
                >
                  {fitMode === 'contain' ? <Crop size={13} /> : <Scan size={13} />}
                  <span>{fitMode === 'contain' ? 'Fit (Entire)' : 'Fill (Frame)'}</span>
                </button>

                {enableBackgroundCleanup ? (
                  <button
                    type="button"
                    onClick={() => setBgModalFile(preview)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-md transition-colors"
                  >
                    <Wand2 size={12} />
                    {t('image.cleanLogo', 'Clean Background')}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-gray-200 hover:text-slate-900 bg-slate-100 dark:bg-dark-elevated px-2.5 py-1 rounded-md transition-colors"
                >
                  <RefreshCw size={12} />
                  {t('image.changePhoto')}
                </button>

                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-md transition-colors"
                >
                  <Trash2 size={12} />
                  {t('image.deletePhoto')}
                </button>
              </div>

              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>✓</span>
                <span>Entire image is preserved and will print completely on invoices & receipts</span>
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 w-fit inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Upload Image
            </button>
          )}
        </div>
      </div>

      {/* Full Resolution Image Lightbox Modal */}
      {showFullView && preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowFullView(false)}
        >
          <div
            className="relative bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col items-center animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Full Image Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFullView(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-full max-h-[65vh] flex items-center justify-center overflow-auto p-4 rounded-xl bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:12px_12px] bg-slate-100 dark:bg-dark-bg border border-gray-200 dark:border-gray-700">
              <img
                src={preview}
                alt="Full Resolution Preview"
                className="max-h-[55vh] max-w-full object-contain rounded drop-shadow-md select-none"
              />
            </div>

            <div className="flex items-center justify-between w-full pt-3 mt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
              <span>Full original image — fully preserved for printing</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowFullView(false)
                    inputRef.current?.click()
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
                >
                  Change Image
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullView(false)}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5MB Exceeded Popup Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 text-center transform transition-all animate-scale-up">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={30} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {t('image.exceedsLimitTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
              {t('image.exceedsLimitMsg')}
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-md shadow-red-500/20 transition-all active:scale-95"
              >
                OK / ठीक है
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logo Background Cleanup & Thermal Preview Modal */}
      {enableBackgroundCleanup && bgModalFile && (
        <LogoBackgroundModal
          isOpen={!!bgModalFile}
          imageSrc={bgModalFile}
          onApply={(finalDataUrl) => {
            setPreview(finalDataUrl)
            onChange(finalDataUrl)
            setBgModalFile(null)
          }}
          onCancel={() => setBgModalFile(null)}
        />
      )}
    </div>
  )
}
