import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import './ForgotPasswordPage.css';
import { sendPasswordResetEmail } from 'firebase/auth';

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
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }
  
  // TODO: DARREL - Messy implementation, it does send a email, refactor later. 
  // DARREL - Made errors the same to avoid email enumeration
  try {
      await sendPasswordResetEmail(auth, email);
      setError('If this email is in use, a password reset email will be sent!');
    } catch (error) {
      setError('If this email is in use, a password reset email will be sent!');
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
          
          <button 
            type="submit" 
            className="submit-email-btn"
          >
            Submit
          </button>

          <button 
            type="button"
            className="cancel-btn"
            onClick={() => navigate('/login')}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
