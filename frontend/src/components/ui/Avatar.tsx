import { clsx } from 'clsx'

interface AvatarProps {
  src?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const Avatar = ({ src, alt, size = 'md', className }: AvatarProps) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }

  if (src) {
    return <img src={src} alt={alt} className={clsx('rounded-full object-cover', sizeClasses[size], className)} />
  }

  return (
    <div
      className={clsx(
        'rounded-full bg-primary-100 dark:bg-primary-800 flex items-center justify-center text-primary-600 dark:text-primary-300 font-medium',
        sizeClasses[size],
        className
      )}
    >
      {alt?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  )
}
