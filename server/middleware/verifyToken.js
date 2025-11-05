const admin = require('firebase-admin');
const { ensureUserForFirebaseAccount } = require('../services/firebaseUserSync');
const { logIntegration } = require('../utils/devLogger');

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
      logIntegration('firebase:sync-user', error);
      return res.status(500).json({ message: 'Failed to sync Firebase user' });
    }

    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    logIntegration('firebase:verify-token', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};
