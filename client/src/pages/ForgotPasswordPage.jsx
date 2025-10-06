import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import './ForgotPasswordPage.css';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
 

  return (
    <div className={"forgot-password-page"}>
      <div className="phone-frame">
        <h1 className="page-title">The Bulletin</h1>

        <h2 className="instruction-text">
          Enter the email of the account you are trying to access.
        </h2>

        <form onSubmit={''} className={"forgot-password-form"}>
          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        <button type="submit" className="submit-email-btn">Submit</button>
        </form>
        <button type="submit" className="go-back-btn" onClick={() => navigate('/login')}>
          Go Back
        </button>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
