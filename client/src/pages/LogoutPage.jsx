/* NOTE: Page exports configuration alongside the component. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './LogoutPage.css'; // Same as LoginPage.css
import { revokeCurrentSession } from '../api';
import { routes } from '../routes';
import AuthPageLayout from '../components/AuthPageLayout.jsx';
import useAuthAlerts from '../hooks/useAuthAlerts';

export const pageConfig = {
  id: 'logout',
  label: 'Logout',
  path: '/logout',
  order: 80,
  showInNav: true,
  protected: true
};

function LogoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [statusMessage, setStatusMessage] = useState('Logging you out...');
  const [error, setError] = useState(null);
  const redirectTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const candidate = params.get('redirect');
    if (candidate && candidate.startsWith('/')) {
      return candidate;
    }
    return routes.auth.login;
  }, [location.search]);
  const alerts = useAuthAlerts({
    error,
    onErrorClear: () => setError(null),
    errorOverlayClassName: 'error-overlay',
    errorBoxClassName: 'error-box'
  });

  const performLogout = useCallback(async () => {
    setStatusMessage('Logging you out...');
    setError(null);
    try {
      try {
        await revokeCurrentSession();
      } catch (sessionError) {
        if (import.meta.env.DEV) {
          console.error('Failed to revoke server session during logout.', sessionError);
        }
      }
      await signOut(auth);
      navigate(redirectTarget, { replace: true });
    } catch (logoutError) {
      console.error('Error signing out:', logoutError);
      setError(logoutError?.message || 'Failed to sign out. Please try again.');
      setStatusMessage('Unable to sign out automatically.');
    }
  }, [navigate, redirectTarget]);

  useEffect(() => {
    performLogout();
  }, [performLogout]);

  return (
    <AuthPageLayout baseClassName="" className="login-page" alerts={alerts}>
      <div className="login-frame">
        <h1 className="login-title">{statusMessage}</h1>
        {error ? (
          <button type="button" className="login-page-login-btn" onClick={performLogout}>
            Retry logout
          </button>
        ) : null}
      </div>
    </AuthPageLayout>
  );
}

export default LogoutPage;
