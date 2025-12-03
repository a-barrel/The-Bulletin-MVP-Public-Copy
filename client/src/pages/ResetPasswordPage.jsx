import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import "./ResetPasswordPage.css";
import { confirmPasswordReset } from "firebase/auth";
import { routes } from "../routes";
import AuthPageLayout from "../components/AuthPageLayout.jsx";
import PasswordField from "../components/PasswordField.jsx";
import useShake from "../hooks/useShake.js";
import useAuthAlerts from "../hooks/useAuthAlerts";
import {
  PASSWORD_REQUIREMENTS,
  getPasswordStrength,
  getPasswordStrengthColor
} from "../utils/passwordStrength";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const { shake, triggerShake } = useShake();
  const [error, setError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oobCodeError, setOobCodeError] = useState(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const validatePassword = (value) => {
    if (!value) return t("auth.errors.passwordRequired");
    return "";
  };

  const oobCode = useMemo(() => {
    if (!location?.search) {
      return null;
    }
    try {
      const params = new URLSearchParams(location.search);
      const code = params.get("oobCode");
      return code && code.trim().length > 0 ? code.trim() : null;
    } catch (err) {
      console.error("Failed to parse oobCode from reset password URL", err);
      return null;
    }
  }, [location?.search]);

  useMemo(() => {
    if (!oobCode) {
      setOobCodeError(t("auth.errors.resetLinkInvalid"));
    } else {
      setOobCodeError(null);
    }
    return null;
  }, [oobCode, t]);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setOobCodeError(null);

    const passwordErr = validatePassword(newPassword);
    setPasswordError(passwordErr);

    if (!oobCode) {
      setOobCodeError(t("auth.errors.resetLinkInvalid"));
      triggerShake();
      return;
    }

    if (!newPassword || !confirmNewPassword) {
      setPasswordError(t("auth.errors.passwordConfirmRequired"));
      triggerShake();
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError(t("auth.errors.passwordMismatch"));
      triggerShake();
      return;
    }

    if (strength.label !== "Strong") {
      setPasswordError(t("auth.errors.passwordWeak"));
      triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage(t("auth.reset.success"));
      setTimeout(() => navigate(routes.auth.login), 2000);
    } catch (err) {
      switch (err.code) {
        case "auth/expired-action-code":
          setError(t("auth.errors.resetExpired"));
          break;
        case "auth/invalid-action-code":
          setError(t("auth.errors.resetInvalid"));
          break;
        case "auth/weak-password":
          setError(t("auth.errors.resetWeakPassword"));
          break;
        default:
          setError(t("auth.errors.resetGeneric"));
          break;
      }
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillPercent = (strength.score / 6) * 100;
  const fillColor = getPasswordStrengthColor(strength.score);

  const alerts = [
    ...useAuthAlerts({
      error,
      message,
      onErrorClear: () => setError(null),
      onMessageClear: () => setMessage(null),
      errorOverlayClassName: 'message-overlay',
      errorBoxClassName: 'message-box',
      messageOverlayClassName: 'message-overlay',
      messageBoxClassName: 'message-box'
    })
  ];
  if (oobCodeError) {
    alerts.unshift({
      id: 'oob-code',
      type: 'error',
      content: oobCodeError,
      overlayClassName: 'message-overlay',
      boxClassName: 'message-box',
      onClose: () => setOobCodeError(null)
    });
  }

  return (
    <AuthPageLayout
      shake={shake}
      title={t("auth.reset.title")}
      backButtonAriaLabel={t("auth.back")}
      alerts={alerts}
    >
      <form onSubmit={handlePasswordReset} className={"page-form"}>
        <div className="password-input-spacer"/>

        <PasswordField
          label={t("auth.reset.newPassword")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t("auth.placeholders.newPassword")}
          error={passwordError}
          showPassword={showNewPassword}
          onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
          autoComplete="new-password"
          showPasswordLabel={t("auth.aria.showPassword")}
          hidePasswordLabel={t("auth.aria.hidePassword")}
        />

        <PasswordField
          label={t("auth.reset.confirmPassword")}
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder={t("auth.placeholders.confirmPassword")}
          error={passwordError}
          showPassword={showConfirmNewPassword}
          onToggleVisibility={() => setShowConfirmNewPassword((prev) => !prev)}
          autoComplete="new-password"
          showPasswordLabel={t("auth.aria.showPassword")}
          hidePasswordLabel={t("auth.aria.hidePassword")}
        />
        <p className="password-requirements-label">
        Make sure your password meets the following requirements:
        </p>

        <ul className="password-requirements">
          {PASSWORD_REQUIREMENTS.map((req) => (
            <li
              key={req.key}
              className={req.test(newPassword) ? "met" : "unmet"}
            >
              {t(`auth.reset.requirements.${req.key}`, {
                defaultValue: req.label,
              })}
            </li>
          ))}
        </ul>

        <div className="password-strength-container">
          <p className="password-strength-text">
            {t("auth.reset.strengthLabel", {
              strength: t(`auth.reset.strength.${strength.label.toLowerCase()}`)
            })}
          </p>
          <div className="password-strength-bar">
            <div
              className="password-strength-fill"
              style={{
                width: `${strength.percent * 100}%`,
                backgroundColor: getPasswordStrengthColor(strength.percent),
              }}
            />
          </div>
        </div>

        <button type="submit" className="reset-password-page-submit-btn" disabled={isSubmitting}>
          {isSubmitting ? t("auth.reset.submitting") : t("auth.reset.button")}
        </button>
      </form>
    </AuthPageLayout>
  );
}

export default ResetPasswordPage;
