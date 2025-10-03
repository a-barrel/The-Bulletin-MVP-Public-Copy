const express = require('express');
const { z, ZodError } = require('zod');
const router = express.Router();
const Location = require('../models/Location');
const {
  LocationWriteSchema,
  LocationQuerySchema,
  NearbyUserSchema
} = require('../schemas/location');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    // TODO: Add real Firebase token verification when ready.
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const toISOString = (value) => (value ? new Date(value).toISOString() : undefined);

const mapLocationToDto = (location) => {
  const accuracy = location.accuracy ?? undefined;
  const dto = {
    _id: location._id.toString(),
    userId: location.userId,
    coordinates: {
      type: 'Point',
      coordinates: location.coordinates.coordinates
    },
    isPublic: location.isPublic,
    createdAt: toISOString(location.createdAt),
    lastSeenAt: toISOString(location.lastSeenAt),
    expiresAt: toISOString(location.expiresAt)
  };

  if (accuracy !== undefined) {
    dto.coordinates.accuracy = accuracy;
    dto.accuracy = accuracy;
  }

  return dto;
};

router.post('/', verifyToken, async (req, res) => {
  try {
    const parsed = LocationWriteSchema.parse(req.body);
    const now = new Date();

    const createdAt = parsed.createdAt ? new Date(parsed.createdAt) : now;
    const lastSeenAt = parsed.lastSeenAt ? new Date(parsed.lastSeenAt) : now;

    const update = {
      $set: {
        coordinates: {
          type: 'Point',
          coordinates: parsed.coordinates.coordinates
        },
        isPublic: parsed.isPublic ?? true,
        lastSeenAt
      },
      $setOnInsert: {
        userId: parsed.userId,
        createdAt
      }
    };

    if (parsed.accuracy !== undefined) {
      update.$set.accuracy = parsed.accuracy;
    } else {
      update.$unset = { ...(update.$unset || {}), accuracy: '' };
    }

    if (parsed.expiresAt) {
      update.$set.expiresAt = new Date(parsed.expiresAt);
    } else {
      update.$unset = { ...(update.$unset || {}), expiresAt: '' };
    }

    const location = await Location.findOneAndUpdate(
      { userId: parsed.userId },
      update,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    res.status(201).json(mapLocationToDto(location));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Invalid location payload',
        issues: error.errors
      });
    }
    res.status(400).json({ message: error.message });
  }
});

router.get('/nearby', verifyToken, async (req, res) => {
  try {
    const queryInput = {
      longitude: req.query.longitude !== undefined ? Number(req.query.longitude) : undefined,
      latitude: req.query.latitude !== undefined ? Number(req.query.latitude) : undefined,
      maxDistance: req.query.maxDistance !== undefined ? Number(req.query.maxDistance) : undefined
    };

    const parsed = LocationQuerySchema.parse(queryInput);

    const pipeline = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parsed.longitude, parsed.latitude]
          },
          distanceField: 'distanceMeters',
          maxDistance: parsed.maxDistance,
          spherical: true
        }
      },
      { $match: { isPublic: true } },
      {
        $project: {
          userId: 1,
          coordinates: '$coordinates.coordinates',
          accuracy: '$accuracy',
          lastSeenAt: 1,
          distanceMeters: 1
        }
      },
      { $limit: 50 }
    ];

    const docs = await Location.aggregate(pipeline);

    const formatted = docs.map((doc) => {
      const coordinates = {
        type: 'Point',
        coordinates: doc.coordinates
      };

      if (doc.accuracy !== undefined && doc.accuracy !== null) {
        coordinates.accuracy = doc.accuracy;
      }

      return {
        userId: doc.userId,
        coordinates,
        distanceMeters: doc.distanceMeters,
        lastSeenAt: toISOString(doc.lastSeenAt) || toISOString(new Date())
      };
    });

    const nearbyUsers = z.array(NearbyUserSchema).parse(formatted);

    res.json(nearbyUsers);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: 'Invalid nearby query parameters',
        issues: error.errors
      });
    }
    res.status(400).json({ message: error.message });
  }
});

router.get('/history/:userId', verifyToken, async (req, res) => {
  try {
    const locations = await Location.find({ userId: req.params.userId })
      .sort({ lastSeenAt: -1 })
      .limit(50);

    res.json(locations.map(mapLocationToDto));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
