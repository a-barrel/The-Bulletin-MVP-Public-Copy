import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Parse the Firebase config from the environment variable
const firebaseConfigString = import.meta.env.VITE_FIREBASE_CONFIG;
if (!firebaseConfigString) {
  throw new Error('VITE_FIREBASE_CONFIG is not set in the environment');
}
const firebaseConfig = JSON.parse(firebaseConfigString);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get the auth instance
const auth = getAuth(app);

// Connect to the Auth emulator in development
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099');
}

export { auth };
