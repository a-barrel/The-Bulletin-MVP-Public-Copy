import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
} from "firebase/auth";
import "./LoginPage.css";
import bulletinLogo from "../../uploads/images/PinPoint_Logo.png";
import { applyAuthPersistence, AUTH_PERSISTENCE } from "../utils/authPersistence";
import { routes } from "../routes";
import AuthPageLayout from "../components/AuthPageLayout.jsx";
import PasswordField from "../components/PasswordField.jsx";
import AuthEmailField, { validateAuthEmail } from "../components/AuthEmailField.jsx";
import useShake from "../hooks/useShake.js";
import useRememberPreference from "../hooks/useRememberPreference";
import useAuthAlerts from "../hooks/useAuthAlerts";
import useProviderSignIn from "../hooks/useProviderSignIn";
import GoogleIcon from "@mui/icons-material/Google";
import AppleIcon from "@mui/icons-material/Apple";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useRememberPreference("bulletin:rememberMe", true);
  const [showPassword, setShowPassword] = useState(false);
  const { shake, triggerShake } = useShake();
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signInWithProvider, isPopupActive } = useProviderSignIn({ remember });

  const validatePassword = (value) => {
    if (!value) return "Please enter your password.";
    return "";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateAuthEmail(email);
    const passwordErr = validatePassword(password);

    setEmailError(emailErr);
    setPasswordError(passwordErr);

    if (emailErr || passwordErr) {
      triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
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
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithProvider(() => new GoogleAuthProvider());
      navigate(routes.map.base);
    } catch (popupError) {
      if (popupError?.message) {
        setError(popupError.message);
      } else {
        setError("Google sign-in failed. Please try again.");
      }
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    try {
      await signInWithProvider(() => new OAuthProvider("apple.com"));
      navigate(routes.map.base);
    } catch (signupError) {
      if (signupError?.code === "auth/operation-not-supported-in-this-environment") {
        setError("Apple sign-in is not available in this environment.");
      } else if (signupError?.code === "auth/account-exists-with-different-credential") {
        setError(
          "This email is linked to a different sign-in method. Try logging in with the original provider."
        );
      } else if (signupError?.message) {
        setError(signupError.message);
      } else {
        setError("Apple sign-in failed. Please try again.");
      }
    }
  };

  const alerts = useAuthAlerts({
    error,
    message,
    onErrorClear: () => setError(null),
    onMessageClear: () => setMessage(null),
    errorOverlayClassName: "error-overlay",
    errorBoxClassName: "error-box"
  });

  return (
    <AuthPageLayout
      shake={shake}
      className="login-page-layout"
      alerts={alerts}
    >
      <div className="bulletin-image">
        <img src={bulletinLogo} alt="PinPoint logo" />
      </div>

      <form onSubmit={handleLogin} className={"page-form"}>
        <AuthEmailField
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
          onErrorChange={setEmailError}
          placeholder="Enter Email"
          className="auth-input-container input-container"
          errorTextClassName="auth-input-error-text input-error-text"
        />

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
            onChange={() => setRemember((prev) => !prev)}
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
          
        <button
          type="submit"
          className="login-page-login-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>

        <button 
          type="button"
          className="login-page-google-sign-in-btn" 
          onClick={handleGoogleSignIn}
          disabled={isPopupActive}
        >
          <GoogleIcon className="google-icon" fontSize="small" />
          Sign in with Google
        </button>

        <button
          type="button"
          className="login-page-apple-sign-in-btn"
          onClick={handleAppleSignIn}
          disabled={isPopupActive}
        >
          <AppleIcon className="apple-icon" fontSize="small" />
          Sign in with Apple
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
