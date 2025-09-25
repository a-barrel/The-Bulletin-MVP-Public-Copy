const express = require('express');
const router = express.Router();
const Location = require('../models/Location');

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    // In a real app, verify the Firebase token here
    // For MVP, we'll just pass the userId in the request body
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Update user location
router.post('/', verifyToken, async (req, res) => {
  try {
    const { userId, latitude, longitude, isPublic } = req.body;
    
    const location = new Location({
      userId,
      coordinates: {
        coordinates: [longitude, latitude]
      },
      isPublic: isPublic ?? true
    });

    await location.save();
    res.status(201).json(location);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get nearby users
router.get('/nearby', verifyToken, async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 10000 } = req.query; // maxDistance in meters

    const locations = await Location.find({
      coordinates: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      isPublic: true
    }).sort({ timestamp: -1 });

    res.json(locations);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get user's location history
router.get('/history/:userId', verifyToken, async (req, res) => {
  try {
    const locations = await Location.find({
      userId: req.params.userId
    }).sort({ timestamp: -1 }).limit(50);

    res.json(locations);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 