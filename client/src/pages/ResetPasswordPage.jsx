import React, { useState, useEffect, use } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import "./ResetPasswordPage.css";
import { confirmPasswordReset } from "firebase/auth";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { routes } from "../routes";

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
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [strength, setStrength] = useState({ label: "", score: 0});
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [message, setMessage] = useState(null);
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
  
  const handlePasswordReset = async (e) => {
  e.preventDefault();
  setError(null);

  const passwordErr = validatePassword(newPassword);

  setPasswordError(passwordErr);

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
    // Simulates the password reset
    //await confirmPasswordReset(auth, oobCode, newPassword);
    setMessage("Your password has been reset successfully! \nRedirecting to login...");
    const timer = setTimeout(() => navigate(routes.auth.login), 2000);
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
  };

  const fillPercent = (strength.score / 6) * 100;
  const fillColor = getPasswordStrengthColor(strength.score);

  return (
    <div className={`page-background ${shake ? "shake" : ""}`}>
      {message && (
        <div className="message-overlay" onClick={() => setMessage(null)}>
          <div className="message-box">
            <p>{message}</p>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-sub-title">Reset Your Password</h1>
      </div>
      
      <form onSubmit={handlePasswordReset} className={"page-form"}>
        <div className="input-container">
          <input
            type={showNewPassword ? "text" : "password"}
            placeholder="Enter New Password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              setError("")
            }}
            className={passwordError ? "input-error" : ""}
          />  

          <button
            type="button"
            className="show-password-btn"
            onClick={() => setShowNewPassword(!showNewPassword)}
          >
          {showNewPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        <div className="input-container">
          <input
            type={showConfirmNewPassword ? "text" : "password"}
            placeholder="Confirm New Password"
            value={confirmNewPassword}
            onChange={(e) => {
              setConfirmNewPassword(e.target.value)
              setError("")
            }}
            className={passwordError ? "input-error" : ""}
          />  
          {passwordError && <span className="input-error-text">{passwordError}</span>}
        
          <button
            type="button"
            className="show-password-btn"
            onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
          >
          {showConfirmNewPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

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
        
        <button type="submit" className="reset-password-page-submit-btn">Submit</button>
      </form>
    </div>
  );
}

export default ResetPasswordPage;
