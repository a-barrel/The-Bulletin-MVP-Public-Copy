const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const admin = require('firebase-admin');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const runtime = require('../config/runtime');
const {
  syncAllFirebaseUsers,
  provisionFirebaseAccountsForAllUsers
} = require('../services/firebaseUserSync');

async function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  if (runtime.isOffline) {
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = runtime.firebase.emulatorHost;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || 'bulletin-app-6548a';
    const appOptions = { projectId };
    if (runtime.firebase.storageBucket) {
      appOptions.storageBucket = runtime.firebase.storageBucket;
    }
    admin.initializeApp(appOptions);
    console.log(`Firebase Auth emulator enabled at ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  } else {
    const serviceAccount = runtime.firebase.serviceAccountJson
      ? JSON.parse(runtime.firebase.serviceAccountJson)
      : undefined;

    const appOptions = {
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount)
        : admin.credential.applicationDefault()
    };
    if (runtime.firebase.storageBucket) {
      appOptions.storageBucket = runtime.firebase.storageBucket;
    }
    admin.initializeApp(appOptions);
    console.log('Firebase Admin initialized for production environment');
  }
}

async function main() {
  await initializeFirebaseAdmin();

  await mongoose.connect(runtime.mongoUri);
  console.log(`Connected to MongoDB at ${runtime.mongoUri}`);

  try {
    const args = new Set(process.argv.slice(2));
    const dryRun = args.has('--dry-run');
    const defaultPassword = process.env.PINPOINT_SAMPLE_ACCOUNT_PASSWORD;

    if (dryRun) {
      console.log('Running Firebase user provisioning in dry-run mode.');
    }

    const provisionSummary = await provisionFirebaseAccountsForAllUsers({
      dryRun,
      defaultPassword
    });
    console.log(
      `Firebase account provisioning complete (processed: ${provisionSummary.processed}, created: ${provisionSummary.created}, linked: ${provisionSummary.linked}, updated: ${provisionSummary.updated}, unchanged: ${provisionSummary.unchanged}, would-create: ${provisionSummary.wouldCreate}, skipped: ${provisionSummary.skipped})`
    );
    if (provisionSummary.errors.length > 0) {
      console.warn('Errors provisioning Firebase accounts:', provisionSummary.errors);
    }
    if (provisionSummary.warnings.length > 0) {
      console.warn('Warnings during Firebase account provisioning:', provisionSummary.warnings);
    }

    if (dryRun) {
      console.log('Dry-run complete, skipping Firebase -> Mongo sync.');
      return;
    }

    const fallbackExportPath = path.join(__dirname, '..', '..', 'emulator-data', 'auth_export', 'accounts.json');
    const summary = await syncAllFirebaseUsers({
      fallbackExportPath: runtime.isOffline ? fallbackExportPath : undefined
    });
    console.log(
      `Firebase user sync complete (source: ${summary.source}, created: ${summary.created}, linked: ${summary.linked}, updated: ${summary.updated}, unchanged: ${summary.unchanged}, photo-updated: ${summary.photoUpdated ?? 0}, mongo-avatar-updated: ${summary.mongoAvatarUpdated ?? 0})`
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
