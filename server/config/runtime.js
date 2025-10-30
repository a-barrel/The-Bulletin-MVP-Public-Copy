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

const firebase = {
  serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  emulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
  storageBucket: normalizeStorageBucket(process.env.FIREBASE_STORAGE_BUCKET)
};

const allowAccountSwapOnline = parseBoolean(process.env.PINPOINT_ENABLE_ACCOUNT_SWAP_ONLINE, false);
const accountSwapAllowlist = new Set(
  parseCsv(process.env.PINPOINT_ACCOUNT_SWAP_ALLOWLIST).map((entry) => entry.toLowerCase())
);

module.exports = {
  mode,
  isOffline,
  isOnline: !isOffline,
  mongoUri,
  firebase,
  offlineAuthToken,
  debugAuth: {
    allowAccountSwapOnline,
    accountSwapAllowlist
  }
};
