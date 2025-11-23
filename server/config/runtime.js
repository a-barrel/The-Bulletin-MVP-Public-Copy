const allowedModes = new Set(['online', 'offline']);

const resolveMode = () => {
  const explicit = process.env.PINPOINT_RUNTIME_MODE
    ? process.env.PINPOINT_RUNTIME_MODE.toLowerCase()
    : undefined;

  if (explicit && allowedModes.has(explicit)) {
    return explicit;
  }

  if (explicit && !allowedModes.has(explicit)) {
    console.warn(
      `Unknown PINPOINT_RUNTIME_MODE "${process.env.PINPOINT_RUNTIME_MODE}". Falling back to offline mode.`
    );
  }

  // Render/Vercel set NODE_ENV=production. Treat anything else (local dev) as offline.
  return process.env.NODE_ENV === 'production' ? 'online' : 'offline';
};

const mode = resolveMode();
const isOffline = mode === 'offline';

const mongoUri = isOffline
  ? process.env.MONGODB_URI_OFFLINE || 'mongodb://127.0.0.1:27017/pinpoint'
  : process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pinpoint';

const offlineAuthToken = process.env.PINPOINT_OFFLINE_DEMO_TOKEN || 'demo-token';

const normalizeStorageBucket = (value) => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/^gs:\/\//i, '');
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
};

const parseCsv = (value) =>
  value
    ? value
        .split(/[,;]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const parseCsvLower = (value) => parseCsv(value).map((entry) => entry.toLowerCase()).filter(Boolean);

const parseOriginList = (value) =>
  parseCsv(value).map((entry) => entry.toLowerCase()).filter(Boolean);

const TENOR_CONTENT_FILTERS = new Set(['off', 'low', 'medium', 'high']);
const resolveTenorContentFilter = (value) => {
  if (!value) {
    return 'high';
  }
  const normalized = value.trim().toLowerCase();
  if (!TENOR_CONTENT_FILTERS.has(normalized)) {
    console.warn(
      `Unknown TENOR_CONTENT_FILTER value "${value}". Falling back to "high".`
    );
    return 'high';
  }
  return normalized;
};

const firebase = {
  serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  emulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
  storageBucket: normalizeStorageBucket(process.env.FIREBASE_STORAGE_BUCKET)
};

const integrations = {
  tenor: {
    apiKey: process.env.TENOR_API_KEY ? process.env.TENOR_API_KEY.trim() : undefined,
    clientKey: process.env.TENOR_CLIENT_KEY
      ? process.env.TENOR_CLIENT_KEY.trim()
      : 'pinpoint-app',
    contentFilter: resolveTenorContentFilter(process.env.TENOR_CONTENT_FILTER)
  }
};

const resolvePublicBaseUrl = () => {
  const explicit = process.env.PINPOINT_PUBLIC_BASE_URL;
  if (explicit && explicit.trim()) {
    return explicit.trim().replace(/\/+$/, '');
  }

  if (isOffline) {
    const fallback = process.env.PINPOINT_PUBLIC_BASE_URL_OFFLINE;
    if (fallback && fallback.trim()) {
      return fallback.trim().replace(/\/+$/, '');
    }
    return 'http://localhost:8000';
  }

  return undefined;
};

const publicBaseUrl = resolvePublicBaseUrl();

const allowAccountSwapOnline = parseBoolean(process.env.PINPOINT_ENABLE_ACCOUNT_SWAP_ONLINE, false);
const accountSwapAllowlist = new Set(
  parseCsv(process.env.PINPOINT_ACCOUNT_SWAP_ALLOWLIST).map((entry) => entry.toLowerCase())
);
const cors = {
  allowedOrigins: isOffline
    ? []
    : parseOriginList(
        process.env.PINPOINT_CORS_ALLOWLIST || process.env.PINPOINT_ALLOWED_ORIGINS
      )
};

const normalizeRoleName = (value, fallback) => {
  if (!value || !value.trim()) {
    return fallback;
  }
  return value.trim().toLowerCase();
};

const baseUserRole = normalizeRoleName(process.env.PINPOINT_BASE_USER_ROLE, 'user');
const developerRoleName = normalizeRoleName(process.env.PINPOINT_DEVELOPER_ROLE, 'developer');

const configuredElevatedRoles = parseCsvLower(process.env.PINPOINT_ELEVATED_ROLE_NAMES);
if (!configuredElevatedRoles.length) {
  configuredElevatedRoles.push(
    'admin',
    'moderator',
    'super-admin',
    'system-admin',
    developerRoleName
  );
}
const elevatedRoles = new Set(configuredElevatedRoles);

const defaultAlwaysAdminUserIds = new Set(['F69ZziUU5tXWJ7TtyDKwbvhbSzi1']);
parseCsv(process.env.PINPOINT_ALWAYS_ADMIN_UIDS).forEach((entry) => {
  if (entry) {
    defaultAlwaysAdminUserIds.add(entry);
  }
});

const defaultAlwaysAdminEmails = new Set(['thepinpointishere@gmail.com']);
parseCsvLower(process.env.PINPOINT_ALWAYS_ADMIN_EMAILS).forEach((entry) => {
  if (entry) {
    defaultAlwaysAdminEmails.add(entry);
  }
});

module.exports = {
  mode,
  isOffline,
  isOnline: !isOffline,
  mongoUri,
  publicBaseUrl,
  firebase,
  integrations,
  offlineAuthToken,
  debugAuth: {
    allowAccountSwapOnline,
    accountSwapAllowlist
  },
  cors,
  roles: {
    baseUserRole,
    developerRoleName,
    elevatedRoles,
    alwaysAdminUserIds: defaultAlwaysAdminUserIds,
    alwaysAdminEmails: defaultAlwaysAdminEmails
  }
};
