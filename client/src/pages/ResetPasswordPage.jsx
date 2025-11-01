import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import "./ResetPasswordPage.css";
import { confirmPasswordReset } from "firebase/auth";
import { routes } from "../routes";
import AuthPageLayout from "../components/AuthPageLayout.jsx";
import PasswordField from "../components/PasswordField.jsx";

function getPasswordStrength(password) {
  let score = 0;

  // Checks password length
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;

  // Checks if password contains lowercase
  if (/[a-z]/.test(password)) score += 1;

  // Checks if password contains uppercase
  if (/[A-Z]/.test(password)) score += 1;

  // Checks if password contains numbers
  if (/\d/.test(password)) score += 1;

  // Checks if password contains special characters
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  let label = "Weak";
  if (score <= 2) label = "Weak";
  else if (score <= 4) label = "Medium";
  else label = "Strong";

  return { label, score };
}

function getPasswordStrengthColor(score) {
    if (score == 0) return "grey";
    if (score <= 2) return "red";
    if (score <= 4) return "orange";
    return "green";
  }

function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [strength, setStrength] = useState({ label: "", score: 0});
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oobCodeError, setOobCodeError] = useState(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const passwordRequirements = [
    { label: "Has an uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
    { label: "Has a lowercase letter", test: (pw) => /[a-z]/.test(pw) },
    { label: "Has a number", test: (pw) => /\d/.test(pw) },
    { label: "Has a special character", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
    { label: "Is at least 8 characters long", test: (pw) => pw.length >= 8 }
  ];

  const validatePassword = (value) => {
    if (!value) return "Please enter your password.";
    return "";
  };

  useEffect(() => {
    const s = getPasswordStrength(newPassword);
    setStrength(s);
  }, [newPassword]);

  // Clear error pop-up after 3 seconds
  useEffect(() => {
  if (error) {
    const timer = setTimeout(() => setError(null), 3000); 
    return () => clearTimeout(timer);
    }
  }, [error]);

  // Clear message pop-up after 3 seconds
  useEffect(() => {
  if (message) {
    const timer = setTimeout(() => setMessage(null), 3000); 
    return () => clearTimeout(timer);
    }
  }, [message]);
  
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

  useEffect(() => {
    if (!oobCode) {
      setOobCodeError("This reset link is invalid or has already been used.");
    } else {
      setOobCodeError(null);
    }
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
    setShake(true);
    setTimeout(() => setShake(false), 300);
    return;
  }

  // Call for simple errors before attempting to authenticate 
  if (!newPassword || !confirmNewPassword) {
    setPasswordError("Please enter a password and confirm it in the fields.");
    setShake(true);
    setTimeout(() => setShake(false), 300);
    return;
  }

  if (newPassword != confirmNewPassword) {
    setPasswordError("Passwords are not matching. Please re-enter them again.");
    setShake(true);
    setTimeout(() => setShake(false), 300);
    return;
  }

  if (strength.label != "Strong") {
    setPasswordError("Password is too weak. Make it stronger.");
    setShake(true);
    setTimeout(() => setShake(false), 300);
    return;
  }

  try {
    setIsSubmitting(true);
    await confirmPasswordReset(auth, oobCode, newPassword);
    setMessage("Your password has been reset successfully! \nRedirecting to login...");
    setTimeout(() => navigate(routes.auth.login), 2000);
  } catch (error) {
    switch (error.code) {
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
    setShake(true);
    setTimeout(() => setShake(false), 300);
    }
  finally {
    setIsSubmitting(false);
  }
  };

  const fillPercent = (strength.score / 6) * 100;
  const fillColor = getPasswordStrengthColor(strength.score);

  const alerts = [];
  if (oobCodeError) {
    alerts.push({
      id: 'oob-code',
      type: 'error',
      content: oobCodeError,
      overlayClassName: 'message-overlay',
      boxClassName: 'message-box',
      onClose: () => setOobCodeError(null)
    });
  }
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
      title="Reset Your Password"
      alerts={alerts}
    >
      <form onSubmit={handlePasswordReset} className={"page-form"}>
        <PasswordField
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setError(null);
            setOobCodeError(null);
          }}
          placeholder="Enter New Password"
          showPassword={showNewPassword}
          onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
          autoComplete="new-password"
        />

        <PasswordField
          value={confirmNewPassword}
          onChange={(e) => {
            setConfirmNewPassword(e.target.value);
            setError(null);
            setOobCodeError(null);
          }}
          placeholder="Confirm New Password"
          error={passwordError}
          showPassword={showConfirmNewPassword}
          onToggleVisibility={() => setShowConfirmNewPassword((prev) => !prev)}
          autoComplete="new-password"
        />

        <div className="password-strength-container">
          <small className="password-strength-label">
            Password strength:{" "}
            <span 
              style={{ 
                className: "password-strength-text",
                color: newPassword ? fillColor : "grey",
              }}
            >
              {strength.label || "N/A"}
            </span>
          </small>

          <div className="password-strength-bar" aria-hidden>
            <div 
            className="password-strength-fill" 
            style={{ 
              width: `${fillPercent}%`, 
              backgroundColor: newPassword ? fillColor : "grey" 
              }}>
            </div>
          </div>
        </div>

        <div className="password-req">
          <p className="password-req-title">Make sure your password meets the following:</p>
          <ul className="password-req-list">
            {passwordRequirements.map((req, index) => {
              const passed = req.test(newPassword);
              return (
                <li 
                  key={index} 
                  className={`password-req-item ${passed ? "passed" : ""}`}
                >
                  <span className="req-icon">{passed ? "✔" : "X"}</span>
                  <span>{req.label}</span>
                </li>
              )
            })}
          </ul>
        </div>
        
        <button type="submit" className="reset-password-page-submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </AuthPageLayout>
  );
}

export default ResetPasswordPage;
