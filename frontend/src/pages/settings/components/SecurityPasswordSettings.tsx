import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { PasswordRequirementsList } from '@/components/ui/PasswordRequirementsList'
import { validatePassword } from '@/utils/password'
import { useAuth } from '@/contexts/AuthContext'
import { sendForgotPasswordOtp, verifyForgotPasswordOtp, resetPasswordWithOtp } from '@/services/authService'
import { Shield, KeyRound, Mail, CheckCircle2, Lock, Eye, EyeOff, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'

type Step = 'initial' | 'otp' | 'password' | 'success'

export const SecurityPasswordSettings = () => {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('initial')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = window.setInterval(() => setResendTimer(t => t - 1), 1000)
    return () => window.clearInterval(interval)
  }, [resendTimer])

  const userEmail = user?.email || user?.uid || ''

  // Step 1: Send OTP to user's email
  const handleSendCode = async () => {
    if (!userEmail) {
      toast.error(t('security.errEmailNotFound'))
      return
    }
    setLoading(true)
    try {
      await sendForgotPasswordOtp(userEmail)
      setStep('otp')
      setResendTimer(60)
      toast.success(`${t('security.codeSentPrefix')} ${userEmail}`)
    } catch (err: unknown) {
      console.error('Error sending reset code:', err)
      toast.error(err instanceof Error ? err.message : t('security.errSendCodeFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify 6-digit OTP code
  const handleVerifyCode = async () => {
    if (otp.trim().length !== 6) {
      toast.error(t('security.errEnterFullCode'))
      return
    }
    setLoading(true)
    try {
      await verifyForgotPasswordOtp(userEmail, otp.trim())
      setStep('password')
      toast.success(t('security.codeVerifiedSuccess'))
    } catch (err: unknown) {
      console.error('Error verifying code:', err)
      toast.error(err instanceof Error ? err.message : t('security.errIncorrectCode'))
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Update Password in Backend DB
  const handleUpdatePassword = async () => {
    const { isValid, failedRequirements } = validatePassword(newPassword)
    if (!isValid) {
      toast.error(`${t('security.errPasswordRequirementPrefix')} ${failedRequirements[0]}`)
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('security.errPasswordsNoMatch'))
      return
    }

    setLoading(true)
    try {
      await resetPasswordWithOtp(userEmail, newPassword)
      setStep('success')
      toast.success(t('security.passwordUpdatedSuccess'))
    } catch (err: unknown) {
      console.error('Error resetting password:', err)
      toast.error(err instanceof Error ? err.message : t('security.errUpdatePasswordFailed'))
    } finally {
      setLoading(false)
    }
  }


  const handleResetForm = () => {
    setStep('initial')
    setOtp('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="text-blue-600 dark:text-blue-400" size={20} />
            {t('security.title')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('security.subtitle')}
          </p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        {/* Account Info Box */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t('security.loggedInAccount')}</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{userEmail}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={12} /> {t('security.verified')}
          </span>
        </div>

        {/* Step 1: Initial State — Send Code */}
        {step === 'initial' && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 rounded-xl">
              <KeyRound className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={22} />
              <div>
                <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200">{t('security.resetAccountPassword')}</h4>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                  {t('security.clickToReceiveCodePrefix')} <strong>{userEmail}</strong>.
                </p>
              </div>
            </div>

            <Button
              onClick={handleSendCode}
              loading={loading}
              className="w-full sm:w-auto"
            >
              {t('security.sendVerificationCode')}
            </Button>
          </div>
        )}

        {/* Step 2: Enter & Verify OTP */}
        {step === 'otp' && (
          <div className="space-y-4 pt-2 animate-fadeIn">
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl space-y-1">
              <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                <Lock size={14} /> {t('security.enterVerificationCode')}
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                {t('security.codeSentToPrefix')} <strong>{userEmail}</strong>{t('security.codeSentToSuffix')}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                {t('security.sixDigitCode')}
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="123456"
                className="w-full max-w-xs px-4 py-2.5 text-center text-lg font-mono tracking-[0.4em] font-bold border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={handleVerifyCode}
                loading={loading}
                disabled={otp.length !== 6 || loading}
              >
                {t('security.verifyCode')}
              </Button>
              <button
                type="button"
                onClick={handleSendCode}
                disabled={resendTimer > 0 || loading}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                {resendTimer > 0 ? `${t('security.resendCodeInPrefix')} ${resendTimer}s` : t('security.resendCode')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Enter & Confirm New Password */}
        {step === 'password' && (
          <div className="space-y-4 pt-2 animate-fadeIn">
            <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl">
              <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> {t('security.identityVerified')}
              </h4>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                {t('security.createStrongPassword')}
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Input
                  label={t('security.newPassword')}
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={t('security.newPasswordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Complexity Checklist */}
              <PasswordRequirementsList password={newPassword} />

              <Input
                label={t('security.confirmNewPassword')}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder={t('security.confirmNewPasswordPlaceholder')}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs font-medium text-red-500">{t('security.errPasswordsNoMatch')}</p>
              )}
            </div>

            <div className="pt-3 flex gap-3">
              <Button
                onClick={handleUpdatePassword}
                loading={loading}
                disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || loading}
              >
                {t('security.updatePasswordInDb')}
              </Button>
              <Button variant="ghost" onClick={handleResetForm}>
                {t('action.cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Success State */}
        {step === 'success' && (
          <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-3 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={28} />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
              {t('security.passwordUpdatedTitle')}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
              {t('security.passwordUpdatedDesc')}
            </p>
            <div className="pt-2">
              <Button variant="outline" onClick={handleResetForm}>
                {t('security.done')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
