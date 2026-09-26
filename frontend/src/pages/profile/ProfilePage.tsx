import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import { useLanguage } from '@/contexts/LanguageContext'
import { ROUTES } from '@/constants/routes'
import { getBusinessTypeLabel } from '@/constants/businessTypes'
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  Shield,
  Settings,
  LogOut,
  Sparkles,
  Printer,
  Zap,
  CheckCircle2,
  KeyRound,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

export const ProfilePage = () => {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user, userProfile, clearWorkspaceSelection, signOut, redeemAccessCode } = useAuth()
  const { data: settings } = useSettings()

  const [accessCodeInput, setAccessCodeInput] = useState('')
  const [isRedeeming, setIsRedeeming] = useState(false)
  const isSeznikUser = Boolean(userProfile?.seznikUser || user?.seznikUser)
  const isManagedAgent = user?.accountType === 'managed' || Boolean(user?.adminId)

  const displayName =
    settings?.businessName ||
    userProfile?.businessName ||
    userProfile?.displayName ||
    user?.displayName ||
    'User'
  const email = userProfile?.email || user?.email || ''
  const photoUrl = settings?.businessLogoURL || user?.photoURL || userProfile?.photoURL
  const personalInfo = settings?.personalInfo
  const roleLabel = userProfile?.role?.toUpperCase() || 'USER'
  const businessTypeLabel = userProfile?.businessType
    ? getBusinessTypeLabel(userProfile.businessType)
    : null

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = accessCodeInput.trim().toUpperCase()
    if (!clean || clean.length < 5) {
      toast.error('Please enter a valid 7-character access code')
      return
    }
    setIsRedeeming(true)
    try {
      await redeemAccessCode(clean)
      toast.success('VIP Priority Support & Hardware Care Activated!')
      setAccessCodeInput('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid access code')
    } finally {
      setIsRedeeming(false)
    }
  }

  const handleSwitchWorkstation = () => {
    try {
      clearWorkspaceSelection()
      toast.success('Switched to workstation panel')
      navigate(ROUTES.ACCESS_SELECTION, { replace: true })
    } catch (error) {
      console.error('Switch workstation error:', error)
      toast.error('Failed to switch workstation')
    }
  }

  const handleCompleteSignOut = async () => {
    try {
      await signOut()
      toast.success('Logged out successfully')
      navigate(ROUTES.LOGIN, { replace: true })
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to log out')
    }
  }

  return (
    <div>
      <PageHeader title={t('profile.title')} />

      <div className="max-w-3xl space-y-4">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <img
              src={photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-dark-border bg-white"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{displayName}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="info">{roleLabel}</Badge>
                {businessTypeLabel && <Badge variant="default">{businessTypeLabel}</Badge>}
                {isSeznikUser && (
                  <Badge variant="warning" className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700 inline-flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-500" /> SEZNIK VIP
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => navigate(`${ROUTES.SETTINGS}?tab=personal`)}
              className="w-full sm:w-auto flex-shrink-0"
            >
              <Settings size={16} className="mr-2" />
              {t('settings.personalInfo')}
            </Button>
          </div>
        </Card>

        {/* Seznik Hardware & VIP Tier Card */}
        <Card className={`p-5 sm:p-6 border-2 transition-all ${
          isSeznikUser
            ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/5 via-blue-500/5 to-transparent dark:border-amber-500/30'
            : 'border-slate-200 dark:border-dark-border-strong'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${
                isSeznikUser
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
              }`}>
                <Printer size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {isSeznikUser ? 'Seznik Hardware & VIP Priority' : 'Seznik Printer User?'}
                  </h3>
                  {isSeznikUser && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      <CheckCircle2 size={12} className="text-emerald-600" /> Active Hardware Care
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                  {isSeznikUser
                    ? 'Your account is linked to verified Seznik printer hardware. You enjoy fast-track VIP priority support, dedicated hardware care, and active warranty privileges.'
                    : 'Activate VIP Priority Support, dedicated printer hardware care, and direct diagnostics by entering the 7-character access code from your printer flyer.'}
                </p>

                {/* VIP Features list */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500 shrink-0" />
                    <span>Priority Support Queue</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Printer size={14} className="text-blue-500 shrink-0" />
                    <span>Hardware Diagnostics</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield size={14} className="text-emerald-500 shrink-0" />
                    <span>Active Warranty Care</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Access Code Input if not verified */}
          {!isSeznikUser && (
            <form onSubmit={handleRedeemCode} className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border-strong flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  maxLength={7}
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
                  placeholder="Enter 7-character Access Code (e.g. K9X2P4A)"
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm font-mono tracking-widest uppercase border border-gray-300 dark:border-dark-border-strong dark:bg-dark-elevated dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={isRedeeming || accessCodeInput.length < 5}
                className="shrink-0"
              >
                {isRedeeming ? <Spinner size="sm" className="mr-2" /> : <Sparkles size={16} className="mr-1.5 text-amber-300" />}
                Activate VIP Tier
              </Button>
            </form>
          )}
        </Card>

        <Card className="p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.personalInfo')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Building2 size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.ownerName')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {personalInfo?.ownerName || userProfile?.displayName || user?.displayName || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('customers.phoneNumber')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {personalInfo?.ownerPhone || userProfile?.phone || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 sm:col-span-2">
              <MapPin size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.address')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {personalInfo?.ownerAddress || settings?.businessAddress || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 sm:col-span-2">
              <Mail size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.email')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{email || '—'}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <Shield size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('settings.security')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('profile.securityHint')}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate(`${ROUTES.SETTINGS}?tab=security`)}
              className="w-full sm:w-auto"
            >
              {t('settings.security')}
            </Button>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {!isManagedAgent ? (
            <Button variant="secondary" onClick={handleSwitchWorkstation}>
              {t('access.switchWorkstation')}
            </Button>
          ) : null}
          <Button variant="danger" onClick={handleCompleteSignOut}>
            <LogOut size={16} className="mr-2" />
            {t('profile.signOut')}
          </Button>
        </div>
      </div>
    </div>
  )
}
