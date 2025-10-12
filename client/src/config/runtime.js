const allowedModes = new Set(['online', 'offline']);

function resolveMode() {
  const explicit = import.meta.env.VITE_RUNTIME_MODE
    ? import.meta.env.VITE_RUNTIME_MODE.toLowerCase()
    : undefined;

  if (explicit && allowedModes.has(explicit)) {
    return explicit;
  }

  if (explicit && !allowedModes.has(explicit)) {
    console.warn(
      `Unknown VITE_RUNTIME_MODE "${import.meta.env.VITE_RUNTIME_MODE}". Falling back to offline mode.`
    );
  }

  // Vite sets import.meta.env.PROD during build for Vercel/production deploys.
  return import.meta.env.PROD ? 'online' : 'offline';
}

const mode = resolveMode();
const isOffline = mode === 'offline';

function parseJson(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse JSON configuration value.', error);
    return fallback;
  }
}

const apiBaseUrl = isOffline
  ? import.meta.env.VITE_API_BASE_URL_OFFLINE ??
    import.meta.env.VITE_API_URL_OFFLINE ??
    ''
  : import.meta.env.VITE_API_BASE_URL ??
    import.meta.env.VITE_API_URL ??
    '';

const fallbackToken = isOffline
  ? import.meta.env.VITE_API_ACCESS_TOKEN_OFFLINE ??
    import.meta.env.VITE_API_ACCESS_TOKEN ??
    'demo-token'
  : import.meta.env.VITE_API_ACCESS_TOKEN ??
    'demo-token';

const firebaseConfig =
  (isOffline && parseJson(import.meta.env.VITE_FIREBASE_CONFIG_OFFLINE)) ||
  parseJson(import.meta.env.VITE_FIREBASE_CONFIG);

if (!firebaseConfig) {
  throw new Error(
    `Missing Firebase config. Set ${
      isOffline ? 'VITE_FIREBASE_CONFIG_OFFLINE or VITE_FIREBASE_CONFIG' : 'VITE_FIREBASE_CONFIG'
    }.`
  );
}

const firebaseAuthEmulatorUrl = isOffline
  ? import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? 'http://localhost:9099'
  : undefined;

const troyExperimentEnabled = import.meta.env.VITE_ENABLE_TROY_EXPERIMENT === 'true';

export const runtimeConfig = {
  mode,
  isOffline,
  isOnline: !isOffline,
  apiBaseUrl,
  fallbackToken,
  troyExperimentEnabled,
  firebase: {
    config: firebaseConfig,
    authEmulatorUrl: firebaseAuthEmulatorUrl
  }
};

export default runtimeConfig;
