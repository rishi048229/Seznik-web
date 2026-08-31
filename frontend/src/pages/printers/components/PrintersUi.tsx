import type { ReactNode } from 'react'

export function StatusDot({ on }: { on: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
      {on && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
      )}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
          on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      />
    </span>
  )
}

export function Section({
  title,
  description,
  eyebrow,
  action,
  children,
  className = '',
}: {
  title: string
  description?: string
  eyebrow?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">
              {eyebrow}
            </p>
          )}
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  )
}

export const chipClass = (active: boolean) =>
  `rounded-xl border text-xs font-semibold transition-colors duration-150 ${
    active
      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
  }`

export const fieldClass =
  'w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950/40 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/15'
