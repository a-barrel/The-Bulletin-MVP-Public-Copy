export function formatDateTime(value, { fallback = null, options } = {}) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const resolvedOptions = options || {
    dateStyle: 'medium',
    timeStyle: 'short'
  };

  return date.toLocaleString(undefined, resolvedOptions);
}

export function formatFriendlyTimestamp(value, { fallback = '' } = {}) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timePart = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });

  if (sameDay) {
    return timePart;
  }

  if (isYesterday) {
    return `Yesterday at ${timePart}`;
  }

  const datePart = date.toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });

  return `${datePart} at ${timePart}`;
}

export function formatRelativeTime(value, { now = Date.now(), fallback = '' } = {}) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const diffMs = date.getTime() - now;
  const absDiff = Math.abs(diffMs);

  const units = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
    ['second', 1000]
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, ms] of units) {
    if (absDiff >= ms || unit === 'second') {
      const valueRounded = Math.round(diffMs / ms);
      return formatter.format(valueRounded, unit);
    }
  }

  return fallback;
}

export function formatAbsoluteDateTime(value, { fallback = '' } = {}) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export default formatDateTime;
