export function toIdString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'object') {
    if (typeof value.$oid === 'string') {
      const trimmed = value.$oid.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value._id === 'string') {
      const trimmed = value._id.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value.id === 'string') {
      const trimmed = value.id.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value.toString === 'function') {
      const stringValue = value.toString();
      if (stringValue && stringValue !== '[object Object]') {
        return stringValue;
      }
    }
  }

  return null;
}

export default toIdString;
