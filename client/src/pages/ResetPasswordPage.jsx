import React, { useState, useEffect, use } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import './ResetPasswordPage.css';
import { confirmPasswordReset } from 'firebase/auth';

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
  if (error) {
    const timer = setTimeout(() => setError(null), 3000); // hide after 3 seconds
    return () => clearTimeout(timer);
  }
}, [error]);
  
  const handlePasswordReset = async (e) => {
  e.preventDefault();
  setError(null);

  // Check for empty fields before calling Firebase
  if (!newPassword || !confirmNewPassword) {
    setError('Please enter a password and confirm it in the fields.');
    setShake(true);
    setTimeout(() => setShake(false), 300);
    return;
  }

  if (newPassword != confirmNewPassword) {
    setError('Passwords are not matching. Please re-enter them again.');
    setShake(true);
    setTimeout(() => setShake(false), 300);
    return;
  }

  try {
    // Simulates the password reset
    //await confirmPasswordReset(auth, oobCode, newPassword);
    setError('Your password has been reset successfully. Redirecting to login...');
    const timer = setTimeout(() => navigate('/login'), 2000);
  } catch (error) {
    switch (error.code) {
      case 'auth/expired-action-code':
        setError('This link has expired. Please request a new password reset.');
        break;
      case 'auth/invalid-action-code':
        setError('Invalid action code. Please request a new password reset.');
        break;
      case 'auth/weak-password':
        setError('Password is too weak. Please choose a stronger password.');
        break;
      default:
        setError('Something went wrong. Please try again.');
        break;
    }
    setShake(true);
    setTimeout(() => setShake(false), 300);
  }
};

  return (
    <div className={`reset-password-page ${shake ? 'shake' : ''}`}>
      <div className="reset-password-frame">
        <h1 className="reset-password-title">The Bulletin</h1>

        {error && (
          <div className="error-overlay" onClick={() => setError(null)}>
            <div className="error-box">
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handlePasswordReset} className={"reset-password-form"}>
          <input
            type="password"
            placeholder="Enter New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
          />    

          <button type="submit" className="submit-password-btn">Submit</button>
        </form>

      </div>
    </div>
  );
}

export default ResetPasswordPage;
