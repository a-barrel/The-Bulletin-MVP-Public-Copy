import resolveAssetUrl from './media';
import toIdString from './ids';

export const DEFAULT_AVATAR = 'https://i.pravatar.cc/100?img=64';

export const FALLBACK_NAMES = [
  'Scout',
  'Soldier',
  'Pyro',
  'Demoman',
  'Heavy',
  'Engineer',
  'Medic',
  'Sniper',
  'Spy'
];

export const resolveAuthorName = (value) => {
  if (!value) {
    return 'Unknown';
  }

  const candidates = [
    value.authorName,
    value.author,
    value.creator?.displayName,
    value.creator?.username,
    value.displayName,
    value.username,
    value.profile?.displayName,
    value.profile?.username
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return 'Unknown';
};

export const resolveAuthorAvatar = (value, { fallback = DEFAULT_AVATAR } = {}) => {
  const candidates = [
    value?.creator?.avatar,
    value?.avatar,
    value?.profile?.avatar
  ];

  for (const candidate of candidates) {
    const resolved = resolveAssetUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return fallback;
};

export const resolveLibraryAvatar = (seed = 0) => {
  const normalizedSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
  return `https://i.pravatar.cc/100?u=pinpoint-fallback-${normalizedSeed}`;
};

export const normalizeAttendeeRecord = (record, fallbackSeed = 0) => {
  const normalizedId =
    toIdString(record?.userId) ??
    toIdString(record?._id) ??
    toIdString(record?.profile?._id) ??
    toIdString(record?.profile?.userId) ??
    toIdString(record?.user?._id);

  const name =
    record?.displayName ||
    record?.username ||
    record?.profile?.displayName ||
    record?.profile?.username ||
    record?.email ||
    record?.profile?.email ||
    null;

  const avatar =
    resolveAssetUrl(
      record?.avatar ||
        record?.profile?.avatar ||
        record?.user?.avatar
    ) ?? resolveLibraryAvatar(fallbackSeed);

  return {
    id: normalizedId ?? `attendee-${fallbackSeed}`,
    userId: normalizedId ?? null,
    name: name ? String(name) : `Guest ${fallbackSeed + 1}`,
    avatar,
    raw: record
  };
};

export default {
  DEFAULT_AVATAR,
  FALLBACK_NAMES,
  resolveAuthorName,
  resolveAuthorAvatar,
  resolveLibraryAvatar,
  normalizeAttendeeRecord
};
