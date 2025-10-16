import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import runtimeConfig from './config/runtime';

const app = initializeApp(runtimeConfig.firebase.config);
const auth = getAuth(app);

if (runtimeConfig.firebase.authEmulatorUrl) {
  connectAuthEmulator(auth, runtimeConfig.firebase.authEmulatorUrl, { disableWarnings: true });
}

export { auth };
