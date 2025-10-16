import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './LoginPage.css';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
  if (error) {
    const timer = setTimeout(() => setError(null), 3000); // hide after 3 seconds
    return () => clearTimeout(timer);
  }
}, [error]);
  
  const handleLogin = async (e) => {
  e.preventDefault();
  setError(null);

  // Check for empty fields before calling Firebase
  if (!email || !password) {
    setError('Please enter both email and password.');
    setShake(true);
    setTimeout(() => setShake(false), 300);
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
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
    <div className={`login-page ${shake ? 'shake' : ''}`}>
      <div className="login-frame">
        <h1 className="login-title">The Bulletin</h1>

        {/*Put actual Bulletin logo here later*/}
        <div className="bulletin-image">
          <span>[ Skibidi ]</span>
        </div>

        {error && (
          <div className="error-overlay" onClick={() => setError(null)}>
            <div className="error-box">
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className={"login-form"}>
          <div className="email-input-container">
            <input
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="password-input-container">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />  

            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <div className="additional-options">
            <label className="remember-me-checkbox"> {/*NOTE: This doesn't do anything currently*/}
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={() => setRemember(!remember)}
                />
                Remember me
              </label>
            
            <div className="forgot-password-link">
              <span
                className="forgot-password-clickable"
                onClick={() => navigate('/forgot-password')}
              > 
                Forgot Password?
              </span>
            </div>
          </div>
          
          <button type="submit" className="login-btn">Login</button>

          <button className="google-btn" onClick={handleGoogleSignIn}>
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google logo"
            className="google-icon"
          />
          Sign in with Google
          </button>
          <p className="getting-started-text">Getting started?</p>
          <button className="register-btn" onClick={() => navigate('/register')}> {/*NOTE: This doesn't navigate anywhere currently*/}
            Register Here
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
