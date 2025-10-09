import React, { useState, useEffect, use } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import './ResetPasswordPage.css';
import { confirmPasswordReset } from 'firebase/auth';

function getPasswordStrength(password) {
  let score = 0;

  // Checks password length
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;

  // Checks if password contains lowercase
  if (/[a-z]/.test(password)) score += 1;

  // Checks if password contains uppercase
  if (/[A-Z]/.test(password)) score += 1;

  // Checks if password contains numbers
  if (/\d/.test(password)) score += 1;

  // Checks if password contains special characters
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  let label = "Weak";
  if (score <= 2) label = "Weak";
  else if (score <= 4) label = "Medium";
  else label = "Strong";

  return { label, score };
}

function getPasswordStrengthColor(score) {
    if (score == 0) return "grey";
    if (score <= 2) return "red";
    if (score <= 4) return "orange";
    return "green";
  }

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [strength, setStrength] = useState({ label: "", score: 0});
  const [strengthColor, setStrengthColor] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(null);
  const passwordRequirements = [
    { label: "An uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
    { label: "A lowercase letter", test: (pw) => /[a-z]/.test(pw) },
    { label: "A number", test: (pw) => /\d/.test(pw) },
    { label: "A special character", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
    { label: "At least 8 characters long", test: (pw) => pw.length >= 8 }
  ];

  useEffect(() => {
    const s = getPasswordStrength(newPassword);
    setStrength(s);
  }, [newPassword]);

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

  const fillPercent = (strength.score / 6) * 100;
  const fillColor = getPasswordStrengthColor(strength.score);

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

          <div className="password-strength-container">
            <small className="password-strength-label">
              Password strength:{' '}
              <span 
                style={{ 
                  className: "password-strength-text",
                  color: newPassword ? fillColor : 'grey',
                }}
              >
                {strength.label || 'N/A'}
              </span>
            </small>

            <div className="password-strength-bar" aria-hidden>
              <div 
              className="password-strength-fill" 
              style={{ 
                width: `${fillPercent}%`, 
                backgroundColor: newPassword ? fillColor : 'grey' 
                }}>
              </div>
            </div>
        </div>

          <div className="password-req">Make sure your password meets the following:
            <ul className="password-req-list">
              {passwordRequirements.map((req, index) => {
                const passed = req.test(newPassword);
                return (
                  <li 
                    key={index} 
                    style={{ color: passed ? 'green' : 'red', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {passed ? '✅' : '❌'} {req.label}
                  </li>
                )
              })}
            </ul>
          </div>
          
          <button type="submit" className="submit-password-btn">Submit</button>
        </form>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
