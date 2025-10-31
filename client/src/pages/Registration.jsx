import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { routes } from "../routes";
import "./Registration.css";

function RegistrationPage() {
  const navigate = useNavigate();
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState(null);

  // Formats the phone number input 
  const formatPhoneNumber = (value) => {
  const digits = value.replace(/\D/g, "");
  const len = digits.length;

  if (len < 4) return digits;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

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
      setForm((f) => ({ ...f, phone: formatPhoneNumber(value) }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  // simple validators to mirror your red helper text behavior
  const validate = () => {
    const er = { username: "", email: "", phone: "", password: "" };
    if (!form.username.trim()) er.username = "Error: Empty username";
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    if (!form.email.trim()) er.email = "Error: Empty Email";
    else if (!emailOk) er.email = "Error: Invalid Email";

    const phoneOk = /^\+?\d{10,15}$/.test(form.phone.replace(/[^\d+]/g, ""));
    if (!form.phone.trim()) er.phone = "Error: Empty Phone Number";
    else if (!phoneOk) er.phone = "Error: Invalid Phone Number";

    if (!form.password.trim()) er.password = "Error: Empty Password";
    else if (form.password.length < 6) er.password = "Error: Min 6 characters";

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
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      setMessage("Your account has been created successfully! \nRedirecting to login...");
      setTimeout(() => navigate(routes.auth.login), 2000);
    } catch (err) {
      console.error("Registration failed:", err);
      setMessage(mapFirebaseError(err?.code));
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
  };

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
        {/* back chevron */}
        <button
          className="page-back-btn"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          &#8592;
        </button>

        <h1 className="page-sub-title">Registration</h1>
      </div>  

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="register-input-container">
            <input
              name="username"
              type="text"
              value={form.username}
              onChange={onChange}
              placeholder="Choose a Username"
              className={`input ${errors.username ? "input-error" : ""}`}
            />
            {errors.username && <p className="register-input-error-text">{errors.username}</p>}
          </div>

          {/* Email */}
          <div className="register-input-container">
            <input
              name="email"
              type="text"
              value={form.email}
              onChange={onChange}
              placeholder="Enter your Email"
              className={`input ${errors.email ? "input-error" : ""}`}
            />
            {errors.email && <p className="register-input-error-text">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="register-input-container">
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={onChange}
              placeholder="Enter your Phone Number"
              className={`input ${errors.phone ? "input-error" : ""}`}
            />
            {errors.phone && <p className="register-input-error-text">{errors.phone}</p>}
          </div>

          {/* Password */}
          <div className="register-input-container">
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              placeholder="Choose a Password"
              className={`input ${errors.password ? "input-error" : ""}`}
            />
            {errors.password && <p className="register-input-error-text">{errors.password}</p>}
          </div>

          {/* Submit */}
          <button type="submit" className="register-submit">
            Register
          </button>
        </form>
    </div>
  );
}

export default RegistrationPage;
