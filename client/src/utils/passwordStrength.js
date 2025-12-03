export const PASSWORD_REQUIREMENTS = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (pw) => pw.length >= 8,
    weight: 1,
  },
  {
    key: "uppercase",
    label: "One uppercase letter (A–Z)",
    test: (pw) => /[A-Z]/.test(pw),
    weight: 1,
  },
  {
    key: "lowercase",
    label: "One lowercase letter (a–z)",
    test: (pw) => /[a-z]/.test(pw),
    weight: 1,
  },
  {
    key: "number",
    label: "One number (0–9)",
    test: (pw) => /\d/.test(pw),
    weight: 1,
  },
  {
    key: "special",
    label: "One special character",
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
    weight: 1,
  }
];

export const MAX_PASSWORD_SCORE = PASSWORD_REQUIREMENTS.reduce(
  (sum, req) => sum + req.weight,
  0
);

export const PASSWORD_STRENGTH_STEPS = PASSWORD_REQUIREMENTS.length + 1;

export const getPasswordStrength = (password) => {
  if (!password) {
    return { score: 0, label: "Weak" };
  }

  let score = 0;
  for (const req of PASSWORD_REQUIREMENTS) {
    if (req.test(password)) score += req.weight;
  }

  let label = "Weak";

  const percent = score / MAX_PASSWORD_SCORE;

  if (percent >= 0.8) label = "Strong";
  else if (percent >= 0.4) label = "Medium";

  return { score, label, percent };
};

export const getPasswordStrengthColor = (percent) => {
  if (percent >= 0.8) return "green"; 
  if (percent >= 0.4) return "orange";  
  return "red";  
};
