import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import './ResetPasswordPage.css';
import { confirmPasswordReset, updatePassword } from 'firebase/auth';

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
    return;
  }

  if (newPassword != confirmNewPassword) {
    setError('Passwords are not matching. Please re-enter them again.');
    return;
  }

  try {
    await confirmPasswordReset(auth, newPassword, confirmNewPassword);
    navigate('/map');
  } catch (error) {
    switch (error.code) {
      case 'auth/invalid-email':
        setError('Please enter a valid email address.');
        break;
      case 'auth/user-not-found':
        setError('No account found with this email.');
        break;
      case 'auth/wrong-password':
        setError('Incorrect password. Try again.');
        break;
      case 'auth/missing-password':
        setError('Please enter your password.');
        break;
      default:
        setError('Login failed. Please try again.');
        break;
    }
    setShake(true);
    setTimeout(() => setShake(false), 300);
  }
};

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/map');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className={`reset-password-page ${shake ? 'shake' : ''}`}>
      <div className="phone-frame">
        <h1 className="page-title">The Bulletin</h1>

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
