import { useCallback, useState } from 'react';
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
    nextErrors.username = validateUsernameField(form.username);
    nextErrors.email = validateAuthEmail(form.email);
    nextErrors.phone = validatePhoneField(form.phone);
    nextErrors.password = validatePasswordField(form.password);
    setErrors(nextErrors);
    return Object.values(nextErrors).every((value) => value === '');
  }, [form.email, form.password, form.phone, form.username]);

  const handleSubmit = useCallback(
    async ({ onSuccess, onError }) => {
      setMessage(null);
      if (!validate()) {
        onError?.('Please fix the highlighted fields.');
        return false;
      }
      try {
        setIsSubmitting(true);
        await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        setMessage('Your account has been created successfully! Redirecting to login...');
        onSuccess?.();
        return true;
      } catch (error) {
        console.error('Registration failed:', error);
        const messageText = mapRegistrationError(error?.code);
        setMessage(messageText);
        onError?.(messageText);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [form.email, form.password, validate]
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
