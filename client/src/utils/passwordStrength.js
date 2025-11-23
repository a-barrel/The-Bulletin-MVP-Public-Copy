export const PASSWORD_REQUIREMENTS = [
  { key: 'uppercase', label: 'Has an uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lowercase', label: 'Has a lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'number', label: 'Has a number', test: (pw) => /\d/.test(pw) },
  { key: 'special', label: 'Has a special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
  { key: 'length', label: 'Is at least 8 characters long', test: (pw) => pw.length >= 8 }
];

export const PASSWORD_STRENGTH_STEPS = PASSWORD_REQUIREMENTS.length + 1;

export const getPasswordStrength = (password) => {
  if (!password) {
    return { score: 0, label: 'Weak' };
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  let label = 'Weak';
  if (score <= 2) {
    label = 'Weak';
  } else if (score <= 4) {
    label = 'Medium';
  } else {
    label = 'Strong';
  }
  return { score, label };
};

export const getPasswordStrengthColor = (score) => {
  if (!score) {
    return 'grey';
  }
  if (score <= 2) {
    return 'red';
  }
  if (score <= 4) {
    return 'orange';
  }
  return 'green';
};
