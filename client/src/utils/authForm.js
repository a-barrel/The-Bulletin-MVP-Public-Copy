export const formatPhoneNumberInput = (value) => {
  const digits = `${value ?? ''}`.replace(/\D/g, '');
  const len = digits.length;

  if (len < 4) {
    return digits;
  }

  if (len < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export const validateUsernameField = (value) => {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    return 'Error: Empty username';
  }
  return '';
};

export const validatePhoneField = (value) => {
  const trimmed = `${value ?? ''}`.trim();

  if (!trimmed) {
    return 'Error: Empty Phone Number';
  }

  const normalized = trimmed.replace(/[^\d+]/g, '');
  if (!/^\+?\d{10,15}$/.test(normalized)) {
    return 'Error: Invalid Phone Number';
  }

  return '';
};

export const validatePasswordField = (value) => {
  const raw = `${value ?? ''}`;

  if (!raw.trim()) {
    return 'Error: Empty Password';
  }

  if (raw.length < 6) {
    return 'Error: Min 6 characters';
  }

  return '';
};
