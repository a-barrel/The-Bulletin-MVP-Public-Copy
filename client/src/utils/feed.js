import resolveAssetUrl from './media';
import toIdString from './ids';

const PLACEHOLDER_COLORS = [
  '#7c3aed',
  '#f97316',
  '#22d3ee',
  '#facc15',
  '#10b981',
  '#f43f5e',
  '#38bdf8',
  '#a855f7',
  '#f59e0b'
];

const buildPlaceholderAvatar = (seed = 0) => {
  const normalizedSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
  const color = PLACEHOLDER_COLORS[normalizedSeed % PLACEHOLDER_COLORS.length];
  const encodedColor = encodeURIComponent(color);
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='${encodedColor}'/><circle cx='32' cy='24' r='12' fill='%23ffffff' opacity='0.45'/><rect x='14' y='38' width='36' height='16' rx='8' fill='%23ffffff' opacity='0.35'/></svg>`;
};

export const DEFAULT_AVATAR = buildPlaceholderAvatar(0);

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

export const resolveLibraryAvatar = (seed = 0) => buildPlaceholderAvatar(seed);

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
