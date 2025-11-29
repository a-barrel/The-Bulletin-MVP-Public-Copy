const admin = require('firebase-admin');
const { ensureUserForFirebaseAccount } = require('../services/firebaseUserSync');
const { logIntegration } = require('../utils/devLogger');
const runtime = require('../config/runtime');

module.exports = async function verifyToken(req, res, next) {
  const authorizationHeader = req.headers.authorization;
  let token = undefined;

  if (authorizationHeader) {
    const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch?.[1]) {
      token = bearerMatch[1].trim();
    } else {
      try {
        const decoded = decodeURIComponent(authorizationHeader);
        const decodedMatch = decoded.match(/^Bearer\s+(.+)$/i);
        if (decodedMatch?.[1]) {
          token = decodedMatch[1].trim();
        }
      } catch (error) {
        // Ignore decode errors; fall back to raw header value.
      }

      if (!token) {
        token = authorizationHeader.trim();
      }
    }
  }

  // In offline mode, allow requests without a token by issuing a demo identity.
  if (!token && runtime.isOffline) {
    const fallbackUser = {
      uid: 'OFFLINE_DEMO',
      user_id: 'OFFLINE_DEMO',
      email: 'offline-demo@pinpoint.local',
      name: 'Offline Demo User',
      firebaseSignInProvider: 'emulator',
      roles: ['developer', 'user']
    };
    req.user = fallbackUser;
    req.viewer = {
      _id: 'OFFLINE_DEMO',
      displayName: fallbackUser.name,
      email: fallbackUser.email,
      roles: fallbackUser.roles,
      accountStatus: 'active'
    };
    return next();
  }

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;

    try {
      const viewer = await ensureUserForFirebaseAccount(decodedToken);
      req.viewer = viewer;

      if (viewer?.accountStatus === 'suspended') {
        return res.status(403).json({
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Please contact support if you believe this is an error.'
        });
      }
    } catch (error) {
      console.error('Failed to sync Firebase user with MongoDB', error);
      logIntegration('firebase:sync-user', error);
      return res.status(500).json({ message: 'Failed to sync Firebase user' });
    }

    next();
  } catch (error) {
    // Offline mode fallback: if the emulator is unreachable, allow a demo token so the app can function.
    const isNetworkError = error?.errorInfo?.code === 'app/network-error';
    const isOfflineDemoToken = runtime.isOffline && token === runtime.offlineAuthToken;
    if (runtime.isOffline && (isNetworkError || isOfflineDemoToken)) {
      const fallbackUser = {
        uid: 'OFFLINE_DEMO',
        user_id: 'OFFLINE_DEMO',
        email: 'offline-demo@pinpoint.local',
        name: 'Offline Demo User',
        firebaseSignInProvider: 'emulator',
        roles: ['developer', 'user']
      };
      req.user = fallbackUser;
      req.viewer = {
        _id: 'OFFLINE_DEMO',
        displayName: fallbackUser.name,
        email: fallbackUser.email,
        roles: fallbackUser.roles,
        accountStatus: 'active'
      };
      return next();
    }

    console.error('Error verifying token:', error);
    logIntegration('firebase:verify-token', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};
