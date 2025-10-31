import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import "./LoginPage.css";
import bulletinLogo from "../../uploads/images/PinPoint_Logo.png";
import { applyAuthPersistence, AUTH_PERSISTENCE } from "../utils/authPersistence";
import { routes } from "../routes";
import AuthPageLayout from "../components/AuthPageLayout.jsx";
import PasswordField from "../components/PasswordField.jsx";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const stored = window.localStorage.getItem("bulletin:rememberMe");
    if (stored === null) {
      return true;
    }
    return stored === "true";
  });
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("bulletin:rememberMe", remember ? "true" : "false");
  }, [remember]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);

    setEmailError(emailErr);
    setPasswordError(passwordErr);

    try {
      const persistenceMode = remember ? AUTH_PERSISTENCE.LOCAL : AUTH_PERSISTENCE.SESSION;
      await applyAuthPersistence(auth, persistenceMode);
      await signInWithEmailAndPassword(auth, email, password);
      navigate(routes.map.base);
    } catch (error) {
      switch (error.code) {
        // Only big errors (e.g. no account with email or login failure) will get a popup.
        // Else, blank or missing parameters just get a simple text error.
        case "auth/invalid-email":
          //setError("Please enter a valid email address.");
          break;
        case "auth/user-not-found":
          setError("No account found with this email.");
          break;
        case "auth/wrong-password":
          setError("Incorrect password. Try again.");
          break;
        case "auth/missing-password":
          //setError("Please enter your password.");
          break;
        default:
          setError("Login failed. Please try again.");
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
        const persistenceMode = remember ? AUTH_PERSISTENCE.LOCAL : AUTH_PERSISTENCE.SESSION;
        await applyAuthPersistence(auth, persistenceMode);
        await signInWithPopup(auth, provider);
        navigate(routes.map.base);
      } catch (error) {
        setError(error.message);
      }
    };

  const alerts = [];
  if (error) {
    alerts.push({
      id: "error",
      type: "error",
      content: error,
      overlayClassName: "error-overlay",
      boxClassName: "error-box",
      onClose: () => setError(null)
    });
  }
  if (message) {
    alerts.push({
      id: "message",
      type: "info",
      content: message,
      onClose: () => setMessage(null)
    });
  }

  return (
    <AuthPageLayout
      shake={shake}
      title="The Bulletin"
      titleClassName="page-title"
      alerts={alerts}
    >
      <div className="bulletin-image">
        <img src={bulletinLogo} alt="PinPoint logo" />
      </div>

      <form onSubmit={handleLogin} className={"page-form"}>
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

        <PasswordField
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setPasswordError("");
          }}
            placeholder="Enter Password"
          error={passwordError}
          showPassword={showPassword}
          onToggleVisibility={() => setShowPassword((prev) => !prev)}
          autoComplete="current-password"
        />

        <div className="additional-options">
          <label className="remember-me-checkbox"> {/*Controls session persistence*/}
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
              onClick={() => navigate(routes.auth.forgotPassword)}
            > 
              Forgot Password?
            </span>
          </div>
        </div>
          
        <button type="submit" className="login-page-login-btn">Login</button>

        <button 
          type="button"
          className="login-page-google-sign-in-btn" 
          onClick={handleGoogleSignIn}
        >
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
          className="login-page-register-btn" 
          onClick={() => navigate(routes.auth.register)}
        > 
          Register Here
        </button>    
      </form>
    </AuthPageLayout>
  );
}

export default LoginPage;
