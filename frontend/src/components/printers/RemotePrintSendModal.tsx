import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Send, Smartphone, CheckCircle2, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { toastError } from '@/utils/userMessage'
import { createPrintJob, listBusinessDevices, type BusinessDeviceEntry } from '@/services/printJobService'
import { getAllUsers } from '@/services/authService'
import { useAuth } from '@/contexts/AuthContext'
import type { UserProfile } from '@/types/auth.types'
import { useSettings } from '@/hooks/useSettings'

interface RemotePrintSendModalProps {
  isOpen: boolean
  onClose: () => void
  sale: { id: string; invoiceNumber: string; grandTotal: number } | null
  onSent?: (printJobId: string) => void
}

/**
 * Sends an existing sale's receipt to a teammate's phone to print, for when the person who needs
 * the paper copy is not at this desk. They get a notification, accept it, and it prints on
 * whichever printer is connected to their phone.
 */
export const RemotePrintSendModal = ({ isOpen, onClose, sale, onSent }: RemotePrintSendModalProps) => {
  const { user } = useAuth()
  const { data: settings } = useSettings()
  const paperWidth = useMemo((): '58mm' | '80mm' => {
    const cfg = settings?.printerConfig as { paperWidth?: string; paperSize?: string } | undefined
    if (cfg?.paperWidth === '58mm' || cfg?.paperSize === '58mm') return '58mm'
    if (cfg?.paperWidth === '80mm' || cfg?.paperSize === '80mm') return '80mm'
    return '80mm'
  }, [settings?.printerConfig])
  const [devices, setDevices] = useState<BusinessDeviceEntry[]>([])
  const [staff, setStaff] = useState<UserProfile[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setIsLoading(true)
    setSelectedAgentId(null)

    const load = async () => {
      const uid = user?.uid || (user as UserProfile & { id?: string })?.id || ''
      const [deviceList, staffList] = await Promise.all([
        listBusinessDevices().catch(() => [] as BusinessDeviceEntry[]),
        uid ? getAllUsers(uid).catch(() => [] as UserProfile[]) : Promise.resolve([] as UserProfile[]),
      ])
      if (cancelled) return
      setDevices(deviceList)
      setStaff(staffList || [])
      setIsLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isOpen, user])

  const deviceByActor = useMemo(() => new Map(devices.map(d => [d.actorId, d])), [devices])

  const targets = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>()
    for (const member of staff) {
      const id = (member as UserProfile & { id?: string }).id || member.uid
      if (id) byId.set(id, { id, name: member.displayName || member.email || 'Staff' })
    }
    for (const device of devices) {
      if (!byId.has(device.actorId)) byId.set(device.actorId, { id: device.actorId, name: device.actorName })
    }
    return Array.from(byId.values())
  }, [staff, devices])

  const handleSend = async () => {
    if (!sale || !selectedAgentId) return
    setIsSending(true)
    try {
      const job = await createPrintJob({
        saleId: sale.id,
        jobType: 'receipt',
        targetAgentId: selectedAgentId,
        paperWidth,
      })
      toast.success('Sent — they will get a notification to accept and print it.')
      onSent?.(job.id)
      onClose()
    } catch (error) {
      toastError(error, 'Could not send this receipt. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send to Print Remotely"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} loading={isSending} disabled={!selectedAgentId || isSending} leftIcon={<Send size={16} />}>
            Send Receipt
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {sale && (
          <div className="p-3 bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border-strong rounded-lg">
            <span className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wider block font-semibold">Receipt</span>
            <span className="text-sm font-bold text-slate-800 dark:text-gray-100">
              {sale.invoiceNumber} · ₹{sale.grandTotal.toFixed(2)}
            </span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
            Who should print this receipt?
          </label>

          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">Loading your team…</p>
          ) : targets.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 leading-relaxed">
              Nobody is available to send to yet. Add a staff account under Settings → Permissions &amp; Accounts.
              Agents signed in on web or the mobile app can accept the request from Requests.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {targets.map(target => {
                const hasDevice = !!deviceByActor.get(target.id)
                const selected = selectedAgentId === target.id
                return (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => setSelectedAgentId(target.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                      selected
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-slate-200 dark:border-dark-border hover:border-blue-400'
                    }`}
                  >
                    {selected ? (
                      <CheckCircle2 size={20} className="text-blue-600 shrink-0" />
                    ) : (
                      <Circle size={20} className="text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-gray-100 truncate">{target.name}</p>
                      <p className={`text-xs flex items-center gap-1 ${hasDevice ? 'text-emerald-600' : 'text-sky-600'}`}>
                        <Smartphone size={11} />
                        {hasDevice ? 'Phone ready to receive' : 'Can accept on web or app'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
