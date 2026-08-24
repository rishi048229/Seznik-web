import React, { useEffect, useState } from 'react';
import App from './App';
import { LoginPage } from './pages/LoginPage';
import { fetchAdminSession, logoutAdmin } from './services/authService';

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
  const [userId, setUserId] = useState('SezAdmin');

  const enterGuest = () => {
    showLoginRoute();
    setStatus('guest');
  };

  const enterApp = (id: string) => {
    setUserId(id);
    showAppRoute();
    setStatus('authed');
  };

  useEffect(() => {
    let cancelled = false;
    fetchAdminSession()
      .then((session) => {
        if (!cancelled) enterApp(session.userId);
      })
      .catch(() => {
        if (!cancelled) enterGuest();
      });

    const onExpired = () => enterGuest();
    window.addEventListener('admin-auth-required', onExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('admin-auth-required', onExpired);
    };
  }, []);

  const handleLogout = async () => {
    await logoutAdmin().catch(() => undefined);
    enterGuest();
  };

  if (status === 'loading') {
    return (
      <div className="admin-login-shell">
        <div className="pulse-dot" style={{ width: '14px', height: '14px' }} />
      </div>
    );
  }

  if (status === 'guest') {
    return <LoginPage onSuccess={enterApp} />;
  }

  return <App userId={userId} onLogout={handleLogout} />;
};
