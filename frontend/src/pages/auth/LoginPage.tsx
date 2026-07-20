import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'
import { ROUTES } from '@/constants/routes'

export const LoginPage = () => {
  const { loginWithEmail, registerWithEmail, loading } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSigningIn(true)
    setError('')
    try {
      if (isRegistering) {
        await registerWithEmail(email, password, firstName, lastName)
      } else {
        await loginWithEmail(email, password)
      }
      navigate(ROUTES.ACCESS_SELECTION)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f1f5f9] p-4 sm:p-6">
      {/* Main Card */}
      <div className="flex flex-col sm:flex-row w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl">

        {/* Top / Left Panel — Branding */}
        <div className="sm:w-1/2 px-8 py-10 sm:p-12 flex flex-col justify-between gap-8"
          style={{ background: 'linear-gradient(135deg, #0a0a2e 0%, #1e1b6e 40%, #3b3ba0 100%)', color: '#fff' }}>
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
            {error && <p className="text-red-500 text-sm">{error}</p>}
            
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
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a0a2e]"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a0a2e]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSigningIn || loading}
              className="mt-4 w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-lg bg-[#0a0a2e] text-white text-sm sm:text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 10px 25px -5px rgba(10,10,46,0.3)' }}
            >
              {isSigningIn || loading ? <Spinner size="sm" className="text-white" /> : (isRegistering ? 'Sign Up' : 'Sign In')}
            </button>
          </form>

          {/* Trial Link */}
          <p className="text-center mt-8 text-sm text-slate-500">
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-[#0a0a2e] font-semibold hover:underline">
              {isRegistering ? 'Log in' : 'Start 14-day free trial'}
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
    </div>
  )
}
