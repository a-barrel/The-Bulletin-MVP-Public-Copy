import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { formatPhoneNumberInput, validatePasswordField, validatePhoneField, validateUsernameField } from '../utils/authForm';
import { validateAuthEmail } from '../components/AuthEmailField';
import { auth } from '../firebase';
import { mapRegistrationError } from '../utils/authErrors';

const initialForm = {
  username: '',
  email: '',
  phone: '',
  password: ''
};

const buildErrorState = () => ({ username: '', email: '', phone: '', password: '' });

export default function useRegistrationForm() {
  const [form, setForm] = useState({ ...initialForm });
  const [errors, setErrors] = useState(buildErrorState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const { t } = useTranslation();

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'phone' ? formatPhoneNumberInput(value) : value
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  }, []);

  const validate = useCallback(() => {
    const nextErrors = buildErrorState();
    nextErrors.username = validateUsernameField(form.username, {
      empty: t('auth.errors.usernameRequired')
    });
    nextErrors.email = validateAuthEmail(form.email, {
      requiredMessage: t('auth.errors.emailRequired'),
      invalidMessage: t('auth.errors.emailInvalid')
    });
    nextErrors.phone = validatePhoneField(form.phone, {
      empty: t('auth.errors.phoneRequired'),
      invalid: t('auth.errors.phoneInvalid')
    });
    nextErrors.password = validatePasswordField(form.password, {
      empty: t('auth.errors.passwordRequired'),
      min: t('auth.errors.passwordMin')
    });
    setErrors(nextErrors);
    return Object.values(nextErrors).every((value) => value === '');
  }, [form.email, form.password, form.phone, form.username, t]);

  const handleSubmit = useCallback(
    async ({ onSuccess, onError }) => {
      setMessage(null);
      if (!validate()) {
        onError?.(t('auth.errors.registrationValidation'));
        return false;
      }
      try {
        setIsSubmitting(true);
        await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        setMessage(t('auth.register.success'));
        onSuccess?.();
        return true;
      } catch (error) {
        console.error('Registration failed:', error);
        const messageText = mapRegistrationError(error?.code, t);
        setMessage(messageText);
        onError?.(messageText);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [form.email, form.password, t, validate]
  );

  return {
    form,
    errors,
    isSubmitting,
    message,
    setMessage,
    handleChange,
    handleSubmit
  };
}
