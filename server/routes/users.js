const express = require('express');
const router = express.Router();

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    // In a real app, verify the Firebase token here
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get user profile (placeholder for MVP)
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    // In a real app, fetch user data from database
    res.json({
      userId: req.params.userId,
      username: 'Demo User',
      lastActive: new Date()
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 