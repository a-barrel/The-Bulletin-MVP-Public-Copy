import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { routes } from "../routes";
import AuthPageLayout from "../components/AuthPageLayout.jsx";
import AuthEmailField, { validateAuthEmail } from "../components/AuthEmailField.jsx";
import PasswordField from "../components/PasswordField.jsx";
import {
  formatPhoneNumberInput,
  validateUsernameField,
  validatePhoneField,
  validatePasswordField
} from "../utils/authForm.js";
import useShake from "../hooks/useShake.js";
import "./Registration.css";

function RegistrationPage() {
  const navigate = useNavigate();
  const { shake, triggerShake } = useShake();
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null);

  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
  });

  const [errors, setErrors] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setForm((f) => ({ ...f, phone: formatPhoneNumberInput(value) }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  // simple validators to mirror your red helper text behavior
  const validate = () => {
    const er = { username: "", email: "", phone: "", password: "" };
    er.username = validateUsernameField(form.username);
    er.email = validateAuthEmail(form.email);
    er.phone = validatePhoneField(form.phone);
    er.password = validatePasswordField(form.password);

    setErrors(er);
    return Object.values(er).every((v) => v === "");
  };

  const mapFirebaseError = (code) => {
    switch (code) {
      case "auth/email-already-in-use":
        return "An account already exists with this email.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/operation-not-allowed":
        return "Email/password sign-up is currently disabled.";
      case "auth/weak-password":
        return "Password is too weak. Try adding more characters or symbols.";
      default:
        return "Failed to create your account. Please try again.";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!validate()) {
      triggerShake();
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      setMessage("Your account has been created successfully! \nRedirecting to login...");
      setTimeout(() => navigate(routes.auth.login), 2000);
    } catch (err) {
      console.error("Registration failed:", err);
      setMessage(mapFirebaseError(err?.code));
      triggerShake();
    }
  };

  const alerts = [];
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
      title="Registration"
      onBack={() => navigate(-1)}
      alerts={alerts}
    >
      <form className="register-form" onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="auth-input-container">
            <input
              name="username"
              type="text"
              value={form.username}
              onChange={onChange}
              placeholder="Choose a Username"
              className={errors.username ? "input-error" : ""}
            />
            {errors.username && <p className="auth-input-error-text">{errors.username}</p>}
          </div>

          {/* Email */}
          <AuthEmailField
            value={form.email}
            onChange={onChange}
            error={errors.email}
            onErrorChange={(value) => setErrors((prev) => ({ ...prev, email: value }))}
            placeholder="Enter your Email"
            className="auth-input-container"
          />

          {/* Phone */}
          <div className="auth-input-container">
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={onChange}
              placeholder="Enter your Phone Number"
              className={errors.phone ? "input-error" : ""}
            />
            {errors.phone && <p className="auth-input-error-text">{errors.phone}</p>}
          </div>

          {/* Password */}
          <PasswordField
            name="password"
            value={form.password}
            onChange={onChange}
            error={errors.password}
            placeholder="Choose a Password"
            className="auth-input-container"
            showPassword={showPassword}
            onToggleVisibility={() => setShowPassword((prev) => !prev)}
            autoComplete="new-password"
          />

          {/* Submit */}
          <button type="submit" className="register-submit">
            Register
          </button>
      </form>
    </AuthPageLayout>
  );
}

export default RegistrationPage;
