const translate = (t, key, fallback) => {
  if (typeof t === 'function') {
    return t(key, { defaultValue: fallback });
  }
  return fallback;
};

export const mapRegistrationError = (code, t) => {
  switch (code) {
    case 'auth/email-already-in-use':
      return translate(t, 'auth.errors.registrationEmailInUse', 'An account already exists with this email.');
    case 'auth/invalid-email':
      return translate(t, 'auth.errors.emailInvalid', 'Please enter a valid email address.');
    case 'auth/operation-not-allowed':
      return translate(t, 'auth.errors.registrationNotAllowed', 'Email/password sign-up is currently disabled.');
    case 'auth/weak-password':
      return translate(
        t,
        'auth.errors.registrationWeakPassword',
        'Password is too weak. Try adding more characters or symbols.'
      );
    default:
      return translate(t, 'auth.errors.registrationDefault', 'Failed to create your account. Please try again.');
  }
};

export const mapPasswordResetError = (code, t) => {
  switch (code) {
    case 'auth/invalid-email':
      return translate(t, 'auth.errors.emailInvalid', 'Please enter a valid email address.');
    case 'auth/user-not-found':
      return translate(t, 'auth.errors.passwordResetNotFound', 'No account found with that email.');
    case 'auth/missing-email':
      return translate(t, 'auth.errors.emailRequired', 'Please enter an email address.');
    case 'auth/network-request-failed':
      return translate(
        t,
        'auth.errors.networkError',
        'Network error. Check your connection and try again.'
      );
    default:
      return translate(t, 'auth.errors.resetGeneric', 'Something went wrong. Please try again.');
  }
};
