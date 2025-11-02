/* NOTE: Page exports configuration alongside the component. */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './LogoutPage.css'; // Same as LoginPage.css
import { revokeCurrentSession } from '../api/mongoDataApi';
import { routes } from '../routes';
import AuthPageLayout from '../components/AuthPageLayout.jsx';

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

  useEffect(() => {
    const handleLogout = async () => {
      try {
        try {
          await revokeCurrentSession();
        } catch (error) {
          console.error('Failed to revoke server session during logout.', error);
        }

        await signOut(auth);
        navigate(routes.auth.login);
      } catch (error) {
        console.error("Error signing out: ", error);
        navigate(routes.auth.login);
      }
    };

    handleLogout();
  }, [navigate]);

  return (
    <AuthPageLayout baseClassName="" className="login-page">
      <div className="login-frame">
        <h1 className="login-title">Logging you out...</h1>
      </div>
    </AuthPageLayout>
  );
}

export default LogoutPage;
