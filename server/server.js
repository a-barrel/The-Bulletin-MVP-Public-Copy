const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load environment variables before reading runtime config
dotenv.config();

const runtime = require('./config/runtime');

console.log(`Pinpoint server running in ${runtime.mode} mode`);

if (runtime.isOffline) {
  // Default to the local emulator host unless one is already set.
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
}

const Location = require('./models/Location');
const { syncAllFirebaseUsers } = require('./services/firebaseUserSync');

const app = express();
app.enable('trust proxy');

// Middleware
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const soundsDir = path.join(uploadsDir, 'sounds');
const clientImagesDir = path.join(__dirname, '..', 'client', 'public', 'images');
fs.mkdirSync(imagesDir, { recursive: true });
fs.mkdirSync(soundsDir, { recursive: true });
app.set('uploadsDir', uploadsDir);
app.set('imagesDir', imagesDir);
app.set('soundsDir', soundsDir);
app.use('/images', express.static(imagesDir));
app.use('/images', express.static(clientImagesDir));
app.use('/uploads/images', express.static(imagesDir));
app.use('/uploads/images', express.static(clientImagesDir));
app.use('/sounds', express.static(soundsDir));

// MongoDB connection
mongoose
  .connect(runtime.mongoUri)
  .then(async () => {
    const mongoLabel = runtime.isOffline ? runtime.mongoUri : 'online cluster';
    console.log(`Connected to MongoDB (${mongoLabel})`);
    try {
      await Location.syncIndexes();
      console.log('Location indexes synced');
    } catch (error) {
      console.error('Failed to sync location indexes:', error);
    }

    try {
      const summary = await syncAllFirebaseUsers({
        fallbackExportPath: runtime.isOffline
          ? path.join(__dirname, '..', 'emulator-data', 'auth_export', 'accounts.json')
          : undefined
      });
      console.log(
        `Firebase users synced (source: ${summary.source}, created: ${summary.created}, linked: ${summary.linked}, updated: ${summary.updated}, unchanged: ${summary.unchanged}, photo-updated: ${summary.photoUpdated ?? 0}, mongo-avatar-updated: ${summary.mongoAvatarUpdated ?? 0})`
      );

      if (summary.errors.length > 0) {
        console.warn('Some Firebase users could not be synced:', summary.errors);
      }
      if (summary.warnings.length > 0) {
        console.warn('Firebase user sync warnings:', summary.warnings);
      }
    } catch (error) {
      console.error('Failed to synchronize Firebase users with MongoDB:', error);
    }
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Social GPS API' });
});

const verifyToken = require('./middleware/verifyToken');

// API routes
app.use('/api/locations', verifyToken, require('./routes/locations'));
app.use('/api/users', require('./routes/users'));
app.use('/api/pins', verifyToken, require('./routes/pins'));
app.use('/api/bookmarks', verifyToken, require('./routes/bookmarks'));
app.use('/api/chats', verifyToken, require('./routes/chats'));
app.use('/api/updates', verifyToken, require('./routes/updates'));
app.use('/api/media', verifyToken, require('./routes/media'));
app.use('/api/reports', verifyToken, require('./routes/reports'));
app.use('/api/feedback', verifyToken, require('./routes/feedback'));
app.use('/api/storage', require('./routes/storage'));
app.use('/api/debug', require('./routes/debug'));
app.use('/api/auth', require('./routes/auth'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
