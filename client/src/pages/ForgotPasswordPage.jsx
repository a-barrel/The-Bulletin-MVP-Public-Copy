import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import './ForgotPasswordPage.css';
import { sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [shake, setShake] = useState(false);
  
    useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000); // hide after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [error]);
 
  const handleEmailSubmission = async (e) => {
  e.preventDefault();
  setError(null);

  // Check for empty fields before calling Firebase
    if (!email) {
      setError('Please enter an email.');
      return;
    }
  
    try {
      //await sendPasswordResetEmail(auth, email); 
      setError("A password reset link has been sent to your email. Please check your inbox. Redirecting to reset page...");
      const timer = setTimeout(() => navigate('/reset-password'), 2000);
    } catch (error) {
      switch (error.code) {
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/user-not-found':
          setError('No account found with this email.');
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
    <div className={`forgot-password-page ${shake ? 'shake' : ''}`}>
      <div className="forgot-password-frame">
        <h1 className="forgot-password-title">The Bulletin</h1>

        <p className="instruction-text">
          Enter the email of the account you are trying to access.
        </p>

        {error && (
          <div className="error-overlay" onClick={() => setError(null)}>
            <div className="error-box">
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleEmailSubmission} className={"forgot-password-form"}>
          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        <button type="submit" className="submit-email-btn">Submit</button>
        </form>
        <button type="submit" className="back-btn" onClick={() => navigate('/login')}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
