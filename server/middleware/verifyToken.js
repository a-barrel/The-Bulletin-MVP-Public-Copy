const admin = require('firebase-admin');
const runtime = require('../config/runtime');

module.exports = async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (runtime.isOffline) {
    if (!token || token === runtime.offlineAuthToken) {
      req.user = {
        uid: 'offline-demo-user',
        mode: 'offline',
        email: 'offline@example.com'
      };
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
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
