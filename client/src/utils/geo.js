const METERS_PER_MILE = 1609.34;
const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (value) => (value * Math.PI) / 180;

const resolveCoordinates = (value) => {
  if (!value) {
    return null;
  }
  if (Array.isArray(value) && value.length >= 2) {
    const [latitude, longitude] = value;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
    return null;
  }
  if (typeof value === 'object') {
    const { latitude, longitude } = value;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }
  return null;
};

export const metersToLatitudeDegrees = (meters) =>
  (meters / EARTH_RADIUS_METERS) * (180 / Math.PI);

export const metersToLongitudeDegrees = (meters, latitude) => {
  const latitudeRadians = toRadians(latitude);
  const denominator = Math.cos(latitudeRadians);
  if (Math.abs(denominator) < 1e-6) {
    return 0;
  }
  return (meters / (EARTH_RADIUS_METERS * denominator)) * (180 / Math.PI);
};

export const clampLatitude = (value) => Math.max(-90, Math.min(90, value));

export const normalizeLongitude = (value) => {
  if (!Number.isFinite(value)) {
    return value;
  }
  let normalized = value;
  while (normalized > 180) {
    normalized -= 360;
  }
  while (normalized < -180) {
    normalized += 360;
  }
  return normalized;
};

export const haversineDistanceMeters = (a, b) => {
  const pointA = resolveCoordinates(a);
  const pointB = resolveCoordinates(b);
  if (!pointA || !pointB) {
    return Infinity;
  }

  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(pointB.longitude - pointA.longitude);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);

  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
};

export const metersToMiles = (meters) => {
  if (!Number.isFinite(meters)) {
    return null;
  }
  return meters / METERS_PER_MILE;
};

export const formatDistanceMiles = (meters, { decimals = 1 } = {}) => {
  if (!Number.isFinite(meters)) {
    return null;
  }
  return (meters / METERS_PER_MILE).toFixed(decimals);
};

export const formatDistanceMetersLabel = (value) => {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
  }
  return `${Math.round(value)} m`;
};

export { EARTH_RADIUS_METERS, METERS_PER_MILE, toRadians, resolveCoordinates };

export default {
  METERS_PER_MILE,
  EARTH_RADIUS_METERS,
  toRadians,
  resolveCoordinates,
  metersToLatitudeDegrees,
  metersToLongitudeDegrees,
  clampLatitude,
  normalizeLongitude,
  haversineDistanceMeters,
  metersToMiles,
  formatDistanceMiles,
  formatDistanceMetersLabel
};
