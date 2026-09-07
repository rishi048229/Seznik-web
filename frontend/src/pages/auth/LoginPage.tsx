  vvvvv                     
  
  
  
  
  
  import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { ROUTES } from '@/constants/routes'
import {
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  verifyAccessCode,
} from '@/services/authService'
import {
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Video,
  Printer,
  Sparkles,
  Zap,
  Shield,
  KeyRound,
  HelpCircle,
  Headphones,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordRequirementsList } from '@/components/ui/PasswordRequirementsList'
import { validatePassword } from '@/utils/password'
import { toUserMessage } from '@/utils/userMessage'
import { trackUserAction } from '@/utils/analytics'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { useLanguage } from '@/contexts/LanguageContext'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'

type EmailVerifyStep = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified'
type PhoneVerifyStep = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified'
type ForgotStep = 'email' | 'otp' | 'new_password' | 'success'

export const LoginPage = () => {
  const { loginWithEmail, registerWithEmail, loading } = useAuth()
  const pageTutorial = usePageTutorial('login')
  const { t } = useLanguage()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registerStep, setRegisterStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Hardware Verification & Access Code (signup only)
  const [hasSeznikPrinter, setHasSeznikPrinter] = useState<boolean>(true)
  const [accessCode, setAccessCode] = useState('')
  const [codeVerificationState, setCodeVerificationState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [codeVerificationMsg, setCodeVerificationMsg] = useState<string | null>(null)

  // Email OTP verification flow (signup only)
  const [verifyStep, setVerifyStep] = useState<EmailVerifyStep>('idle')
  const [otp, setOtp] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [resendIn, setResendIn] = useState(0)

  // Phone OTP verification flow (signup only, default 000000)
  const [phoneVerifyStep, setPhoneVerifyStep] = useState<PhoneVerifyStep>('idle')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneOtpMessage, setPhoneOtpMessage] = useState('')
  const [phoneResendIn, setPhoneResendIn] = useState(0)

  // Forgot Password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotMessage, setForgotMessage] = useState('')
  const [forgotResendIn, setForgotResendIn] = useState(0)

  // Registration password validation states
  const regPassValidation = validatePassword(password)
  const isRegPassValid = password.length > 0 && regPassValidation.isValid
  const isRegPassInvalid = password.length > 0 && !regPassValidation.isValid

  const isRegConfirmValid = confirmPassword.length > 0 && confirmPassword === password && isRegPassValid
  const isRegConfirmInvalid = confirmPassword.length > 0 && (confirmPassword !== password || !isRegPassValid)

  // Reset password validation states
  const forgotPassValidation = validatePassword(forgotNewPassword)
  const isForgotPassValid = forgotNewPassword.length > 0 && forgotPassValidation.isValid
  const isForgotPassInvalid = forgotNewPassword.length > 0 && !forgotPassValidation.isValid

  const isForgotConfirmValid = forgotConfirmPassword.length > 0 && forgotConfirmPassword === forgotNewPassword && isForgotPassValid
  const isForgotConfirmInvalid = forgotConfirmPassword.length > 0 && (forgotConfirmPassword !== forgotNewPassword || !isForgotPassValid)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setInterval(() => setResendIn(s => s - 1), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn])

  useEffect(() => {
    if (phoneResendIn <= 0) return
    const timer = window.setInterval(() => setPhoneResendIn(s => s - 1), 1000)
    return () => window.clearInterval(timer)
  }, [phoneResendIn])

  useEffect(() => {
    if (forgotResendIn <= 0) return
    const timer = window.setInterval(() => setForgotResendIn(s => s - 1), 1000)
    return () => window.clearInterval(timer)
  }, [forgotResendIn])

  // Changing the email invalidates any previous verification.
  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (verifyStep !== 'idle') {
      setVerifyStep('idle')
      setOtp('')
      setOtpMessage('')
    }
  }

  const handleSendOtp = async () => {
    setError('')
    setOtpMessage('')
    setVerifyStep('sending')
    try {
      await sendEmailOtp(email.trim())
      setVerifyStep('sent')
      setResendIn(60)
      setOtpMessage(`We sent a 6-digit code to ${email.trim()}`)
    } catch (err) {
      setVerifyStep('idle')
      setError(toUserMessage(err, 'Failed to send verification code'))
    }
  }

  const handleVerifyOtp = async (codeOverride?: string) => {
    const codeToVerify = (codeOverride || otp).trim()
    if (codeToVerify.length !== 6) return
    setError('')
    setVerifyStep('verifying')
    try {
      await verifyEmailOtp(email.trim(), codeToVerify)
      setVerifyStep('verified')
      setOtpMessage('')
    } catch (err) {
      setVerifyStep('sent')
      setError(toUserMessage(err, 'Incorrect verification code'))
    }
  }

  const handleOtpChange = (value: string) => {
    const numeric = value.replace(/\D/g, '').slice(0, 6)
    setOtp(numeric)
    if (numeric.length === 6) {
      handleVerifyOtp(numeric)
    }
  }

  // Changing the phone invalidates any previous verification.
  const handlePhoneChange = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 10)
    setPhone(clean)
    if (phoneVerifyStep !== 'idle') {
      setPhoneVerifyStep('idle')
      setPhoneOtp('')
      setPhoneOtpMessage('')
    }
  }

  const handleSendPhoneOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number')
      return
    }
    setError('')
    setPhoneOtpMessage('')
    setPhoneVerifyStep('sending')
    try {
      const res = await sendPhoneOtp(cleanPhone)
      setPhoneVerifyStep('sent')
      setPhoneResendIn(60)
      setPhoneOtp(res?.devOtp || '000000')
      setPhoneOtpMessage(res?.message || 'OTP sent! Default code is 000000.')
    } catch (err) {
      setPhoneVerifyStep('idle')
      setError(toUserMessage(err, 'Failed to send phone OTP'))
    }
  }

  const handleVerifyPhoneOtp = async (codeOverride?: string) => {
    const codeToVerify = (codeOverride !== undefined ? codeOverride : phoneOtp).trim()
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number')
      return
    }
    if (codeToVerify.length !== 6) return
    setError('')
    setPhoneVerifyStep('verifying')
    try {
      await verifyPhoneOtp(cleanPhone, codeToVerify)
      setPhoneVerifyStep('verified')
      setPhoneOtpMessage('')
    } catch (err) {
      setPhoneVerifyStep('sent')
      setError(toUserMessage(err, 'Incorrect phone verification code'))
    }
  }

  const handlePhoneOtpChange = (value: string) => {
    const numeric = value.replace(/\D/g, '').slice(0, 6)
    setPhoneOtp(numeric)
    if (numeric.length === 6) {
      handleVerifyPhoneOtp(numeric)
    }
  }

  const handleVerifyAccessCodePreflight = async (codeToCheck?: string) => {
    const raw = (codeToCheck !== undefined ? codeToCheck : accessCode).trim().toUpperCase()
    if (!raw) {
      setCodeVerificationState('idle')
      setCodeVerificationMsg(null)
      return
    }

    if (raw.length < 5) {
      setCodeVerificationState('invalid')
      setCodeVerificationMsg('Access code must be at least 6-7 alphanumeric characters')
      return
    }

    setCodeVerificationState('checking')
    setCodeVerificationMsg(null)

    try {
      const res = await verifyAccessCode(raw)
      if (res?.valid) {
        setCodeVerificationState('valid')
        setCodeVerificationMsg('VIP Priority Support & Hardware Care Activated!')
      } else {
        setCodeVerificationState('invalid')
        setCodeVerificationMsg(res?.error || 'Invalid access code. Please check your flyer or contact Support.')
      }
    } catch (err: unknown) {
      setCodeVerificationState('invalid')
      setCodeVerificationMsg(toUserMessage(err, 'Invalid access code. Please check your flyer or contact Support.'))
    }
  }

  const handleAdvanceToHardwareStep = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError('')

    const cleanEmail = email.trim()
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address')
      return
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name')
      return
    }

    // Auto-verify OTP if 6 digits are typed but not verified yet
    if (verifyStep !== 'verified') {
      const cleanOtp = otp.trim()
      if (cleanOtp.length === 6) {
        try {
          await verifyEmailOtp(cleanEmail, cleanOtp)
          setVerifyStep('verified')
        } catch (err) {
          setError(toUserMessage(err, 'Incorrect verification code'))
          return
        }
      } else {
        setError('Please tap "Verify Email" to receive a 6-digit code, then enter the code below.')
        return
      }
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number')
      return
    }

    // Auto-verify phone OTP if default 000000 or entered
    if (phoneVerifyStep !== 'verified') {
      const cleanPhoneOtp = phoneOtp.trim() || '000000'
      try {
        await verifyPhoneOtp(cleanPhone, cleanPhoneOtp)
        setPhoneVerifyStep('verified')
      } catch (err) {
        setError(toUserMessage(err, 'Please verify your phone number (default code: 000000)'))
        return
      }
    }

    const { isValid, failedRequirements } = validatePassword(password)
    if (!isValid) {
      setError(`Password requirements missing: ${failedRequirements.join(', ')}`)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please ensure both password fields are identical.')
      return
    }

    setRegisterStep(2)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanEmail = email.trim()
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address')
      return
    }

    if (!password) {
      setError('Please enter your password')
      return
    }

    if (isRegistering) {
      if (registerStep === 1) {
        await handleAdvanceToHardwareStep()
        return
      }

      if (hasSeznikPrinter) {
        const cleanCode = accessCode.trim().toUpperCase()
        if (!cleanCode) {
          setError('Please enter the 7-character access code from your printer flyer or contact Customer Support.')
          return
        }
        if (cleanCode.length < 5) {
          setError('Access code must be 7 characters.')
          return
        }
        if (codeVerificationState === 'invalid') {
          setError(codeVerificationMsg || 'Invalid access code. Please check your flyer or contact Support.')
          return
        }
      }
    }

    setIsSigningIn(true)
    try {
      if (isRegistering) {
        await registerWithEmail(
          cleanEmail,
          password,
          firstName.trim(),
          lastName.trim(),
          phone.replace(/\D/g, ''),
          hasSeznikPrinter,
          hasSeznikPrinter ? accessCode.trim().toUpperCase() : undefined
        )
        trackUserAction('user_register_success', { email: cleanEmail })
      } else {
        await loginWithEmail(cleanEmail, password)
        trackUserAction('user_login_success', { email: cleanEmail })
      }
      navigate(ROUTES.ACCESS_SELECTION)
    } catch (err: unknown) {
      setError(toUserMessage(err, 'Failed to sign in'))
    } finally {
      setIsSigningIn(false)
    }
  }

  const switchMode = () => {
    setIsRegistering(!isRegistering)
    setRegisterStep(1)
    setError('')
    setOtp('')
    setOtpMessage('')
    setVerifyStep('idle')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setHasSeznikPrinter(true)
    setAccessCode('')
    setCodeVerificationState('idle')
    setCodeVerificationMsg(null)
  }

  // Open Forgot Password Modal
  const handleOpenForgotModal = () => {
    setForgotEmail(email.trim())
    setForgotOtp('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotError('')
    setForgotMessage('')
    setForgotStep('email')
    setIsForgotModalOpen(true)
  }

  // Send Forgot Password OTP
  const handleSendForgotOtp = async () => {
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address')
      return
    }
    setForgotError('')
    setForgotMessage('')
    setForgotLoading(true)
    try {
      await sendForgotPasswordOtp(forgotEmail.trim())
      setForgotStep('otp')
      setForgotResendIn(60)
      setForgotMessage(`We sent a 6-digit code to ${forgotEmail.trim()}`)
    } catch (err) {
      setForgotError(toUserMessage(err, 'Failed to send reset code'))
    } finally {
      setForgotLoading(false)
    }
  }

  // Verify Forgot Password OTP
  const handleVerifyForgotOtp = async () => {
    if (forgotOtp.trim().length !== 6) {
      setForgotError('Please enter the full 6-digit code')
      return
    }
    setForgotError('')
    setForgotLoading(true)
    try {
      await verifyForgotPasswordOtp(forgotEmail.trim(), forgotOtp.trim())
      setForgotStep('new_password')
      setForgotError('')
      setForgotMessage('')
    } catch (err) {
      setForgotError(toUserMessage(err, 'Incorrect verification code'))
    } finally {
      setForgotLoading(false)
    }
  }

  // Reset Password
  const handleResetPassword = async () => {
    const { isValid, failedRequirements } = validatePassword(forgotNewPassword)
    if (!isValid) {
      setForgotError(`Password requirement missing: ${failedRequirements[0]}`)
      return
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match')
      return
    }
    setForgotError('')
    setForgotLoading(true)
    try {
      await resetPasswordWithOtp(forgotEmail.trim(), forgotNewPassword)
      setForgotStep('success')
    } catch (err) {
      setForgotError(toUserMessage(err, 'Failed to update password'))
    } finally {
      setForgotLoading(false)
    }
  }

  const handleFinishForgot = () => {
    setEmail(forgotEmail.trim())
    setPassword('')
    setConfirmPassword('')
    setIsForgotModalOpen(false)
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-100 dark:bg-dark-bg p-3 sm:p-6 md:p-8 overflow-y-auto">
      {/* Main Card */}
      <div className="flex flex-col md:flex-row w-full max-w-4xl rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-dark-border bg-white dark:bg-dark-card my-auto">

        {/* Top / Left Panel — Branding */}
        <div className="md:w-5/12 px-6 py-8 sm:p-10 md:p-12 flex flex-col justify-between gap-6 sm:gap-8"
          style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 45%, #0a0a2e 100%)', color: '#fff' }}>
          <div>
            <div className="mb-6 sm:mb-10">
              <img src="/seznik_white_logo.png" alt="Seznik" className="w-28 sm:w-36 md:w-40 h-auto object-contain" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-3">
              {t('login.bannerTitle')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t('login.bannerDesc')}
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sky-300 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold">Offline-Ready Sync</p>
                <p className="text-[10px] sm:text-xs text-slate-300">Continuous operation even during network drops</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sky-300 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold">Automated GST Invoicing</p>
                <p className="text-[10px] sm:text-xs text-slate-300">Ready-to-file tax reports in one click</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom / Right Panel — Form */}
        <div className="md:w-7/12 p-6 sm:p-10 md:p-12 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-gray-100">
                {isRegistering ? t('login.createAccount') : t('login.welcomeBack')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 mt-1">
                {isRegistering ? t('login.registerSubtitle') : t('login.signInSubtitle')}
              </p>
            </div>
            {pageTutorial.tutorialData && (
              <button
                onClick={pageTutorial.openTutorial}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 dark:bg-dark-elevated dark:text-indigo-300 dark:border-dark-border-strong dark:hover:bg-dark-hover transition-all shadow-sm shrink-0 cursor-pointer"
                title="Watch Video Guide & Tutorial"
              >
                <Video size={14} className="animate-pulse" />
                <span className="whitespace-nowrap">Video Guide</span>
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-4">
            {/* 2-Step Registration Progress Indicator */}
            {isRegistering && (
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-dark-border-strong">
                <button
                  type="button"
                  onClick={() => { setError(''); setRegisterStep(1) }}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                    registerStep === 1
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold'
                      : 'text-slate-500 hover:text-slate-700 dark:text-gray-400'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    registerStep === 1 ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    {registerStep === 2 ? '✓' : '1'}
                  </span>
                  <span>{t('login.stepDetails')}</span>
                </button>
                <span className="text-slate-300 dark:text-gray-600">/</span>
                <button
                  type="button"
                  onClick={() => {
                    if (registerStep === 1) void handleAdvanceToHardwareStep()
                  }}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                    registerStep === 2
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold'
                      : 'text-slate-500 hover:text-slate-700 dark:text-gray-400'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    registerStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-dark-elevated text-slate-600 dark:text-gray-400'
                  }`}>
                    2
                  </span>
                  <span>{t('login.stepHardware')}</span>
                </button>
              </div>
            )}

            {/* STEP 1 (or Login Form): Basic Account Details */}
            {(!isRegistering || registerStep === 1) && (
              <>
                {isRegistering && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">First Name</label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 sm:py-2 border border-slate-300 dark:border-dark-border-strong rounded-xl dark:bg-dark-elevated dark:text-gray-100 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] dark:focus:ring-zinc-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Last Name</label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 sm:py-2 border border-slate-300 dark:border-dark-border-strong rounded-xl dark:bg-dark-elevated dark:text-gray-100 text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] dark:focus:ring-zinc-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Email</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      readOnly={isRegistering && verifyStep === 'verified'}
                      className={`flex-1 min-w-0 px-3.5 py-2.5 sm:py-2 border rounded-xl text-[16px] sm:text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] dark:focus:ring-zinc-400 ${
                        isRegistering && verifyStep === 'verified'
                          ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30'
                          : 'border-slate-300 dark:border-dark-border-strong dark:bg-dark-elevated'
                      }`}
                      placeholder="admin@example.com"
                    />
                    {isRegistering && (
                      verifyStep === 'verified' ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-3 py-2 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl shrink-0">
                          <CheckCircle2 size={14} /> Verified
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={verifyStep === 'sending' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (verifyStep === 'sent' && resendIn > 0)}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 cursor-pointer"
                        >
                          {verifyStep === 'sending' ? 'Sending…' : verifyStep === 'sent' ? (resendIn > 0 ? `Resend (${resendIn}s)` : 'Resend') : 'Verify Email'}
                        </button>
                      )
                    )}
                  </div>
                  {isRegistering && otpMessage && verifyStep !== 'verified' && (
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{otpMessage}</p>
                  )}
                </div>

                {isRegistering && (verifyStep === 'sent' || verifyStep === 'verifying') && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Verification Code</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => handleOtpChange(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 sm:py-2 border border-slate-300 dark:border-dark-border-strong rounded-xl dark:bg-dark-elevated dark:text-gray-100 text-[16px] sm:text-base focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] dark:focus:ring-zinc-400 tracking-[0.4em] font-semibold text-center"
                        placeholder="••••••"
                      />
                    </div>
                  </div>
                )}

                {isRegistering && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Phone Number</label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        readOnly={phoneVerifyStep === 'verified'}
                        className={`flex-1 min-w-0 px-3.5 py-2.5 sm:py-2 border rounded-xl text-[16px] sm:text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] dark:focus:ring-zinc-400 ${
                          phoneVerifyStep === 'verified'
                            ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30'
                            : 'border-slate-300 dark:border-dark-border-strong dark:bg-dark-elevated'
                        }`}
                        placeholder="9876543210"
                      />
                      {phoneVerifyStep === 'verified' ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-3 py-2 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl shrink-0">
                          <CheckCircle2 size={14} /> Verified
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendPhoneOtp}
                          disabled={phoneVerifyStep === 'sending' || phone.replace(/\D/g, '').length !== 10 || (phoneVerifyStep === 'sent' && phoneResendIn > 0)}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 cursor-pointer"
                        >
                          {phoneVerifyStep === 'sending' ? 'Sending…' : phoneVerifyStep === 'sent' ? (phoneResendIn > 0 ? `Resend (${phoneResendIn}s)` : 'Resend') : 'Verify Phone'}
                        </button>
                      )}
                    </div>
                    {phoneOtpMessage && phoneVerifyStep !== 'verified' && (
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{phoneOtpMessage}</p>
                    )}
                  </div>
                )}

                {isRegistering && (phoneVerifyStep === 'sent' || phoneVerifyStep === 'verifying') && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300">Phone OTP (Default: 000000)</label>
                      <button
                        type="button"
                        onClick={() => handleVerifyPhoneOtp('000000')}
                        className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                      >
                        Auto-fill & Verify 000000
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={phoneOtp}
                        onChange={(e) => handlePhoneOtpChange(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 sm:py-2 border border-slate-300 dark:border-dark-border-strong rounded-xl dark:bg-dark-elevated dark:text-gray-100 text-[16px] sm:text-base focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] dark:focus:ring-zinc-400 tracking-[0.4em] font-semibold text-center"
                        placeholder="000000"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyPhoneOtp()}
                        disabled={phoneOtp.length !== 6 || phoneVerifyStep === 'verifying'}
                        className="px-4 py-2 bg-[#0a0a2e] dark:bg-blue-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      >
                        {phoneVerifyStep === 'verifying' ? 'Verifying…' : 'Verify'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Password Field with Eye Toggle and Visual Validation */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300">
                      {isRegistering ? 'Create Password' : 'Password'}
                    </label>
                    {!isRegistering && (
                      <button
                        type="button"
                        onClick={handleOpenForgotModal}
                        className="text-xs text-[#0a0a2e] dark:text-indigo-300 font-semibold hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full px-3.5 py-2.5 sm:py-2 pr-10 border rounded-xl text-[16px] sm:text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                        isRegistering && isRegPassValid
                          ? 'border-emerald-500 focus:ring-emerald-400 bg-emerald-50/15 dark:bg-emerald-950/20'
                          : isRegistering && isRegPassInvalid
                          ? 'border-red-400 focus:ring-red-400 bg-red-50/15 dark:bg-red-950/20'
                          : 'border-slate-300 dark:border-dark-border-strong dark:bg-dark-elevated focus:ring-[#0a0a2e] dark:focus:ring-zinc-400'
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 focus:outline-none transition-colors cursor-pointer"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {isRegistering && <PasswordRequirementsList password={password} showOnlyIfTyped />}
                </div>

                {/* Confirm Password Field (Signup only) with Eye Toggle & Match Indicator */}
                {isRegistering && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full px-3.5 py-2.5 sm:py-2 pr-10 border rounded-xl text-[16px] sm:text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                          isRegConfirmValid
                            ? 'border-emerald-500 focus:ring-emerald-400 bg-emerald-50/15 dark:bg-emerald-950/20'
                            : isRegConfirmInvalid
                            ? 'border-red-400 focus:ring-red-400 bg-red-50/15 dark:bg-red-950/20'
                            : 'border-slate-300 dark:border-dark-border-strong dark:bg-dark-elevated focus:ring-[#0a0a2e] dark:focus:ring-zinc-400'
                        }`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 focus:outline-none transition-colors cursor-pointer"
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {confirmPassword && (
                      <p className={`text-xs mt-1.5 font-semibold flex items-center gap-1 ${
                        isRegConfirmValid ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {isRegConfirmValid ? (
                          <>
                            <CheckCircle2 size={14} /> Passwords match
                          </>
                        ) : (
                          <>
                            <XCircle size={14} /> Passwords do not match
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {/* Step 1 Action Button */}
                {isRegistering ? (
                  <button
                    type="button"
                    onClick={handleAdvanceToHardwareStep}
                    disabled={isSigningIn || loading || !isRegPassValid || !isRegConfirmValid}
                    className="mt-3 sm:mt-4 w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[#0a0a2e] hover:bg-[#1a1555] text-white dark:bg-blue-600 dark:hover:bg-blue-500 text-sm sm:text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-blue-500/20"
                  >
                    <span>{t('login.continueToHardware')}</span>
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSigningIn || loading}
                    className="mt-3 sm:mt-4 w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm sm:text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer dark:shadow-none"
                    style={{ boxShadow: '0 10px 25px -5px rgba(10,10,46,0.3)' }}
                  >
                    {isSigningIn || loading ? (
                      <Spinner size="sm" className="text-white dark:text-zinc-900" />
                    ) : (
                      'Sign In'
                    )}
                  </button>
                )}
              </>
            )}

            {/* STEP 2: Seznik Hardware Verification & Access Code */}
            {isRegistering && registerStep === 2 && (
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center gap-2">
                    <Printer className="text-blue-600 dark:text-blue-400" size={18} />
                    <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-gray-100">
                      {t('login.hardwareVerificationQuestion')}
                    </label>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    {t('login.hardwareVerificationPrompt')}
                  </p>
                </div>

                {/* Option 1: Yes, Seznik Printer User (Priority Support & Hardware Care) */}
                <div
                  onClick={() => {
                    setHasSeznikPrinter(true)
                    setError('')
                  }}
                  className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    hasSeznikPrinter
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-500 shadow-sm'
                      : 'border-slate-200 dark:border-dark-border-strong hover:border-slate-300 dark:hover:border-dark-border bg-white dark:bg-dark-elevated'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          hasSeznikPrinter
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-400 dark:border-zinc-500'
                        }`}
                      >
                        {hasSeznikPrinter && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-gray-100">
                          {t('login.yesSeznikUser')}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                          <Sparkles size={11} className="text-amber-500" /> {t('login.vipTier')}
                        </span>
                      </div>

                      {/* VIP Benefit Bullets: Priority Support */}
                      <div className="mt-2.5 space-y-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-gray-300">
                        <div className="flex items-start gap-1.5">
                          <Zap size={13} className="text-amber-500 mt-0.5 shrink-0" />
                          <span>
                            <strong className="font-semibold text-slate-900 dark:text-gray-100">Priority support</strong> & rapid ticket turnaround
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <Printer size={13} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                          <span>
                            <strong className="font-semibold text-slate-900 dark:text-gray-100">Dedicated printer hardware care</strong> & direct diagnostics
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <Shield size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                          <span>
                            <strong className="font-semibold text-slate-900 dark:text-gray-100">Active hardware warranty</strong> coverage & calibration
                          </span>
                        </div>
                      </div>

                      {/* Access Code Input Box (Visible when Yes is selected) */}
                      {hasSeznikPrinter && (
                        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-900/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-gray-200">
                              {t('login.accessCodeLabel')} <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[10px] text-slate-400 dark:text-gray-400 font-mono">
                              {accessCode.length}/7
                            </span>
                          </div>

                          <div className="relative flex items-center">
                            <KeyRound
                              size={16}
                              className={`absolute left-3 pointer-events-none ${
                                codeVerificationState === 'valid'
                                  ? 'text-emerald-500'
                                  : codeVerificationState === 'invalid'
                                  ? 'text-red-500'
                                  : 'text-slate-400'
                              }`}
                            />
                            <input
                              type="text"
                              maxLength={7}
                              value={accessCode}
                              onChange={(e) => {
                                const upper = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
                                setAccessCode(upper)
                                if (codeVerificationState !== 'idle') {
                                  setCodeVerificationState('idle')
                                  setCodeVerificationMsg(null)
                                }
                                if (upper.length === 7) {
                                  handleVerifyAccessCodePreflight(upper)
                                }
                              }}
                              onBlur={() => {
                                if (accessCode.length >= 5) {
                                  handleVerifyAccessCodePreflight(accessCode)
                                }
                              }}
                              placeholder={t('login.accessCodePlaceholder')}
                              className={`w-full pl-9 pr-9 py-2 rounded-xl text-sm font-mono tracking-widest font-bold uppercase transition-all bg-white dark:bg-dark-elevated text-slate-900 dark:text-gray-100 border ${
                                codeVerificationState === 'valid'
                                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                  : codeVerificationState === 'invalid'
                                  ? 'border-red-500 ring-2 ring-red-500/20'
                                  : 'border-slate-300 dark:border-dark-border-strong focus:outline-none focus:ring-2 focus:ring-blue-500'
                              }`}
                            />
                            <div className="absolute right-3 flex items-center">
                              {codeVerificationState === 'checking' && (
                                <Spinner size="sm" className="text-blue-500" />
                              )}
                              {codeVerificationState === 'valid' && (
                                <CheckCircle2 size={16} className="text-emerald-500" />
                              )}
                              {codeVerificationState === 'invalid' && (
                                <XCircle size={16} className="text-red-500" />
                              )}
                            </div>
                          </div>

                          {/* Live Feedback */}
                          {codeVerificationMsg && (
                            <p
                              className={`text-[11px] font-medium ${
                                codeVerificationState === 'valid'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {codeVerificationMsg}
                            </p>
                          )}

                          {/* Flyer Hint */}
                          <div className="flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-gray-400">
                            <HelpCircle size={12} className="mt-0.5 shrink-0" />
                            <span>{t('login.accessCodeFlyerHint')}</span>
                          </div>

                          {/* Support Callout */}
                          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2 text-[10px] text-amber-800 dark:text-amber-300">
                            <Headphones size={13} className="shrink-0 mt-0.5 text-amber-600" />
                            <span>
                              <strong className="font-semibold">Don't have your flyer code?</strong> Contact Customer Support to generate your VIP code instantly.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Option 2: No, Standard User (All Feature Access) */}
                <div
                  onClick={() => {
                    setHasSeznikPrinter(false)
                    setError('')
                  }}
                  className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    !hasSeznikPrinter
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-500 shadow-sm'
                      : 'border-slate-200 dark:border-dark-border-strong hover:border-slate-300 dark:hover:border-dark-border bg-white dark:bg-dark-elevated'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          !hasSeznikPrinter
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-400 dark:border-zinc-500'
                        }`}
                      >
                        {!hasSeznikPrinter && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-gray-100">
                          {t('login.noSeznikUser')}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-dark-elevated dark:text-gray-300 border border-slate-300 dark:border-dark-border">
                          {t('login.standardTier')}
                        </span>
                      </div>

                      {/* Standard Benefit Bullets: All Feature Access */}
                      <div className="mt-2.5 space-y-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-gray-300">
                        <div className="flex items-start gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                          <span>
                            <strong className="font-semibold text-slate-900 dark:text-gray-100">All feature access</strong> — complete POS billing, inventory & tax tools
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <Printer size={13} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                          <span>
                            <strong className="font-semibold text-slate-900 dark:text-gray-100">Universal printer compatibility</strong> with any standard thermal or USB printer
                          </span>
                        </div>
                      </div>

                      {!hasSeznikPrinter && (
                        <div className="mt-3 p-2 rounded-lg bg-slate-50 dark:bg-dark-elevated border border-slate-200 dark:border-dark-border text-[10px] text-slate-500 dark:text-gray-400">
                          ℹ️ All POS application features are 100% identical. You can connect any standard printer or link a Seznik printer anytime in Settings.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 2 Action Buttons (Back & Complete Registration) */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => { setError(''); setRegisterStep(1) }}
                    className="flex items-center justify-center gap-1.5 py-3 px-5 rounded-xl border border-slate-300 dark:border-dark-border bg-white dark:bg-dark-elevated hover:bg-slate-50 dark:hover:bg-dark-border text-xs sm:text-sm font-semibold text-slate-700 dark:text-gray-200 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSigningIn || loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[#0a0a2e] hover:bg-[#1a1555] text-white dark:bg-blue-600 dark:hover:bg-blue-500 text-sm sm:text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-blue-500/25"
                  >
                    {isSigningIn || loading ? (
                      <Spinner size="sm" className="text-white" />
                    ) : (
                      <>
                        <span>Create Account & Sign In</span>
                        <CheckCircle2 size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Sign Up / Log In Link */}
          <p className="text-center mt-8 text-sm text-slate-500 dark:text-gray-400">
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={switchMode} className="text-[#0a0a2e] dark:text-indigo-300 font-semibold hover:underline">
              {isRegistering ? 'Log in' : 'Sign Up'}
            </button>
          </p>

          {/* Footer */}
          <div className="flex justify-center gap-5 mt-10 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-gray-500 flex-wrap">
            <a href="#" className="hover:text-slate-600 dark:hover:text-gray-300">Security</a>
            <a href="#" className="hover:text-slate-600 dark:hover:text-gray-300">Privacy Policy</a>
            <a href="#" className="hover:text-slate-600 dark:hover:text-gray-300">Terms</a>
          </div>
          <p className="text-center mt-2 text-[10px] text-slate-300 dark:text-gray-600">© 2026 Seznik POS. All rights reserved.</p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Reset Password"
        size="md"
      >
        <div className="space-y-4 py-2">
          {forgotError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-lg">
              {forgotError}
            </div>
          )}

          {forgotStep === 'email' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Enter your registered email address and we'll send you a 6-digit verification code to reset your password.
              </p>
              <Input
                label="Registered Email Address"
                type="email"
                placeholder="name@company.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                autoFocus
              />
              <Button
                className="w-full bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-[#1e1b6e] dark:hover:bg-white"
                onClick={handleSendForgotOtp}
                loading={forgotLoading}
                disabled={!forgotEmail.trim()}
              >
                Send Reset Code
              </Button>
            </div>
          )}

          {forgotStep === 'otp' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Enter the 6-digit verification code sent to <strong className="text-slate-900 dark:text-gray-100">{forgotEmail}</strong>.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-dark-border-strong rounded-lg dark:bg-dark-elevated dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] dark:focus:ring-zinc-400 tracking-[0.4em] font-semibold text-center text-lg"
                  placeholder="••••••"
                  autoFocus
                />
              </div>

              {forgotMessage && <p className="text-xs text-slate-500 dark:text-gray-400">{forgotMessage}</p>}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="w-1/3"
                  onClick={() => setForgotStep('email')}
                  disabled={forgotLoading}
                >
                  Back
                </Button>
                <Button
                  className="w-2/3 bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-[#1e1b6e] dark:hover:bg-white"
                  onClick={handleVerifyForgotOtp}
                  loading={forgotLoading}
                  disabled={forgotOtp.length !== 6}
                >
                  Verify Code
                </Button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleSendForgotOtp}
                  disabled={forgotResendIn > 0 || forgotLoading}
                  className="text-xs text-[#0a0a2e] dark:text-indigo-300 font-semibold disabled:opacity-50 hover:underline"
                >
                  {forgotResendIn > 0 ? `Resend code in ${forgotResendIn}s` : 'Resend Code'}
                </button>
              </div>
            </div>
          )}

          {forgotStep === 'new_password' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Create a new password for <strong className="text-slate-900 dark:text-gray-100">{forgotEmail}</strong>.
              </p>
              <Input
                label="New Password"
                type="password"
                placeholder="Enter new password"
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                success={isForgotPassValid}
                error={isForgotPassInvalid ? ' ' : undefined}
                autoFocus
              />
              <PasswordRequirementsList password={forgotNewPassword} />
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter new password"
                value={forgotConfirmPassword}
                onChange={(e) => setForgotConfirmPassword(e.target.value)}
                success={isForgotConfirmValid}
                error={isForgotConfirmInvalid ? ' ' : undefined}
              />
              {forgotConfirmPassword && (
                <p className={`text-xs font-semibold flex items-center gap-1 -mt-2 ${
                  isForgotConfirmValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                }`}>
                  {isForgotConfirmValid ? (
                    <>
                      <CheckCircle2 size={14} /> Passwords match
                    </>
                  ) : (
                    <>
                      <XCircle size={14} /> Passwords do not match
                    </>
                  )}
                </p>
              )}
              <Button
                className="w-full bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-[#1e1b6e] dark:hover:bg-white"
                onClick={handleResetPassword}
                loading={forgotLoading}
                disabled={!isForgotPassValid || !isForgotConfirmValid}
              >
                Reset Password
              </Button>
            </div>
          )}

          {forgotStep === 'success' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-gray-100">Password Updated!</h4>
                <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>
              <Button
                className="w-full bg-[#0a0a2e] text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-[#1e1b6e] dark:hover:bg-white"
                onClick={handleFinishForgot}
              >
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Video Tutorial Modal */}
      {pageTutorial.tutorialData && (
        <PageVideoTutorialModal
          isOpen={pageTutorial.isTutorialOpen}
          onClose={pageTutorial.closeTutorial}
          tutorial={pageTutorial.tutorialData}
          onStartTour={pageTutorial.startTour}
        />
      )}
    </div>
  )
}

