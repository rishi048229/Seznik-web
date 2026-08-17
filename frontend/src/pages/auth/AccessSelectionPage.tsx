import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Shield, Store, ArrowRight, Lock, BadgeCheck, History, AlertCircle } from 'lucide-react'
import type { UserRole, UserProfile } from '@/types/auth.types'
import { getAllUsers } from '@/services/authService'
import toast from 'react-hot-toast'
import { ROUTES } from '@/constants/routes'

export const AccessSelectionPage = () => {
  const navigate = useNavigate()
  const { user, setUserRole, signOut } = useAuth()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agents, setAgents] = useState<UserProfile[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(true)

  useEffect(() => {
    let isMounted = true
    const fetchAgents = async () => {
      if (!user) {
        setIsLoadingAgents(false)
        return
      }

      // If user is already logged in with agent role, agent access is directly allowed
      if (user.role === 'agent') {
        setIsLoadingAgents(false)
        return
      }

      try {
        const uid = user.uid || (user as any).id || ''
        const list = await getAllUsers(uid)
        if (isMounted) {
          const agentList = (list || []).filter(u => u.role === 'agent')
          setAgents(agentList)
        }
      } catch (err) {
        console.error('Failed to load agents for access selection:', err)
      } finally {
        if (isMounted) setIsLoadingAgents(false)
      }
    }

    fetchAgents()
    return () => { isMounted = false }
  }, [user])

  const isCurrentUserAgent = user?.role === 'agent'
  const hasAgents = isCurrentUserAgent || agents.length > 0

  const handleRoleSelect = (role: UserRole) => {
    if (role === 'admin' && user?.role === 'agent') {
      toast.error(`Access Denied: ${user?.email || 'Your account'} does not have Admin privileges`)
      return
    }

    if (role === 'agent' && !hasAgents) {
      toast.error('Agent access is disabled. Please log in as Admin first and create an Agent account under Settings → Permissions & Accounts.')
      return
    }

    setSelectedRole(role)
    setName(user?.displayName || user?.email || '')
    setPassword('')
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!password.trim()) {
      toast.error('Please enter your password to confirm')
      return
    }

    if (!user || !selectedRole) {
      toast.error('Invalid session')
      return
    }

    setIsSubmitting(true)

    try {
      await setUserRole(selectedRole, name.trim() || user.displayName || user.email || '', password)

      toast.success(`Logged in as ${selectedRole}`)
      navigate(ROUTES.DASHBOARD)
    } catch (error) {
      console.error('Error setting role:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to set role')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteLogout = async () => {
    try {
      await signOut()
      toast.success('Logged out successfully')
      navigate(ROUTES.LOGIN)
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Failed to logout')
    }
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] flex flex-col">
      {/* Header */}
      <header className="w-full top-0 sticky bg-transparent flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 max-w-screen-2xl mx-auto z-50">
        <div className="flex items-center gap-3">
          <img
            className="h-10 w-auto"
            src="/seznik_logo.png"
            alt="Seznik"
          />
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleCompleteLogout}
            className="text-[#070235]/60 hover:opacity-80 transition-opacity p-2 flex items-center justify-center"
            aria-label="Logout"
            title="Logout"
          >
            <Lock size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 sm:px-6 py-4">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-[#070235] font-extrabold text-2xl sm:text-3xl md:text-4xl tracking-tight mb-2 sm:mb-3">
              Choose your workstation
            </h1>
            <p className="text-[#47464f] text-sm sm:text-base max-w-xl mx-auto">
              Select the appropriate access level to continue to your Seznik dashboard. Your session will be logged for security.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Admin Card */}
            <div
              className="group relative bg-white rounded-xl p-6 shadow-[0_20px_40px_rgba(7,2,53,0.04)] hover:shadow-[0_20px_40px_rgba(7,2,53,0.08)] transition-all duration-500 border border-transparent hover:border-[#006591]/20 flex flex-col items-start overflow-hidden cursor-pointer"
              onClick={() => handleRoleSelect('admin')}
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Shield size={120} />
              </div>
              <div className="w-14 h-14 bg-[#1e1b4b]/5 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                <Shield className="text-[#070235]" size={32} />
              </div>
              <h2 className="text-[#070235] font-bold text-xl mb-2">Admin Access</h2>
              <p className="text-[#47464f] text-sm leading-relaxed mb-6">
                Full system management, reports, and settings. Access core infrastructure controls and financial auditing tools.
              </p>
              <button className="mt-auto w-full py-3 px-5 bg-[#070235] text-white font-bold rounded-xl flex items-center justify-center gap-2 group-hover:bg-[#1e1b4b] transition-all active:scale-[0.98]">
                <span>Login as Admin</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Agent Card */}
            <div
              className={`group relative rounded-xl p-6 transition-all duration-500 border flex flex-col items-start overflow-hidden ${
                hasAgents
                  ? 'bg-white shadow-[0_20px_40px_rgba(7,2,53,0.04)] hover:shadow-[0_20px_40px_rgba(7,2,53,0.08)] border-transparent hover:border-[#006591]/20 cursor-pointer'
                  : 'bg-slate-100/90 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-85'
              }`}
              onClick={() => handleRoleSelect('agent')}
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Store size={120} />
              </div>
              <div className="flex items-center justify-between w-full mb-5">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-transform duration-500 ${
                  hasAgents ? 'bg-[#006591]/5 group-hover:scale-110' : 'bg-gray-200/80 dark:bg-gray-700/80'
                }`}>
                  <Store className={hasAgents ? 'text-[#006591]' : 'text-gray-400'} size={32} />
                </div>
                {!hasAgents && !isLoadingAgents && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                    <Lock size={12} />
                    Disabled
                  </span>
                )}
                {hasAgents && agents.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                    <BadgeCheck size={12} />
                    {agents.length} Agent{agents.length > 1 ? 's' : ''} Ready
                  </span>
                )}
              </div>
              <h2 className={`font-bold text-xl mb-2 ${hasAgents ? 'text-[#070235]' : 'text-gray-600 dark:text-gray-300'}`}>
                Agent Access
              </h2>
              <p className="text-[#47464f] text-sm leading-relaxed mb-6">
                {hasAgents
                  ? 'Front-of-house sales, terminal access, and stock check. Optimized for rapid transaction flow and inventory tracking.'
                  : 'Agent workstation is currently disabled because no agent accounts have been created yet. Create an agent account under Admin Settings → Permissions & Accounts.'}
              </p>
              <button
                disabled={!hasAgents}
                className={`mt-auto w-full py-3 px-5 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                  hasAgents
                    ? 'bg-[#006591] text-white group-hover:bg-[#00557a] active:scale-[0.98]'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                <span>{hasAgents ? 'Login as Agent' : 'Agent Access Disabled'}</span>
                {hasAgents ? <ArrowRight size={16} /> : <Lock size={16} />}
              </button>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 flex justify-center items-center gap-4 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-2 text-[#47464f]/40 text-xs font-medium uppercase tracking-widest">
              <Lock size={14} />
              Secure TLS 1.3
            </div>
            <div className="flex items-center gap-2 text-[#47464f]/40 text-xs font-medium uppercase tracking-widest">
              <BadgeCheck size={14} />
              ISO 27001 Certified
            </div>
            <div className="flex items-center gap-2 text-[#47464f]/40 text-xs font-medium uppercase tracking-widest">
              <History size={14} />
              Uptime 99.9%
            </div>
          </div>
        </div>
      </main>

      {/* Name & Password Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setName('')
          setPassword('')
        }}
        title={`Enter details for ${selectedRole === 'admin' ? 'Admin' : 'Agent'} Access`}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setIsModalOpen(false)
                setName('')
                setPassword('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!password.trim()}
            >
              Confirm Access
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Account Email</span>
            <span className="text-sm font-bold text-slate-800">{user?.email}</span>
          </div>

          <Input
            label="Account Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
          />
          <Input
            label="Account Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to confirm access"
            autoFocus
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selectedRole === 'admin'
              ? 'Admin access grants full permissions to all features including stock management, reports, and settings.'
              : 'Agent access is limited to POS, sales, products (view-only), and customer management.'}
          </p>
        </div>
      </Modal>
    </div>
  )
}
