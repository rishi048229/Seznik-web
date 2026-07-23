import { type ReactNode, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from 'react'
import { motion, type MotionProps } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cn(...inputs: any[]): string {
  return twMerge(clsx(inputs))
}

type Variant = 'primary' | 'outline' | 'ghost-light' | 'dark'
type Size = 'sm' | 'md' | 'lg'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-blue-600 to-sky-400 text-white shadow-[0_10px_30px_-8px_rgba(37,99,235,0.6)] hover:shadow-[0_14px_36px_-6px_rgba(37,99,235,0.75)] hover:from-blue-500 hover:to-sky-300',
  outline:
    'border-2 border-white/30 text-white bg-white/5 backdrop-blur-sm hover:bg-white/15 hover:border-white/50',
  'ghost-light':
    'border-2 border-slate-200 text-slate-700 bg-white hover:border-slate-300 hover:bg-slate-50',
  dark:
    'bg-[#0a0a2e] text-white shadow-[0_10px_30px_-8px_rgba(10,10,46,0.5)] hover:bg-[#141450]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-5 py-2 text-xs gap-1.5',
  md: 'px-7 py-3 text-sm gap-2',
  lg: 'px-9 py-4 text-base gap-2.5',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children: ReactNode
  className?: string
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { as?: 'button' }
type ButtonAsAnchor = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { as: 'a'; href: string }

type CapsuleButtonProps = ButtonAsButton | ButtonAsAnchor

const baseClasses =
  'relative inline-flex items-center justify-center rounded-full font-semibold tracking-tight transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap'

export const CapsuleButton = ({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  children,
  className,
  ...props
}: CapsuleButtonProps) => {
  const classes = cn(baseClasses, variantClasses[variant], sizeClasses[size], className)

  const motionProps: MotionProps = {
    whileHover: { scale: 1.04, y: -2 },
    whileTap: { scale: 0.96 },
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  }

  if (props.as === 'a') {
    // Native anchor props (onDrag et al.) collide in shape with framer-motion's drag-gesture
    // props of the same name — safe to widen here since we don't use motion's drag API.
    const { as: _as, ...rest } = props as ButtonAsAnchor
    return (
      <motion.a className={classes} {...motionProps} {...(rest as Record<string, unknown>)}>
        {leftIcon}
        {children}
        {rightIcon}
      </motion.a>
    )
  }

  const { as: _as, ...rest } = props as ButtonAsButton
  return (
    <motion.button className={classes} {...motionProps} {...(rest as Record<string, unknown>)}>
      {leftIcon}
      {children}
      {rightIcon}
    </motion.button>
  )
}
