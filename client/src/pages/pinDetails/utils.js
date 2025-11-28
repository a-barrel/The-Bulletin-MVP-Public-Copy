export const EXPIRED_PIN_ID = '68e061721329566a22d47fff';
export const SAMPLE_PIN_IDS = [
  '68e061721329566a22d474aa',
  '68e061721329566a22d474ab',
  '68e061721329566a22d474ac',
  '68e061721329566a22d47a00'
];
export const FAR_PIN_ID = SAMPLE_PIN_IDS[0] ?? '68e061721329566a22d474aa';
export const MAX_PHOTO_PIN_ID = '68e061721329566a22d47a00';
export const BROKEN_TEXTURE_PIN_ID = '68e061721329566a22d47a01';
export const NO_IMAGE_PIN_ID = '68e061721329566a22d47a10';
export const ANALYTICS_SPARKLINE_WIDTH = 220;
export const ANALYTICS_SPARKLINE_HEIGHT = 72;

export const formatAnalyticsTimestamp = (value) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const resolveUserId = (user) => {
  if (!user) {
    return null;
  }
  if (typeof user === 'string') {
    const trimmed = user.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof user === 'object') {
    if (user.$oid) {
      return resolveUserId(user.$oid);
    }
    if (user._id) {
      return resolveUserId(user._id);
    }
    if (user.id) {
      return resolveUserId(user.id);
    }
    if (user.userId) {
      return resolveUserId(user.userId);
    }
    if (user.uid) {
      return resolveUserId(user.uid);
    }
    if (user.email) {
      return resolveUserId(user.email);
    }
    if (user.username) {
      return resolveUserId(user.username);
    }
  }
  return String(user);
};

export const promptNavTarget = ({ currentPath, routes }) => {
  const input =
    typeof window !== 'undefined' && typeof window.prompt === 'function'
      ? window.prompt(
          'Enter a pin ID to view. Shortcuts: "expired" loads an expired pin, "far" loads a distant pin, "3" loads the max-photo sample, "broken" loads the UNKNOWN_TEXTURE tester, "nopicture" loads the imageless pin. Leave blank for a random sample or cancel to stay put.'
        )
      : null;
  if (input === null) {
    return currentPath ?? null;
  }
  const trimmed = input.trim();
  if (trimmed.toLowerCase() === 'expired') {
    return routes.pin.byId(EXPIRED_PIN_ID);
  }
  if (trimmed.toLowerCase() === 'far') {
    const farId = FAR_PIN_ID;
    return `${routes.pin.byId(farId)}?preview=far`;
  }
  if (trimmed === '3' || trimmed === 'max') {
    return routes.pin.byId(MAX_PHOTO_PIN_ID);
  }
  if (trimmed === 'broken') {
    return routes.pin.byId(BROKEN_TEXTURE_PIN_ID);
  }
  if (trimmed.toLowerCase() === 'nopicture') {
    return routes.pin.byId(NO_IMAGE_PIN_ID);
  }
  if (!trimmed) {
    const randomId =
      SAMPLE_PIN_IDS[Math.floor(Math.random() * SAMPLE_PIN_IDS.length)] ?? '68e061721329566a22d474aa';
    return routes.pin.byId(randomId);
  }
  return routes.pin.byId(trimmed);
};
