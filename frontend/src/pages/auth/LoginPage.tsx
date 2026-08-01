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
import { CheckCircle2 } from 'lucide-react'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordRequirementsList } from '@/components/ui/PasswordRequirementsList'
import { validatePassword } from '@/utils/password'
import { trackUserAction } from '@/utils/analytics'

type EmailVerifyStep = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified'
type ForgotStep = 'email' | 'otp' | 'new_password' | 'success'

export const LoginPage = () => {
  const { loginWithEmail, registerWithEmail, loading } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      setError(err instanceof Error ? err.message : 'Failed to send verification code')
    }
  }

  const handleVerifyOtp = async () => {
    setError('')
    setVerifyStep('verifying')
    try {
      await verifyEmailOtp(email.trim(), otp.trim())
      setVerifyStep('verified')
      setOtpMessage('')
    } catch (err) {
      setVerifyStep('sent')
      setError(err instanceof Error ? err.message : 'Incorrect code')
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (isRegistering && verifyStep !== 'verified') {
      setError('Please verify your email before signing up')
      return
    }

    if (isRegistering) {
      const { isValid, failedRequirements } = validatePassword(password)
      if (!isValid) {
        setError(`Password requirements missing: ${failedRequirements.join(', ')}`)
        return
      }
    }

    setIsSigningIn(true)
    try {
      if (isRegistering) {
        await registerWithEmail(email.trim(), password, firstName, lastName, phone.trim())
        trackUserAction('user_register_success', { email: email.trim() })
      } else {
        await loginWithEmail(email, password)
        trackUserAction('user_login_success', { email: email.trim() })
      }
      navigate(ROUTES.ACCESS_SELECTION)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
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
      setForgotMessage(`We sent a 6-digit reset code to ${forgotEmail.trim()}`)
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to send reset code')
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
      setForgotError(err instanceof Error ? err.message : 'Incorrect verification code')
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
      setForgotError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleFinishForgot = () => {
    setEmail(forgotEmail.trim())
    setPassword('')
    setIsForgotModalOpen(false)
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f1f5f9] p-4 sm:p-6">
      {/* Main Card */}
      <div className="flex flex-col sm:flex-row w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl">

        {/* Top / Left Panel — Branding */}
        <div className="sm:w-1/2 px-8 py-10 sm:p-12 flex flex-col justify-between gap-8"
          style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 45%, #0a0a2e 100%)', color: '#fff' }}>
          <div>
            <div className="mb-8 sm:mb-12">
              <img src="/seznik_white_logo.png" alt="Seznik" className="w-32 sm:w-40 h-auto object-contain" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-4">
              Precision in every
              <br />
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>transaction.</span>
            </h1>
            <p className="text-sm sm:text-base leading-relaxed opacity-75 max-w-xs">
              A premium retail POS designed to turn complex inventory into a seamless digital editorial for your business.
            </p>
          </div>

          {/* Feature Badges */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>, label: 'MULTI-STORE SYNC' },
              { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, label: 'SECURE LEDGER' },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide"
                style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                {b.icon}
                {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom / Right Panel — Form */}
        <div className="sm:w-1/2 px-8 py-10 sm:px-14 sm:py-16 bg-white flex flex-col justify-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-2">{isRegistering ? 'Create Account' : 'Welcome to Seznik POS'}</h2>
          <p className="text-sm text-slate-500 mb-8">{isRegistering ? 'Sign up to get started.' : 'Enter your credentials to access your store dashboard.'}</p>

          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
            
            {isRegistering && (
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a0a2e]"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a0a2e]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  readOnly={isRegistering && verifyStep === 'verified'}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] ${
                    isRegistering && verifyStep === 'verified'
                      ? 'border-emerald-300 bg-emerald-50/50 pr-28'
                      : 'border-slate-300 ' + (isRegistering ? 'pr-24' : '')
                  }`}
                  placeholder="admin@example.com"
                />
                {isRegistering && (
                  <div className="absolute inset-y-0 right-1.5 flex items-center">
                    {verifyStep === 'verified' ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold px-2">
                        <CheckCircle2 size={14} /> Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={verifyStep === 'sending' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (verifyStep === 'sent' && resendIn > 0)}
                        className="px-3 py-1.5 rounded-md bg-gradient-to-r from-blue-600 to-sky-400 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                      >
                        {verifyStep === 'sending' ? 'Sending…' : verifyStep === 'sent' ? (resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend') : 'Verify'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {isRegistering && otpMessage && verifyStep !== 'verified' && (
                <p className="text-xs text-slate-500 mt-1">{otpMessage}</p>
              )}
            </div>

            {isRegistering && (verifyStep === 'sent' || verifyStep === 'verifying') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Verification Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a0a2e] tracking-[0.4em] font-semibold text-center"
                    placeholder="••••••"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otp.length !== 6 || verifyStep === 'verifying'}
                    className="px-4 py-2 rounded-lg bg-[#0a0a2e] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {verifyStep === 'verifying' ? 'Checking…' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}

            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  pattern="\+?[0-9][0-9\s-]{6,14}"
                  title="Enter a valid phone number (7–15 digits)"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a0a2e]"
                  placeholder="+91 98765 43210"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-slate-700">Password</label>
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
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a0a2e]"
                placeholder="••••••••"
              />
              {isRegistering && <PasswordRequirementsList password={password} showOnlyIfTyped />}
            </div>

            <button
              type="submit"
              disabled={isSigningIn || loading || (isRegistering && verifyStep !== 'verified')}
              className="mt-4 w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-lg bg-[#0a0a2e] text-white text-sm sm:text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
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
                autoFocus
              />
              <PasswordRequirementsList password={forgotNewPassword} />
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-enter new password"
                value={forgotConfirmPassword}
                onChange={(e) => setForgotConfirmPassword(e.target.value)}
              />
              <Button
                className="w-full bg-[#0a0a2e] text-white hover:bg-[#1e1b6e]"
                onClick={handleResetPassword}
                loading={forgotLoading}
                disabled={!forgotNewPassword || forgotNewPassword.length < 6 || forgotNewPassword !== forgotConfirmPassword}
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
    </div>
  )
}

