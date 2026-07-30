import { useState, useRef, useEffect } from 'react'
import { X, Image as ImageIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: unknown[]): string {
  return twMerge(clsx(inputs))
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
}

export const ImageUpload = ({
  label,
  value,
  onChange,
  onFileSelect,
  accept = 'image/*',
  className,
  previewSize = 'md',
}: ImageUploadProps) => {
  const [preview, setPreview] = useState<string>(value || '')
  const [isUploading, setIsUploading] = useState(false)
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

    setIsUploading(true)

    try {
      if (onFileSelect) {
        const url = await onFileSelect(file)
        setPreview(url)
        onChange(url)
        setIsUploading(false)
      } else {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64Url = reader.result as string
          setPreview(base64Url)
          onChange(base64Url)
          setIsUploading(false)
        }
        reader.onerror = () => {
          setIsUploading(false)
        }
        reader.readAsDataURL(file)
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
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'relative rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-700',
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
                title="Remove image"
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
        <div className="flex-1">
          <p className="text-xs text-gray-400">
            Click to upload. Recommended: JPG, PNG
          </p>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              Remove image
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
