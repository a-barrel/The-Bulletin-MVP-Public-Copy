import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import './ForgotPasswordPage.css';
import { sendPasswordResetEmail } from 'firebase/auth';
import AuthPageLayout from '../components/AuthPageLayout.jsx';
import AuthEmailField, { validateAuthEmail } from '../components/AuthEmailField.jsx';
import useShake from '../hooks/useShake.js';
import useAuthAlerts from '../hooks/useAuthAlerts';
import { mapPasswordResetError } from '../utils/authErrors';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState("");
  const { shake, triggerShake } = useShake();
  
  const handleEmailSubmission = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const emailErr = validateAuthEmail(email, {
      requiredMessage: t('auth.errors.emailRequired'),
      invalidMessage: t('auth.errors.emailInvalid')
    });
    setEmailError(emailErr);

    if (emailErr) {
      triggerShake();
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage(t('auth.forgot.success'));
    } catch (err) {
      setError(mapPasswordResetError(err?.code, t));
      triggerShake();
    }
  };

  const alerts = useAuthAlerts({
    error,
    message,
    onErrorClear: () => setError(null),
    onMessageClear: () => setMessage(null),
    errorOverlayClassName: 'message-overlay',
    errorBoxClassName: 'message-box'
  });

  return (
    <AuthPageLayout
      shake={shake}
      onBack={() => navigate(-1)}
      title={t('auth.forgot.title')}
      backButtonAriaLabel={t('auth.back')}
      alerts={alerts}
    >
      <p className="instruction-text">
        {t('auth.forgot.instruction')}
      </p>

      <form onSubmit={handleEmailSubmission} className={"page-form"}>
        <AuthEmailField
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
          onErrorChange={setEmailError}
          placeholder={t('auth.placeholders.email')}
          requiredMessage={t('auth.errors.emailRequired')}
          invalidMessage={t('auth.errors.emailInvalid')}
        />
        
        <button 
          type="submit" 
          className="forgot-password-page-submit-email-btn"
        >
          {t('auth.submit')}
        </button>
      </form>
    </AuthPageLayout>
  );
}

export default ForgotPasswordPage;
