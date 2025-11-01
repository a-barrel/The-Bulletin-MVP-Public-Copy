import '@testing-library/jest-dom';

import { TextEncoder, TextDecoder } from 'util';

try {
  const { fetch: undiciFetch, Headers, Request, Response } = require('undici');

  if (typeof global.fetch === 'undefined') {
    global.fetch = undiciFetch;
  }
  if (typeof global.Headers === 'undefined') {
    global.Headers = Headers;
  }
  if (typeof global.Request === 'undefined') {
    global.Request = Request;
  }
  if (typeof global.Response === 'undefined') {
    global.Response = Response;
  }
} catch {
  if (typeof global.fetch === 'undefined') {
    global.fetch = jest.fn(() => Promise.reject(new Error('fetch is not implemented in tests')));
  }
  if (typeof global.Response === 'undefined') {
    global.Response = class {};
  }
}

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

if (typeof globalThis.__PINPOINT_IMPORT_META_ENV__ === 'undefined') {
  globalThis.__PINPOINT_IMPORT_META_ENV__ = {
    DEV: true,
    PROD: false,
    MODE: 'test',
    VITE_RUNTIME_MODE: 'offline',
    VITE_FIREBASE_CONFIG_OFFLINE: JSON.stringify({
      apiKey: 'demo-api-key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo-project',
      appId: 'demo-app-id'
    }),
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099'
  };
}
