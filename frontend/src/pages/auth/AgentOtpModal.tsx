import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/AuthContext'
import { lookupAgentNames, requestAgentOtp, verifyAgentOtp } from '@/services/authService'

export function AgentOtpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { adoptSession } = useAuth()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [existing, setExisting] = useState<string[]>([])
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const refreshAgentNames = useCallback(async (storeEmail: string) => {
    const trimmed = storeEmail.trim()
    if (!trimmed.includes('@')) return
    try {
      const res = await lookupAgentNames(trimmed)
      setExisting(res.existingAgents || [])
    } catch {
      setExisting([])
    }
  }, [])

  const send = async () => {
    setError('')
    if (!name.trim()) {
      setError('Enter your agent name first — the store owner email will say who is requesting the code.')
      return
    }
    setLoading(true)
    try {
      const res = await requestAgentOtp(email.trim(), name.trim())
      setExisting(res.existingAgents || [])
      setCodeSent(true)
    } catch (err: any) {
      setError(err?.message || 'Could not send the code')
    } finally {
      setLoading(false)
    }
  }

  const verify = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await verifyAgentOtp(email.trim(), otp.trim(), name.trim())
      adoptSession(data.user)
      navigate(ROUTES.DASHBOARD)
    } catch (err: any) {
      setError(err?.message || 'Could not sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Agent login">
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Store email, your agent name, and the 6-digit code we send to that email. Up to two agents per store.
        </p>

        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Store email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => refreshAgentNames(email)}
          placeholder="store@example.com"
          autoCapitalize="none"
          className="w-full px-3 py-2 border rounded-lg dark:bg-dark-elevated dark:border-dark-border"
        />

        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Your name</label>
        {existing.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {existing.map((agent) => (
              <button
                key={agent}
                type="button"
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  name === agent
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-100 dark:bg-white/10 border-transparent'
                }`}
                onClick={() => setName(agent)}
              >
                {agent}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No saved agents yet — type your name below (first login creates it).</p>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={existing.length ? 'Tap a name above or type yours' : 'Your name'}
          className="w-full px-3 py-2 border rounded-lg dark:bg-dark-elevated dark:border-dark-border"
        />

        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">6-digit code</label>
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={codeSent ? 'From store email' : 'Send code first'}
          className="w-full px-3 py-2 border rounded-lg tracking-widest text-center dark:bg-dark-elevated dark:border-dark-border"
        />

        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="secondary"
            className="w-full"
            onClick={send}
            loading={loading && !codeSent}
            disabled={!email.trim()}
          >
            {codeSent ? 'Resend code' : 'Send code to store email'}
          </Button>
          <Button
            className="w-full"
            onClick={verify}
            loading={loading && codeSent}
            disabled={otp.length < 6 || !name.trim() || !email.trim()}
          >
            Enter store
          </Button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Modal>
  )
}
