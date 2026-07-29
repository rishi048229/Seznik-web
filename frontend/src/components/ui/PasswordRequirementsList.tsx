import { Check } from 'lucide-react'

import { PASSWORD_REQUIREMENTS } from '@/utils/password'

interface Props {
  password: string
  showOnlyIfTyped?: boolean
}

export const PasswordRequirementsList = ({ password, showOnlyIfTyped = false }: Props) => {
  if (showOnlyIfTyped && !password) return null

  return (
    <div className="mt-2.5 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/80 space-y-1.5 transition-all">
      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        Password Requirements:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {PASSWORD_REQUIREMENTS.map(req => {
          const isPassed = req.test(password)
          return (
            <div
              key={req.id}
              className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                isPassed
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : password
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] ${
                  isPassed
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}
              >
                {isPassed ? <Check size={10} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
              </div>
              <span>{req.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
