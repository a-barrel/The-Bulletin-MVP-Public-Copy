const express = require('express');
const admin = require('firebase-admin');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

router.post('/logout', verifyToken, async (req, res) => {
  const uid = req?.user?.uid;
  if (!uid) {
    return res.status(400).json({ message: 'Authenticated user id is required to revoke session.' });
  }

  try {
    await admin.auth().revokeRefreshTokens(uid);
    return res.status(204).send();
  } catch (error) {
    console.error('Failed to revoke Firebase refresh tokens for user', uid, error);
    return res.status(500).json({ message: 'Failed to revoke session tokens.' });
  }
});

module.exports = router;
