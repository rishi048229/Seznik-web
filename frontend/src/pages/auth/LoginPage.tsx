import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { ROUTES } from '@/constants/routes'
import {
  sendEmailOtp,
  verifyEmailOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
} from '@/services/authService'
import { CheckCircle2, XCircle, Eye, EyeOff, Video } from 'lucide-react'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordRequirementsList } from '@/components/ui/PasswordRequirementsList'
import { validatePassword } from '@/utils/password'
import { toUserMessage } from '@/utils/userMessage'
import { trackUserAction } from '@/utils/analytics'
import { usePageTutorial } from '@/hooks/usePageTutorial'
import { PageVideoTutorialModal } from '@/components/common/PageVideoTutorialModal'

type EmailVerifyStep = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified'
type ForgotStep = 'email' | 'otp' | 'new_password' | 'success'

export const LoginPage = () => {
  const { loginWithEmail, registerWithEmail, loading } = useAuth()
  const pageTutorial = usePageTutorial('login')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
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

  // Email OTP verification flow (signup only)
  const [verifyStep, setVerifyStep] = useState<EmailVerifyStep>('idle')
  const [otp, setOtp] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [resendIn, setResendIn] = useState(0)

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

      const cleanPhone = phone.trim()
      if (!cleanPhone || cleanPhone.length < 7) {
        setError('Please enter a valid phone number (at least 7 digits)')
        return
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
    }

    setIsSigningIn(true)
    try {
      if (isRegistering) {
        await registerWithEmail(cleanEmail, password, firstName.trim(), lastName.trim(), phone.trim())
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
    setError('')
    setOtp('')
    setOtpMessage('')
    setVerifyStep('idle')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
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
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-100 p-3 sm:p-6 md:p-8 overflow-y-auto">
      {/* Main Card */}
      <div className="flex flex-col md:flex-row w-full max-w-4xl rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 bg-white my-auto">

        {/* Top / Left Panel — Branding */}
        <div className="md:w-5/12 px-6 py-8 sm:p-10 md:p-12 flex flex-col justify-between gap-6 sm:gap-8"
          style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 45%, #0a0a2e 100%)', color: '#fff' }}>
          <div>
            <div className="mb-6 sm:mb-10">
              <img src="/seznik_white_logo.png" alt="Seznik" className="w-28 sm:w-36 md:w-40 h-auto object-contain" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-3">
              Precision in every
              <br />
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>transaction.</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              A premium retail POS designed to turn complex inventory into a seamless digital editorial for your business.
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
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {isRegistering ? 'Create Your Account' : 'Welcome Back'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {isRegistering
                  ? 'Fill in your details below to set up your business'
                  : 'Enter your credentials to access your terminal'}
              </p>
            </div>
            {pageTutorial.tutorialData && (
              <button
                onClick={pageTutorial.openTutorial}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all shadow-sm shrink-0 cursor-pointer"
                title="Watch Video Guide & Tutorial"
              >
                <Video size={14} className="animate-pulse" />
                <span className="whitespace-nowrap">Video Guide</span>
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-4">
            {isRegistering && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2 border border-slate-300 rounded-xl text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a0a2e]"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2 border border-slate-300 rounded-xl text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a0a2e]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  readOnly={isRegistering && verifyStep === 'verified'}
                  className={`flex-1 min-w-0 px-3.5 py-2.5 sm:py-2 border rounded-xl text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] ${
                    isRegistering && verifyStep === 'verified'
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-slate-300'
                  }`}
                  placeholder="admin@example.com"
                />
                {isRegistering && (
                  verifyStep === 'verified' ? (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-xl shrink-0">
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
                <p className="text-xs text-slate-500 mt-1">{otpMessage}</p>
              )}
            </div>

            {isRegistering && (verifyStep === 'sent' || verifyStep === 'verifying') && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Verification Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => handleOtpChange(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 sm:py-2 border border-slate-300 rounded-xl text-[16px] sm:text-base focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] tracking-[0.4em] font-semibold text-center"
                    placeholder="••••••"
                  />
                </div>
              </div>
            )}

            {isRegistering && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 sm:py-2 border border-slate-300 rounded-xl text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a0a2e]"
                  placeholder="+91 98765 43210"
                />
              </div>
            )}

            {/* Password Field with Eye Toggle and Visual Validation */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs sm:text-sm font-medium text-slate-700">
                  {isRegistering ? 'Create Password' : 'Password'}
                </label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={handleOpenForgotModal}
                    className="text-xs text-[#0a0a2e] font-semibold hover:underline"
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
                  className={`w-full px-3.5 py-2.5 sm:py-2 pr-10 border rounded-xl text-[16px] sm:text-sm focus:outline-none focus:ring-2 transition-all ${
                    isRegistering && isRegPassValid
                      ? 'border-emerald-500 focus:ring-emerald-400 bg-emerald-50/15'
                      : isRegistering && isRegPassInvalid
                      ? 'border-red-400 focus:ring-red-400 bg-red-50/15'
                      : 'border-slate-300 focus:ring-[#0a0a2e]'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors cursor-pointer"
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
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-3.5 py-2.5 sm:py-2 pr-10 border rounded-xl text-[16px] sm:text-sm focus:outline-none focus:ring-2 transition-all ${
                      isRegConfirmValid
                        ? 'border-emerald-500 focus:ring-emerald-400 bg-emerald-50/15'
                        : isRegConfirmInvalid
                        ? 'border-red-400 focus:ring-red-400 bg-red-50/15'
                        : 'border-slate-300 focus:ring-[#0a0a2e]'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors cursor-pointer"
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

            <button
              type="submit"
              disabled={isSigningIn || loading || (isRegistering && (!isRegPassValid || !isRegConfirmValid))}
              className="mt-3 sm:mt-4 w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-[#0a0a2e] text-white text-sm sm:text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              style={{ boxShadow: '0 10px 25px -5px rgba(10,10,46,0.3)' }}
            >
              {isSigningIn || loading ? <Spinner size="sm" className="text-white" /> : (isRegistering ? 'Sign Up' : 'Sign In')}
            </button>
          </form>

          {/* Sign Up / Log In Link */}
          <p className="text-center mt-8 text-sm text-slate-500">
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={switchMode} className="text-[#0a0a2e] font-semibold hover:underline">
              {isRegistering ? 'Log in' : 'Sign Up'}
            </button>
          </p>

          {/* Footer */}
          <div className="flex justify-center gap-5 mt-10 text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex-wrap">
            <a href="#" className="hover:text-slate-600">Security</a>
            <a href="#" className="hover:text-slate-600">Privacy Policy</a>
            <a href="#" className="hover:text-slate-600">Terms</a>
          </div>
          <p className="text-center mt-2 text-[10px] text-slate-300">© 2026 Seznik POS. All rights reserved.</p>
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
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {forgotError}
            </div>
          )}

          {forgotStep === 'email' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
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
                className="w-full bg-[#0a0a2e] text-white hover:bg-[#1e1b6e]"
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
              <p className="text-sm text-slate-600">
                Enter the 6-digit verification code sent to <strong className="text-slate-900">{forgotEmail}</strong>.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] tracking-[0.4em] font-semibold text-center text-lg"
                  placeholder="••••••"
                  autoFocus
                />
              </div>

              {forgotMessage && <p className="text-xs text-slate-500">{forgotMessage}</p>}

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
                  className="w-2/3 bg-[#0a0a2e] text-white hover:bg-[#1e1b6e]"
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
                  className="text-xs text-[#0a0a2e] font-semibold disabled:opacity-50 hover:underline"
                >
                  {forgotResendIn > 0 ? `Resend code in ${forgotResendIn}s` : 'Resend Code'}
                </button>
              </div>
            </div>
          )}

          {forgotStep === 'new_password' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Create a new password for <strong className="text-slate-900">{forgotEmail}</strong>.
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
                  isForgotConfirmValid ? 'text-emerald-600' : 'text-red-500'
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
                className="w-full bg-[#0a0a2e] text-white hover:bg-[#1e1b6e]"
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
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">Password Updated!</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>
              <Button
                className="w-full bg-[#0a0a2e] text-white hover:bg-[#1e1b6e]"
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

