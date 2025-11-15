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
const { logLine, logIntegration } = require('./utils/devLogger');

console.log(`Pinpoint server running in ${runtime.mode} mode`);

const normalizedAllowedOrigins = Array.isArray(runtime.cors?.allowedOrigins)
  ? runtime.cors.allowedOrigins
  : [];
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (runtime.isOffline || normalizedAllowedOrigins.length === 0) {
      return callback(null, true);
    }
    const normalized = origin.toLowerCase();
    if (normalizedAllowedOrigins.includes(normalized)) {
      return callback(null, true);
    }
    const error = new Error(`CORS: Origin "${origin}" is not allowed`);
    error.status = 403;
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length'],
  maxAge: 60 * 60 * 24,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

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
const { startUpdateScheduler } = require('./services/updateScheduler');

const app = express();
app.enable('trust proxy');
app.set('etag', false);

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.json());
app.use((req, res, next) => {
  req.logError = (error, context = {}) => {
    const payload =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: String(error) };
    logLine('server-routes', `${req.method} ${req.originalUrl} ${payload.message}`, {
      severity: 'error',
      stack: payload.stack,
      context: {
        route: req.originalUrl,
        method: req.method,
        userId: req.user?.uid,
        ...context
      }
    });
  };
  next();
});
app.use((req, res, next) => {
  if (!runtime.isOffline) {
    return next();
  }
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const message = `${res.statusCode} ${req.method} ${req.originalUrl} ${durationMs.toFixed(2)}ms`;
      console.warn(`[http-error] ${message}`);
      logLine('http-errors', message, {
        severity: 'error',
        context: {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode
        }
      });
    }
  });
  next();
});

const uploadsDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const runtimeImagesDir = path.join(imagesDir, 'runtime');
const soundsDir = path.join(uploadsDir, 'sounds');
fs.mkdirSync(imagesDir, { recursive: true });
fs.mkdirSync(runtimeImagesDir, { recursive: true });
fs.mkdirSync(soundsDir, { recursive: true });
app.set('uploadsDir', uploadsDir);
app.set('imagesDir', imagesDir);
app.set('runtimeImagesDir', runtimeImagesDir);
app.set('soundsDir', soundsDir);

const serveImage = express.static(imagesDir);
const serveSound = express.static(soundsDir);
const fallbackTexturePath = path.join(imagesDir, 'UNKNOWN_TEXTURE.jpg');
const fallbackExists = fs.existsSync(fallbackTexturePath);
const sendFallbackTexture = (res, next) => {
  if (fallbackExists) {
    res.sendFile(fallbackTexturePath, (err) => {
      if (err) {
        next(err);
      }
    });
  } else {
    res.status(404).json({ message: 'Image not found.' });
  }
};

const imageHandler = (req, res, next) => {
  serveImage(req, res, (err) => {
    if (err && err.status !== 404) {
      return next(err);
    }
    if (res.headersSent) {
      return;
    }
    sendFallbackTexture(res, next);
  });
};

app.use('/images', imageHandler);
app.use('/uploads/images', imageHandler);
app.use('/sounds', (req, res, next) => {
  serveSound(req, res, (err) => {
    if (err) {
      return next(err);
    }
    if (!res.headersSent) {
      res.status(404).json({ message: 'Sound not found.' });
    }
  });
});

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
      logIntegration('firebase:sync-all', error);
    }

    startUpdateScheduler();
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
app.use('/api/dev-logs', require('./routes/devLogs'));
app.use('/api/auth', require('./routes/auth'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  logLine('runtime-errors', `${req.method} ${req.originalUrl}`, {
    severity: 'error',
    stack: err.stack,
    context: {
      method: req.method,
      url: req.originalUrl,
      message: err.message
    }
  });
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 8000;
const serverInstance = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const logFatal = (label, error) => {
  const message = `${label}: ${error instanceof Error ? error.stack || error.message : String(error)}`;
  console.error(message);
  logLine('runtime-errors', message, {
    severity: 'fatal',
    stack: error instanceof Error ? error.stack : undefined
  });
};

const shutdown = () => {
  if (serverInstance) {
    serverInstance.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason) => {
  logFatal('unhandledRejection', reason);
  shutdown();
});

process.on('uncaughtException', (error) => {
  logFatal('uncaughtException', error);
  shutdown();
});
