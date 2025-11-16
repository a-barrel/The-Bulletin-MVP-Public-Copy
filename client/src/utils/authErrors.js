export const mapRegistrationError = (code) => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists with this email.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-up is currently disabled.';
    case 'auth/weak-password':
      return 'Password is too weak. Try adding more characters or symbols.';
    default:
      return 'Failed to create your account. Please try again.';
  }
};

export const mapPasswordResetError = (code) => {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/missing-email':
      return 'Please enter an email address.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
};
