import { useState } from 'react'
import { Bluetooth, BluetoothConnected } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBlePrinter } from '@/hooks/useBlePrinter'
import { getBluetoothUnsupportedReason } from '@/utils/blePrinter'
import { toastError } from '@/utils/userMessage'
import { clsx } from 'clsx'

/** Compact Bluetooth printer chip for billing screens so staff can pair without leaving the page. */
export const BleConnectButton = ({ className }: { className?: string }) => {
  const ble = useBlePrinter()
  const [busy, setBusy] = useState(false)
  const connected = ble.status === 'connected' || ble.status === 'printing'
  const connecting = busy || ble.status === 'connecting'

  const onClick = async () => {
    if (!ble.isSupported) {
      toast.error(getBluetoothUnsupportedReason() || 'Bluetooth printing is not available in this browser.')
      return
    }
    if (connected) {
      ble.disconnect()
      toast.success('Printer disconnected')
      return
    }
    setBusy(true)
    try {
      await ble.connect()
      toast.success('Printer connected')
    } catch (err) {
      toastError(err, 'Could not connect the printer. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      title={ble.isSupported ? (connected ? 'Tap to disconnect' : 'Pair Bluetooth printer') : getBluetoothUnsupportedReason()}
      className={clsx(
        'inline-flex items-center gap-1.5 shrink-0 h-8 px-2.5 rounded-full text-[11px] font-semibold border transition-colors',
        connected
          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300',
        className,
      )}
    >
      {connected ? <BluetoothConnected size={13} /> : <Bluetooth size={13} />}
      {connecting ? 'Connecting…' : connected ? ble.deviceName || 'Printer on' : 'Connect printer'}
    </button>
  )
}
