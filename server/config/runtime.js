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

const firebase = {
  serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  emulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
};

module.exports = {
  mode,
  isOffline,
  isOnline: !isOffline,
  mongoUri,
  firebase,
  offlineAuthToken
};
