import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import './ForgotPasswordPage.css';

import { sendPasswordResetEmail } from "firebase/auth";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  
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
  
  // TODO: DARREL - Messy implementation, it does send a email, refactor later. 
  try {
      await sendPasswordResetEmail(auth, email);
      setError('Password reset email sent. Please check your inbox.'); // DARREL - This works, but not sure if you wana have a different popup for success
    } catch (error) {
      switch (error.code) {
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/user-not-found':
          setError('No account found with this email.');
          break;
        default:
          setError(`Error sending reset email: ${error.code} - ${error.message}`);
          break;
      }
    }
};

  return (
    <div className={"forgot-password-page"}>
      <div className="phone-frame">
        <h1 className="page-title">The Bulletin</h1>

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
