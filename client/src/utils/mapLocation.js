export const hasValidCoordinates = (coords) =>
  coords &&
  typeof coords === 'object' &&
  Number.isFinite(coords.latitude) &&
  Number.isFinite(coords.longitude);

export const normalizeId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'object') {
    if (typeof value._id === 'string') {
      const trimmed = value._id.trim();
      return trimmed.length ? trimmed : null;
    }
    if (typeof value.id === 'string') {
      const trimmed = value.id.trim();
      return trimmed.length ? trimmed : null;
    }
    if (typeof value.$oid === 'string') {
      const trimmed = value.$oid.trim();
      return trimmed.length ? trimmed : null;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};
