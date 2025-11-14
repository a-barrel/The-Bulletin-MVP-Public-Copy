export const REPORT_OFFENSE_OPTIONS = [
  { value: 'harassment', label: 'Harassment / bullying' },
  { value: 'spam', label: 'Spam or self-promotion' },
  { value: 'hate', label: 'Hate speech / discrimination' },
  { value: 'nsfw', label: 'NSFW / sexual content' },
  { value: 'violence', label: 'Threats or violence' },
  { value: 'misinfo', label: 'Misinformation / scam' }
];

export const REPORT_OFFENSE_LABELS = REPORT_OFFENSE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

export function normalizeReportOffenses(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const allowed = new Set(REPORT_OFFENSE_OPTIONS.map((option) => option.value));
  const unique = [];
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed && allowed.has(trimmed) && !unique.includes(trimmed)) {
      unique.push(trimmed);
    }
    if (unique.length >= 10) {
      break;
    }
  }
  return unique;
}
