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
import { Mail, Phone, MapPin, Building2, Shield, Settings, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

export const ProfilePage = () => {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user, userProfile, clearWorkspaceSelection } = useAuth()
  const { data: settings } = useSettings()

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

  const handleSignOut = async () => {
    try {
      clearWorkspaceSelection()
      toast.success('Signed out to RBA workstation panel')
      navigate(ROUTES.ACCESS_SELECTION, { replace: true })
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    }
  }

  return (
    <div>
      <PageHeader title="Profile" />

      <div className="max-w-3xl space-y-4">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <img
              src={photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 bg-white"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{displayName}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="info">{roleLabel}</Badge>
                {businessTypeLabel && <Badge variant="default">{businessTypeLabel}</Badge>}
                {userProfile?.plan && (
                  <Badge variant={userProfile.plan === 'pro' ? 'success' : 'default'}>
                    {userProfile.plan.toUpperCase()}
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

        <Card className="p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.personalInfo')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Building2 size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.ownerName')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {personalInfo?.ownerName || '—'}
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
                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
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
                  Manage password and account security in settings.
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

        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleSignOut} className="text-red-600 dark:text-red-400">
            <LogOut size={16} className="mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}
