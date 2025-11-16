export const formatDateTimeLocalInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (input) => String(input).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const formatDateForMessage = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'the specified date';
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const sanitizeNumberField = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = `${value}`.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`"${value}" is not a valid number.`);
  }
  return parsed;
};

export const sanitizeDateField = (value, label, options = {}) => {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }

  const {
    allowPast = false,
    min,
    max,
    minMessage,
    maxMessage,
    toleranceMs = 60 * 1000
  } = options;

  if (!allowPast) {
    const now = Date.now();
    if (date.getTime() < now - toleranceMs) {
      throw new Error(`${label} cannot be in the past.`);
    }
  }

  if (min) {
    const minDate = min instanceof Date ? min : new Date(min);
    if (Number.isNaN(minDate.getTime())) {
      throw new Error(`${label} has an invalid minimum date.`);
    }
    if (date.getTime() < minDate.getTime()) {
      throw new Error(minMessage ?? `${label} must be on or after ${formatDateForMessage(minDate)}.`);
    }
  }

  if (max) {
    const maxDate = max instanceof Date ? max : new Date(max);
    if (Number.isNaN(maxDate.getTime())) {
      throw new Error(`${label} has an invalid maximum date.`);
    }
    if (date.getTime() > maxDate.getTime()) {
      throw new Error(maxMessage ?? `${label} must be on or before ${formatDateForMessage(maxDate)}.`);
    }
  }

  return date;
};

export const extractReverseGeocodeFields = (payload) => {
  if (!payload) {
    return null;
  }

  const address = payload.address ?? {};
  const formatted = payload.display_name ?? null;
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    address.county ||
    null;
  const state = address.state || address.region || address.state_district || null;
  const postalCode = address.postcode || null;
  const country = address.country || null;

  if (!formatted && !city && !state && !country && !postalCode) {
    return null;
  }

  return {
    formatted,
    city,
    state,
    postalCode,
    country
  };
};
