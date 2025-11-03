import runtimeConfig from '../../config/runtime';

import sharedToIdString from '../../utils/ids';
import formatDateTime, { formatRelativeTime } from '../../utils/dates';
import {
  clampLatitude,
  formatDistanceMiles,
  formatDistanceMetersLabel,
  haversineDistanceMeters,
  metersToLatitudeDegrees,
  metersToLongitudeDegrees,
  normalizeLongitude
} from '../../utils/geo';
import { normalizeProfileImagePath } from '../../utils/media';

export {
  formatDistanceMiles,
  formatDistanceMetersLabel,
  haversineDistanceMeters,
  metersToLatitudeDegrees,
  metersToLongitudeDegrees,
  clampLatitude,
  normalizeLongitude
};

export const resolveMediaUrl = (value, fallback = '/images/profile/profile-01.jpg') => {
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  const target = value && value.trim().length > 0 ? normalizeProfileImagePath(value.trim()) : fallback;
  if (/^(?:[a-z]+:)?\/\//i.test(target) || target.startsWith('data:')) {
    return target;
  }
  const normalizedRaw = target.startsWith('/') ? target : `/${target}`;
  const normalized = normalizeProfileImagePath(normalizedRaw);
  return base ? `${base}${normalized}` : normalized;
};

export const parseCommaSeparated = (value) =>
  `${value ?? ''}`
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export const parseRequiredNumber = (value, label) => {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
};

export const parseOptionalNumber = (value, label) => {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
};

export const parseOptionalDate = (value, label) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = `${value}`.trim();
  if (!trimmed) {
    return undefined;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }
  return date.toISOString();
};

export const parseJsonField = (value, label) => {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `${label} must be valid JSON. ${
        error instanceof Error ? error.message : 'Unable to parse the supplied value.'
      }`
    );
  }
};

export const normalizeRoomName = (value) => `${value ?? ''}`.trim().toLowerCase();

export const toIdString = (value) => {
  const normalized = sharedToIdString(value);
  return normalized ?? '';
};

export const mongooseObjectIdLike = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

export const formatDateTimeLocal = (date) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 16);
};

export const formatReadableTimestamp = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const relative = formatRelativeTime(date);
  const absolute = formatDateTime(date);
  return relative ? `${relative} (${absolute})` : absolute;
};

export const deriveInitials = (value) => {
  if (!value) {
    return '?';
  }
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
};

export const coordinatesEqual = (left, right) => {
  if (!left || !right) {
    return false;
  }
  const latEqual = Math.abs(left.latitude - right.latitude) < 1e-9;
  const lonEqual = Math.abs(left.longitude - right.longitude) < 1e-9;
  const accuracyEqual =
    (left.accuracy === undefined && right.accuracy === undefined) ||
    Math.abs((left.accuracy ?? 0) - (right.accuracy ?? 0)) < 1e-6;
  return latEqual && lonEqual && accuracyEqual;
};

export const shiftLocationByDirection = (source, direction, stepMeters) => {
  if (
    !source ||
    !Number.isFinite(source.latitude) ||
    !Number.isFinite(source.longitude) ||
    !direction
  ) {
    return null;
  }

  const meters = stepMeters ?? 0;
  const latitudeOffset = metersToLatitudeDegrees(meters);
  const longitudeOffset = metersToLongitudeDegrees(meters, source.latitude);
  let nextLatitude = source.latitude;
  let nextLongitude = source.longitude;

  switch (direction) {
    case 'north':
      nextLatitude += latitudeOffset;
      break;
    case 'south':
      nextLatitude -= latitudeOffset;
      break;
    case 'east':
      nextLongitude += longitudeOffset;
      break;
    case 'west':
      nextLongitude -= longitudeOffset;
      break;
    default:
      return null;
  }

  const latitude = clampLatitude(nextLatitude);
  const longitude = normalizeLongitude(nextLongitude);

  if (
    Math.abs(latitude - source.latitude) < 1e-9 &&
    Math.abs(longitude - source.longitude) < 1e-9
  ) {
    return source;
  }

  return {
    latitude,
    longitude,
    accuracy: source.accuracy
  };
};

