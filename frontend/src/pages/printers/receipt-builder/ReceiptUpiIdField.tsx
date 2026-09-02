import { isValidUpiVpa } from '@/utils/upiQr'

const inputCls = 'w-full px-2 py-1.5 border border-gray-300 dark:border-dark-border-strong rounded-lg bg-white dark:bg-dark-elevated text-xs'

interface ReceiptUpiIdFieldProps {
  value: string
  onChange: (next: string) => void
  /** When true, show the error even before the user has typed (Save blocked). */
  showError?: boolean
}

export function ReceiptUpiIdField({ value, onChange, showError = true }: ReceiptUpiIdFieldProps) {
  const invalid = showError && !isValidUpiVpa(value)
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
        UPI ID <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        autoComplete="off"
        inputMode="email"
        spellCheck={false}
        value={value}
        placeholder="shopname@okhdfcbank"
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} ${invalid ? 'border-red-500 focus:ring-red-400' : ''}`}
        aria-invalid={invalid}
        aria-required
      />
      {invalid ? (
        <p className="text-[11px] text-red-600 dark:text-red-400">
          Enter your UPI ID (e.g. shopname@okhdfcbank) before you can save or print a UPI QR.
        </p>
      ) : (
        <p className="text-[11px] text-gray-500">Customers pay this ID when they scan the receipt QR.</p>
      )}
    </div>
  )
}
