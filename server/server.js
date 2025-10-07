const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

// Load environment variables before reading runtime config
dotenv.config();

const runtime = require('./config/runtime');

console.log(`Pinpoint server running in ${runtime.mode} mode`);

if (runtime.isOffline) {
  // Default to the local emulator host unless one is already set.
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
}

const Location = require('./models/Location');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
