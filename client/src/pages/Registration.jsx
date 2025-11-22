import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routes } from "../routes";
import AuthPageLayout from "../components/AuthPageLayout.jsx";
import AuthEmailField from "../components/AuthEmailField.jsx";
import PasswordField from "../components/PasswordField.jsx";
import useShake from "../hooks/useShake.js";
import useAuthAlerts from "../hooks/useAuthAlerts";
import useRegistrationForm from "../hooks/useRegistrationForm";
import "./Registration.css";

function RegistrationPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { shake, triggerShake } = useShake();
  const {
    form,
    errors,
    isSubmitting,
    message,
    setMessage,
    handleChange,
    handleSubmit
  } = useRegistrationForm();
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      await handleSubmit({
        onSuccess: () => setTimeout(() => navigate(routes.auth.login), 2000),
        onError: () => triggerShake()
      });
    },
    [handleSubmit, navigate, triggerShake]
  );

  const alerts = useAuthAlerts({
    message,
    onMessageClear: () => setMessage(null)
  });

  return (
    <AuthPageLayout
      shake={shake}
      title={t("auth.register.title")}
      onBack={() => navigate(-1)}
      backButtonAriaLabel={t("auth.back")}
      alerts={alerts}
    >
      <form className="register-form" onSubmit={onSubmit} noValidate>
          {/* Username */}
          <div className="auth-input-container">
            <input
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              placeholder={t("auth.register.username")}
              className={errors.username ? "input-error" : ""}
            />
            {errors.username && <p className="auth-input-error-text">{errors.username}</p>}
          </div>

          {/* Email */}
          <AuthEmailField
            value={form.email}
            onChange={handleChange}
            error={errors.email}
            placeholder={t("auth.placeholders.email")}
            requiredMessage={t("auth.errors.emailRequired")}
            invalidMessage={t("auth.errors.emailInvalid")}
            className="auth-input-container"
          />

          {/* Phone */}
          <div className="auth-input-container">
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder={t("auth.register.phone")}
              className={errors.phone ? "input-error" : ""}
            />
            {errors.phone && <p className="auth-input-error-text">{errors.phone}</p>}
          </div>

          {/* Password */}
          <PasswordField
            name="password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            placeholder={t("auth.register.password")}
            className="auth-input-container"
            showPassword={showPassword}
            onToggleVisibility={() => setShowPassword((prev) => !prev)}
            autoComplete="new-password"
            showPasswordLabel={t("auth.aria.showPassword")}
            hidePasswordLabel={t("auth.aria.hidePassword")}
          />

          {/* Submit */}
          <button type="submit" className="register-submit" disabled={isSubmitting}>
            {isSubmitting ? t("auth.register.submitting") : t("auth.register.button")}
          </button>
      </form>
    </AuthPageLayout>
  );
}

export default RegistrationPage;
