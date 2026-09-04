import React, { useEffect, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { fetchSupportSession, logoutSupport } from './services/authService';
import type { SupportAgentRecord } from './types/support';

type AuthStatus = 'loading' | 'guest' | 'authed';

function showLoginRoute() {
  if (window.location.pathname !== '/login') {
    window.history.replaceState(null, '', '/login');
  }
}

function showAppRoute() {
  if (window.location.pathname === '/login') {
    window.history.replaceState(null, '', '/');
  }
}

export const AuthRoot: React.FC = () => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [agent, setAgent] = useState<SupportAgentRecord | null>(null);

  const enterGuest = () => {
    showLoginRoute();
    setAgent(null);
    setStatus('guest');
  };

  const enterApp = (next: SupportAgentRecord) => {
    setAgent(next);
    showAppRoute();
    setStatus('authed');
  };

  useEffect(() => {
    let cancelled = false;
    fetchSupportSession()
      .then((session) => {
        if (!cancelled) enterApp(session.agent);
      })
      .catch(() => {
        if (!cancelled) enterGuest();
      });

    const onExpired = () => enterGuest();
    window.addEventListener('support-auth-required', onExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('support-auth-required', onExpired);
    };
  }, []);

  const handleLogout = async () => {
    await logoutSupport().catch(() => undefined);
    enterGuest();
  };

  if (status === 'loading') {
    return (
      <div className="support-login-shell">
        <div className="pulse-dot" style={{ width: '14px', height: '14px' }} />
      </div>
    );
  }

  if (status === 'guest' || !agent) {
    return <LoginPage onSuccess={enterApp} />;
  }

  return <HomePage agent={agent} onLogout={handleLogout} />;
};
