import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
// import { auth } from "../firebase";
// import { createUserWithEmailAndPassword } from "firebase/auth";
import "./Registration.css";

function RegistrationPage() {
  const navigate = useNavigate();

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
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" })); // clear field error on type
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // If using Firebase later, uncomment:
    // try {
    //   await createUserWithEmailAndPassword(auth, form.email, form.password);
    //   // optionally save username/phone to your DB here
    //   navigate("/login");
    // } catch (err) {
    //   // map Firebase errors if desired
    //   alert(err.message);
    // }

    // For now just go back to login to match your ask:
    navigate("/login");
  };

  return (
    <div className="register-page">
      <div className="register-frame">
        {/* back chevron */}
        <button
          className="back-btn"
          aria-label="Go back"
          onClick={() => navigate("/login")}
        >
          &#8592;
        </button>

        <h1 className="register-title">Registration</h1>

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="field">
            <input
              name="username"
              type="text"
              value={form.username}
              onChange={onChange}
              placeholder="[Empty Username, Click to Fill]"
              className={`input ${errors.username ? "input-error" : ""}`}
            />
            {errors.username && <p className="helper-error">{errors.username}</p>}
          </div>

          {/* Email */}
          <div className="field">
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="[Empty Email, Click to Fill]"
              className={`input ${errors.email ? "input-error" : ""}`}
            />
            {errors.email && <p className="helper-error">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="field">
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={onChange}
              placeholder="[Empty Phone #, Click to Fill]"
              className={`input ${errors.phone ? "input-error" : ""}`}
            />
            {errors.phone && <p className="helper-error">{errors.phone}</p>}
          </div>

          {/* Password */}
          <div className="field">
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              placeholder="[Empty Password, Click to Fill]"
              className={`input ${errors.password ? "input-error" : ""}`}
            />
            {errors.password && <p className="helper-error">{errors.password}</p>}
          </div>

          {/* Submit */}
          <button type="submit" className="register-submit">
            Register
          </button>
        </form>
      </div>
    </div>
  );
}

export default RegistrationPage;