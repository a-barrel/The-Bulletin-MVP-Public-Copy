const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const admin = require('firebase-admin');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const runtime = require('../config/runtime');
const { syncAllFirebaseUsers } = require('../services/firebaseUserSync');

async function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  if (runtime.isOffline) {
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = runtime.firebase.emulatorHost;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || 'pinpoint-offline';
    admin.initializeApp({ projectId });
    console.log(`Firebase Auth emulator enabled at ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  } else {
    const serviceAccount = runtime.firebase.serviceAccountJson
      ? JSON.parse(runtime.firebase.serviceAccountJson)
      : undefined;

    admin.initializeApp({
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount)
        : admin.credential.applicationDefault()
    });
    console.log('Firebase Admin initialized for production environment');
  }
}

async function main() {
  await initializeFirebaseAdmin();

  await mongoose.connect(runtime.mongoUri);
  console.log(`Connected to MongoDB at ${runtime.mongoUri}`);

  try {
    const fallbackExportPath = path.join(__dirname, '..', '..', 'emulator-data', 'auth_export', 'accounts.json');
    const summary = await syncAllFirebaseUsers({
      fallbackExportPath: runtime.isOffline ? fallbackExportPath : undefined
    });
    console.log(
      `Firebase user sync complete (source: ${summary.source}, created: ${summary.created}, linked: ${summary.linked}, updated: ${summary.updated}, unchanged: ${summary.unchanged})`
    );

    if (summary.errors.length > 0) {
      console.warn('Some accounts failed to sync:', summary.errors);
    }
    if (summary.warnings.length > 0) {
      console.warn('Warnings during Firebase user sync:', summary.warnings);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Firebase user sync failed:', error);
    mongoose.disconnect().finally(() => process.exit(1));
  });
