/* global process */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator
} from 'firebase/auth';
import runtimeConfig from './config/runtime';

const app = initializeApp(runtimeConfig.firebase.config);
const persistenceLayers = [
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence
];

const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

const auth =
  typeof window === 'undefined' || isTestEnv
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: persistenceLayers,
        popupRedirectResolver: browserPopupRedirectResolver
      });

if (runtimeConfig.firebase.authEmulatorUrl) {
  connectAuthEmulator(auth, runtimeConfig.firebase.authEmulatorUrl, { disableWarnings: true });
}

export { auth, app };
