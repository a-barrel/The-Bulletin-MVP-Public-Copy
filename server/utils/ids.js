const mongoose = require('mongoose');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toIdString(value, options = {}) {
  const { fallback } = options;

  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    const normalized = normalizeString(value);
    return normalized !== undefined ? normalized : fallback;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString();
  }

  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      const hex = value.toHexString();
      if (hex) {
        return hex;
      }
    }

    if (value._id !== undefined) {
      const nested = toIdString(value._id, options);
      if (nested !== undefined) {
        return nested;
      }
    }

    if (value.id !== undefined) {
      const nested = toIdString(value.id, options);
      if (nested !== undefined) {
        return nested;
      }
    }

    if (typeof value.$oid === 'string') {
      const normalized = normalizeString(value.$oid);
      if (normalized) {
        return normalized;
      }
    }

    if (typeof value.toString === 'function') {
      const stringValue = value.toString();
      if (stringValue && stringValue !== '[object Object]') {
        return stringValue;
      }
    }
  }

  return fallback;
}

function mapIdList(values, options = {}) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => toIdString(value, options))
    .filter((id) => id !== undefined && id !== null);
}

module.exports = {
  toIdString,
  mapIdList
};
