import React, { useMemo, useState } from "react";
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
    if (!value) return "Please enter your password.";
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
      setOobCodeError("This reset link is invalid or has already been used.");
    } else {
      setOobCodeError(null);
    }
    return null;
  }, [oobCode]);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setOobCodeError(null);

    const passwordErr = validatePassword(newPassword);
    setPasswordError(passwordErr);

    if (!oobCode) {
      setOobCodeError("This reset link is invalid or has already been used.");
      triggerShake();
      return;
    }

    if (!newPassword || !confirmNewPassword) {
      setPasswordError("Please enter a password and confirm it in the fields.");
      triggerShake();
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords are not matching. Please re-enter them again.");
      triggerShake();
      return;
    }

    if (strength.label !== "Strong") {
      setPasswordError("Password is too weak. Make it stronger.");
      triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage("Your password has been reset successfully! \nRedirecting to login...");
      setTimeout(() => navigate(routes.auth.login), 2000);
    } catch (err) {
      switch (err.code) {
        case "auth/expired-action-code":
          setError("This link has expired. Please request a new password reset.");
          break;
        case "auth/invalid-action-code":
          setError("Invalid action code. Please request a new password reset.");
          break;
        case "auth/weak-password":
          setError("Password is too weak. Please choose a stronger password.");
          break;
        default:
          setError("Something went wrong. Please try again.");
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
      title="Reset Your Password"
      alerts={alerts}
    >
      <form onSubmit={handlePasswordReset} className={"page-form"}>
        <div className="password-strength">
          <div className="strength-bar">
            <div
              className="strength-fill"
              style={{ width: `${fillPercent}%`, backgroundColor: fillColor }}
            />
          </div>
          <p className="strength-label">Password strength: {strength.label || "Weak"}</p>
        </div>

        <PasswordField
          label="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password"
          error={passwordError}
          showPassword={showNewPassword}
          onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
          autoComplete="new-password"
        />

        <PasswordField
          label="Confirm New Password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="Confirm new password"
          error={passwordError}
          showPassword={showConfirmNewPassword}
          onToggleVisibility={() => setShowConfirmNewPassword((prev) => !prev)}
          autoComplete="new-password"
        />

        <ul className="password-requirements">
          {PASSWORD_REQUIREMENTS.map((req) => (
            <li key={req.label} className={req.test(newPassword) ? "met" : "unmet"}>
              {req.label}
            </li>
          ))}
        </ul>

        <button type="submit" className="reset-password-btn" disabled={isSubmitting}>
          {isSubmitting ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </AuthPageLayout>
  );
}

export default ResetPasswordPage;
