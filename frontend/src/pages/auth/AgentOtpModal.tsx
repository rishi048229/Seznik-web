import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/AuthContext'
import { requestAgentOtp, verifyAgentOtp } from '@/services/authService'

export function AgentOtpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { adoptSession } = useAuth()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [existing, setExisting] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await requestAgentOtp(email.trim())
      setExisting(res.existingAgents || [])
      setSent(true)
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
          Use the store email. We email a code there. Then enter your agent name. A store can have two agents.
        </p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Store email"
          className="w-full px-3 py-2 border rounded-lg dark:bg-dark-elevated dark:border-dark-border"
        />
        {sent ? (
          <>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              className="w-full px-3 py-2 border rounded-lg tracking-widest text-center dark:bg-dark-elevated dark:border-dark-border"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={existing.length ? `Name (${existing.join(' or ')})` : 'Your name'}
              className="w-full px-3 py-2 border rounded-lg dark:bg-dark-elevated dark:border-dark-border"
            />
            {existing.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {existing.map((agent) => (
                  <button key={agent} type="button" className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-white/10" onClick={() => setName(agent)}>
                    {agent}
                  </button>
                ))}
              </div>
            ) : null}
            <Button className="w-full" onClick={verify} loading={loading} disabled={otp.length < 6 || !name.trim()}>
              Enter store
            </Button>
          </>
        ) : (
          <Button className="w-full" onClick={send} loading={loading} disabled={!email.trim()}>
            Send code
          </Button>
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Modal>
  )
}
