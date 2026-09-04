import React, { useState } from 'react';
import { Lock, UserRound, LogIn, AlertTriangle, Eye, EyeOff, Headphones, Shield } from 'lucide-react';
import { AnimatedThemeToggler } from '../components/AnimatedThemeToggler';
import { loginSupport } from '../services/authService';
import type { SupportAgentRecord } from '../types/support';

interface LoginPageProps {
  onSuccess: (agent: SupportAgentRecord) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await loginSupport(username.trim(), password);
      onSuccess(result.agent);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid username or password';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="support-login-shell">
      <div className="support-login-theme">
        <AnimatedThemeToggler variant="circle" duration={500} />
      </div>

      <form className="support-login-card" onSubmit={handleSubmit}>
        <div className="support-login-brand">
          <img src="/seznik_logo.png" alt="Seznik" className="navbar-logo support-login-logo" />
          <span className="badge badge-active support-login-live">
            <Headphones size={12} />
            SUPPORT PORTAL
          </span>
          <h1>Seznik Support Portal</h1>
          <p>Sign in to issue customer access codes and review your generation history.</p>
        </div>

        {error && (
          <div className="support-login-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="support-login-fields">
          <label className="support-login-field" htmlFor="support-username">
            Username or email
          </label>
          <div className="support-login-input-wrap">
            <UserRound size={16} className="support-login-input-icon" aria-hidden />
            <input
              id="support-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="support.agent or name@company.com"
              required
            />
          </div>

          <label className="support-login-field" htmlFor="support-password">
            Password
          </label>
          <div className="support-login-input-wrap support-login-input-wrap--password">
            <Lock size={16} className="support-login-input-icon" aria-hidden />
            <input
              id="support-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
            <button
              type="button"
              className="support-login-eye"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button type="submit" className="support-login-submit" disabled={submitting}>
          <LogIn size={16} />
          {submitting ? 'Signing in…' : 'Sign in to portal'}
        </button>

        <div className="support-login-foot">
          <Shield size={13} />
          Authorized support agents only
        </div>
      </form>
    </div>
  );
};
