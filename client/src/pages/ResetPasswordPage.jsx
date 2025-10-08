import React, { useState, useEffect, use } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import './ResetPasswordPage.css';
import { confirmPasswordReset } from 'firebase/auth';

function getPasswordStrength(password) {
  let score = 0;

  // Checks password length
  if (password.length > 8) score += 1;
  if (password.length > 12) score += 1;

  // Checks if password contains lowercase
  if (/[a-z]/.test(password)) score += 1;

  // Checks if password contains uppercase
  if (/[A-Z]/.test(password)) score += 1;

  // Checks if password contains numbers
  if (/\d/.test(password)) score += 1;

  // Checks if password contains special characters
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  switch (score) {
    case 0:
    case 1:
    case 2:
      return "Weak";
    
    case 3:
    case 4:
      return "Medium";

    case 5:
    case 6:
      return "Strong";
  }
}

function getPasswordStrengthColor(strength) {
    if (strength == "Weak") return "red";
    if (strength == "Medium") return "orange";
    else return "green";
  }

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [strength, setStrength] = useState('');
  const [strengthColor, setStrengthColor] = useState('');
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

  // Call for simple errors before attempting to authenticate 
  if (!newPassword || !confirmNewPassword) {
    setError("Please enter a password and confirm it in the fields.");
    setShake(true);
    setTimeout(() => setShake(false), 300);
    return;
  }

  if (newPassword != confirmNewPassword) {
    setError("Passwords are not matching. Please re-enter them again.");
    setShake(true);
    setTimeout(() => setShake(false), 300);
    return;
  }

  if (strength != "Strong") {
    setError("Password is too weak. Make it stronger.");
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

        {/* TODO: UN-CENTER THIS S%@* */}
        <div className="reset-password-strength">
          <small
            className="reset-password-label"
            style={{ color: strengthColor }}
          >
            Password strength: {strength || "-"}
          </small>
        </div>

        <form onSubmit={handlePasswordReset} className={"reset-password-form"}>
          <input
            type="password"
            placeholder="Enter New Password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setStrength(getPasswordStrength(e.target.value));
              setStrengthColor(getPasswordStrengthColor(strength));
            }}
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
