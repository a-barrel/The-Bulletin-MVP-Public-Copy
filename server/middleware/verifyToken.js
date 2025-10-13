const admin = require('firebase-admin');
const runtime = require('../config/runtime');
const { ensureUserForFirebaseAccount } = require('../services/firebaseUserSync');

module.exports = async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (runtime.isOffline) {
    if (!token || token === runtime.offlineAuthToken) {
      const offlineUser = {
        uid: 'offline-demo-user',
        mode: 'offline',
        email: 'offline@example.com'
      };
      req.user = offlineUser;

      try {
        await ensureUserForFirebaseAccount(offlineUser);
      } catch (error) {
        console.error('Failed to sync offline demo user with MongoDB', error);
        return res.status(500).json({ message: 'Failed to provision offline user' });
      }

      return next();
    }

    return res.status(401).json({ message: 'Invalid offline token' });
  }

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;

    try {
      await ensureUserForFirebaseAccount(decodedToken);
    } catch (error) {
      console.error('Failed to sync Firebase user with MongoDB', error);
      return res.status(500).json({ message: 'Failed to sync Firebase user' });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
