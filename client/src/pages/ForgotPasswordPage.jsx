import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import './ForgotPasswordPage.css';
import { sendPasswordResetEmail } from 'firebase/auth';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState("");
  const [shake, setShake] = useState(false);
  
  const validateEmail = (value) => {
    if (!value) return "Please enter an email address.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? "" : "Please enter a valid email address.";
  };

  // Clear error pop-up after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000); 
      return () => clearTimeout(timer);
    }
  }, [error]);
 
  const mapFirebaseError = (code) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
        return 'No account found with that email.';
      case 'auth/missing-email':
        return 'Please enter an email address.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  };

  const handleEmailSubmission = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const emailErr = validateEmail(email);
    setEmailError(emailErr);

    if (emailErr) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('If this email is in use, a password reset email has been sent.');
    } catch (err) {
      setError(mapFirebaseError(err?.code));
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
  };

  return (
    <div className={`page-background ${shake ? 'shake' : ''}`}>
      <div className="page-header">
        <button
          className="page-back-btn"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
        &#8592;
        </button>

        <h1 className="page-sub-title">Forgot Password?</h1>
      </div>

      <p className="instruction-text">
        Enter the email of the account you are trying to access.
      </p>

      {error && (
        <div className="message-overlay" onClick={() => setError(null)}>
          <div className="message-box">
            <p>{error}</p>
          </div>
        </div>
      )}

      {message && (
        <div className="message-overlay" onClick={() => setMessage(null)}>
          <div className="message-box">
            <p>{message}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleEmailSubmission} className={"page-form"}>
        <div className="input-container">
          <input
            type="text" // Allow as text, external function will verify if it is email and call error if needed   
            placeholder="Enter Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError("")
            }}
            className={emailError ? "input-error" : ""}
          />
          {emailError && <span className="input-error-text">{emailError}</span>}
        </div>
        
        <button 
          type="submit" 
          className="forgot-password-page-submit-email-btn"
        >
          Submit
        </button>
      </form>
    </div>
  );
}

export default ForgotPasswordPage;
