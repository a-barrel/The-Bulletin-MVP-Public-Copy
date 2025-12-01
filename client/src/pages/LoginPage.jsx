import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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
import clearClientCaches from "../utils/clearClientCaches";
import GoogleIcon from "@mui/icons-material/Google";
import AppleIcon from "@mui/icons-material/Apple";

function LoginPage() {
  const { t } = useTranslation();
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
    if (!value) return t("auth.errors.passwordRequired");
    return "";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateAuthEmail(email, {
      requiredMessage: t("auth.errors.emailRequired"),
      invalidMessage: t("auth.errors.emailInvalid")
    });
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
      await clearClientCaches();
      navigate(routes.map.base);
    } catch (error) {
      switch (error.code) {
        case "auth/invalid-email":
          setError(t("auth.errors.emailInvalid"));
          break;
        case "auth/missing-password":
          setError(t("auth.errors.passwordRequired"));
          break;
        case "auth/user-not-found":
          setError(t("auth.errors.loginNotFound"));
          break;
        case "auth/wrong-password":
          setError(t("auth.errors.loginWrongPassword"));
          break;
        default:
          setError(t("auth.errors.loginGeneric"));
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
      await clearClientCaches();
      navigate(routes.map.base);
    } catch (popupError) {
      if (popupError?.message) {
        setError(popupError.message);
      } else {
        setError(t("auth.errors.googleGeneric"));
      }
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    try {
      await signInWithProvider(() => new OAuthProvider("apple.com"));
      await clearClientCaches();
      navigate(routes.map.base);
    } catch (signupError) {
      if (signupError?.code === "auth/operation-not-supported-in-this-environment") {
        setError(t("auth.errors.appleUnavailable"));
      } else if (signupError?.code === "auth/account-exists-with-different-credential") {
        setError(t("auth.errors.appleLinked"));
      } else if (signupError?.message) {
        setError(signupError.message);
      } else {
        setError(t("auth.errors.appleGeneric"));
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
        <img src={bulletinLogo} alt={`${t("app.name")} logo`} />
      </div>

      <form onSubmit={handleLogin} className={"page-form"}>
        <AuthEmailField
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
          onErrorChange={setEmailError}
          placeholder={t("auth.placeholders.email")}
          requiredMessage={t("auth.errors.emailRequired")}
          invalidMessage={t("auth.errors.emailInvalid")}
          className="auth-input-container input-container"
          errorTextClassName="auth-input-error-text input-error-text"
        />

        <PasswordField
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setPasswordError("");
          }}
            placeholder={t("auth.placeholders.password")}
          error={passwordError}
          showPassword={showPassword}
          onToggleVisibility={() => setShowPassword((prev) => !prev)}
          autoComplete="current-password"
          showPasswordLabel={t("auth.aria.showPassword")}
          hidePasswordLabel={t("auth.aria.hidePassword")}
        />

        <div className="additional-options">
          <label className="remember-me-checkbox"> {/*Controls session persistence*/}
            <input
              type="checkbox"
              checked={remember}
            onChange={() => setRemember((prev) => !prev)}
          />
          {t("auth.rememberMe")}
        </label>
          
          <div className="forgot-password-link">
            <span
              className="forgot-password-clickable"
              onClick={() => navigate(routes.auth.forgotPassword)}
            > 
              {t("auth.forgotPassword")}
            </span>
          </div>
        </div>
          
        <button
          type="submit"
          className="login-page-login-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? t("auth.login.submitting") : t("auth.login.button")}
        </button>

        <button 
          type="button"
          className="login-page-google-sign-in-btn" 
          onClick={handleGoogleSignIn}
          disabled={isPopupActive}
        >
          <GoogleIcon className="google-icon" fontSize="small" />
          {t("auth.login.google")}
        </button>

        <button
          type="button"
          className="login-page-apple-sign-in-btn"
          onClick={handleAppleSignIn}
          disabled={isPopupActive}
        >
          <AppleIcon className="apple-icon" fontSize="small" />
          {t("auth.login.apple")}
        </button>

        <p className="getting-started-text">{t("auth.login.gettingStarted")}</p>

        <button 
          type="button"
          className="login-page-register-btn" 
          onClick={() => navigate(routes.auth.register)}
        > 
          {t("auth.login.register")}
        </button>    
      </form>
    </AuthPageLayout>
  );
}

export default LoginPage;