export const evaluateRoomAccess = (room, location) => {
  if (!room) {
    return { allowed: false, reason: 'Select a chat room to begin.' };
  }

  if (room.isGlobal || (room.radiusMeters && room.radiusMeters >= 40000000)) {
    return { allowed: true };
  }

  const coordinates = room.coordinates?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return { allowed: true };
  }

  if (!location || Number.isNaN(location.latitude) || Number.isNaN(location.longitude)) {
    return {
      allowed: false,
      reason: 'Spoof your location before entering geofenced chat rooms.'
    };
  }

  const [roomLongitude, roomLatitude] = coordinates;
  const distanceMeters = haversineDistanceMeters(
    { latitude: location.latitude, longitude: location.longitude },
    { latitude: roomLatitude, longitude: roomLongitude }
  );

  if (!Number.isFinite(distanceMeters)) {
    return { allowed: true };
  }

  if (room.radiusMeters !== undefined && distanceMeters > room.radiusMeters) {
    const withinLabel =
      distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)} km`
        : `${Math.round(distanceMeters)} m`;
    const radiusLabel =
      room.radiusMeters >= 1000
        ? `${(room.radiusMeters / 1000).toFixed(1)} km`
        : `${Math.round(room.radiusMeters)} m`;
    return {
      allowed: false,
      reason: `Outside the "${room.name}" radius. You're ${withinLabel} away; move within ${radiusLabel}.`,
      distanceMeters,
      radiusMeters: room.radiusMeters
    };
  }

  return {
    allowed: true,
    distanceMeters,
    radiusMeters: room.radiusMeters
  };
};

export const isGlobalChatRoom = (room) =>
  Boolean(room?.isGlobal) ||
  (Number.isFinite(room?.radiusMeters) && room.radiusMeters >= 40000000);

export const resolveActiveRoomForLocation = (rooms, location) => {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return null;
  }

  let bestRoom = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const room of rooms) {
    const access = evaluateRoomAccess(room, location);
    if (!access.allowed) {
      continue;
    }

    const isGlobal = isGlobalChatRoom(room);
    const distance = Number.isFinite(access.distanceMeters) ? access.distanceMeters : Number.POSITIVE_INFINITY;
    const score = isGlobal ? distance + 1e6 : distance;

    if (score < bestScore) {
      bestRoom = room;
      bestScore = score;
    }
  }

  return bestRoom;
};

export const dedupeChatRooms = (rooms) => {
  if (!Array.isArray(rooms)) {
    return [];
  }

  const byPreset = new Map();
  const byFallback = new Map();

  const pickPreferred = (current, candidate) => {
    if (!current) {
      return candidate;
    }
    const currentHasPreset = Boolean(current?.presetKey);
    const candidateHasPreset = Boolean(candidate?.presetKey);
    if (currentHasPreset !== candidateHasPreset) {
      return candidateHasPreset ? candidate : current;
    }
    const currentMembers = current?.participantIds?.length ?? 0;
    const candidateMembers = candidate?.participantIds?.length ?? 0;
    return candidateMembers > currentMembers ? candidate : current;
  };

  for (const room of rooms) {
    if (!room) {
      continue;
    }
    if (room.presetKey) {
      byPreset.set(room.presetKey, pickPreferred(byPreset.get(room.presetKey), room));
      continue;
    }
    const normalizedName = normalizeRoomName(room.name);
    byFallback.set(normalizedName, pickPreferred(byFallback.get(normalizedName), room));
  }

  const deduped = [...byPreset.values(), ...byFallback.values()];
  return deduped;
};

export const extractPinLocation = (pin) => {
  const coordinates = pin?.coordinates?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
};
