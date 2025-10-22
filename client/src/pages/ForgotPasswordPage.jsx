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
 
  const handleEmailSubmission = async (e) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(email);
    setEmailError(emailErr);

    // Check for empty fields before calling Firebase
    if (!email) {
      setEmailError('Please enter an email.');
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }
  
    // TODO: DARREL - Messy implementation, it does send a email, refactor later. 
    // DARREL - Made errors the same to avoid email enumeration
    try {
      //await sendPasswordResetEmail(auth, email);
      setMessage('If this email is in use, a password reset email will be sent!');
    } catch (error) {
      setMessage('If this email is in use, a password reset email will be sent!');
    }
  };

  return (
    <div className={`page-background ${shake ? 'shake' : ''}`}>
      <div className="page-header">
        <button
          className="page-back-btn"
          aria-label="Go back"
          onClick={() => navigate("./login")}
        >
        &#8592;
        </button>

        <h1 className="page-sub-title">Forgot Password?</h1>
      </div>

      <p className="instruction-text">
        Enter the email of the account you are trying to access.
      </p>

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
