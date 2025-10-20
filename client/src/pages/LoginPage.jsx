import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validateEmail = (value) => {
    if (!value) return "Please enter an email address.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? "" : "Please enter a valid email address.";
  };

  const validatePassword = (value) => {
    if (!value) return "Please enter your password.";
    return "";
  };

  // Clear message pop-up after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
      }
  }, [message]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);

    setEmailError(emailErr);
    setPasswordError(passwordErr);

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
    <div className={`login-frame ${shake ? 'shake' : ''}`}>
      <h1 className="login-title">The Bulletin</h1>

      {/*Put actual Bulletin logo here later*/}
      <div className="bulletin-image">
          <span>[ Skibidi ]</span>
        </div>

      <form onSubmit={handleLogin} className={"login-form"}>
        <div className="email-input-container">
          <input
            type="text"
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

        <div className="password-input-container">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordError("")
            }}
            className={passwordError ? "input-error" : ""}
          />  
          {passwordError && <span className="input-error-text">{passwordError}</span>}

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
        <button 
          type="button"
          className="register-btn" 
          onClick={() => navigate('/register')}
        > 
          Register Here
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
