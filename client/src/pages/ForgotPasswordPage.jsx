import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import './ForgotPasswordPage.css';
import { sendPasswordResetEmail } from 'firebase/auth';
import AuthPageLayout from '../components/AuthPageLayout.jsx';
import AuthEmailField, { validateAuthEmail } from '../components/AuthEmailField.jsx';
import useShake from '../hooks/useShake.js';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState("");
  const { shake, triggerShake } = useShake();
  
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

    const emailErr = validateAuthEmail(email);
    setEmailError(emailErr);

    if (emailErr) {
      triggerShake();
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('If this email is in use, a password reset email has been sent.');
    } catch (err) {
      setError(mapFirebaseError(err?.code));
      triggerShake();
    }
  };

  const alerts = [];
  if (error) {
    alerts.push({
      id: 'error',
      type: 'error',
      content: error,
      overlayClassName: 'message-overlay',
      boxClassName: 'message-box',
      onClose: () => setError(null)
    });
  }
  if (message) {
    alerts.push({
      id: 'message',
      type: 'info',
      content: message,
      onClose: () => setMessage(null)
    });
  }

  return (
    <AuthPageLayout
      shake={shake}
      onBack={() => navigate(-1)}
      title="Forgot Password?"
      alerts={alerts}
    >
      <p className="instruction-text">
        Enter the email of the account you are trying to access.
      </p>

      <form onSubmit={handleEmailSubmission} className={"page-form"}>
        <AuthEmailField
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
          onErrorChange={setEmailError}
          placeholder="Enter Email"
        />
        
        <button 
          type="submit" 
          className="forgot-password-page-submit-email-btn"
        >
          Submit
        </button>
      </form>
    </AuthPageLayout>
  );
}

export default ForgotPasswordPage;
