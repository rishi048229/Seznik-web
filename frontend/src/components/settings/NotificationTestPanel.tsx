import { useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { fetchApi } from '@/services/api'
import {
  triggerStockCheck,
  triggerCreditDueCheck,
  triggerSupplierDueCheck,
} from '@/services/notificationService'

const TEST_KINDS = [
  { kind: 'low_stock', label: 'Low stock (sample push)' },
  { kind: 'daily_summary', label: 'Daily summary (sample push)' },
  { kind: 'credit_due', label: 'Credit due (sample push)' },
  { kind: 'update', label: 'General test push' },
] as const

async function sendTestPush(kind: string) {
  return fetchApi<{ success: boolean }>('/notifications/test-push', {
    method: 'POST',
    body: JSON.stringify({ kind }),
  })
}

export function NotificationTestPanel() {
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<{ success?: boolean }>) => {
    setBusy(key)
    try {
      const res = await fn()
      if (res.success === false) {
        toast.error('No push token registered on this store — open the mobile app and allow notifications first.')
      } else {
        toast.success('Test sent — check this device or the store phone notification tray.')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-blue-600" />
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Test alerts</h4>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        Sends real push notifications to registered store devices. Use these to confirm low-stock, daily summary, and credit alerts are configured.
      </p>
      <div className="flex flex-wrap gap-2">
        {TEST_KINDS.map(({ kind, label }) => (
          <Button
            key={kind}
            size="sm"
            variant="secondary"
            loading={busy === kind}
            leftIcon={<Send size={14} />}
            onClick={() => run(kind, () => sendTestPush(kind))}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
        <Button
          size="sm"
          variant="outline"
          loading={busy === 'scan-stock'}
          onClick={() => run('scan-stock', triggerStockCheck)}
        >
          Run low-stock scan
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={busy === 'scan-credit'}
          onClick={() => run('scan-credit', triggerCreditDueCheck)}
        >
          Run credit-due scan
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={busy === 'scan-supplier'}
          onClick={() => run('scan-supplier', triggerSupplierDueCheck)}
        >
          Run supplier-due scan
        </Button>
      </div>
    </div>
  )
}
