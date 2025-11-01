const express = require('express');
const { z, ZodError } = require('zod');
const router = express.Router();
const Location = require('../models/Location');
const {
  LocationWriteSchema,
  LocationQuerySchema,
  NearbyUserSchema
} = require('../schemas/location');
const verifyToken = require('../middleware/verifyToken');
const { toIdString, mapIdList } = require('../utils/ids');

const toISOString = (value) => (value ? new Date(value).toISOString() : undefined);

const mapLocationToDto = (location) => {
  const coordinates = {
    type: 'Point',
    coordinates: location.coordinates.coordinates
  };

  if (location.accuracy !== undefined && location.accuracy !== null) {
    coordinates.accuracy = location.accuracy;
  }

  return {
    _id: location._id.toString(),
    userId: location.userId,
    coordinates,
    isPublic: location.isPublic,
    accuracy: location.accuracy ?? undefined,
    altitudeMeters: location.altitudeMeters ?? undefined,
    speedMetersPerSecond: location.speedMetersPerSecond ?? undefined,
    headingDegrees: location.headingDegrees ?? undefined,
    sessionId: toIdString(location.sessionId),
    deviceId: toIdString(location.deviceId),
    source: location.source ?? undefined,
    appVersion: location.appVersion ?? undefined,
    linkedPinIds: mapIdList(location.linkedPinIds),
    createdAt: toISOString(location.createdAt),
    lastSeenAt: toISOString(location.lastSeenAt),
    expiresAt: toISOString(location.expiresAt)
  };
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
        lastSeenAt,
        source: parsed.source,
        linkedPinIds: parsed.linkedPinIds ? parsed.linkedPinIds.map(String) : []
      },
      $setOnInsert: {
        userId: parsed.userId,
        createdAt
      }
    };

    const ensureUnset = (field) => {
      update.$unset = { ...(update.$unset || {}), [field]: '' };
    };

    if (parsed.accuracy !== undefined) {
      update.$set.accuracy = parsed.accuracy;
    } else {
      ensureUnset('accuracy');
    }

    if (parsed.altitudeMeters !== undefined) {
      update.$set.altitudeMeters = parsed.altitudeMeters;
    } else {
      ensureUnset('altitudeMeters');
    }

    if (parsed.speedMetersPerSecond !== undefined) {
      update.$set.speedMetersPerSecond = parsed.speedMetersPerSecond;
    } else {
      ensureUnset('speedMetersPerSecond');
    }

    if (parsed.headingDegrees !== undefined) {
      update.$set.headingDegrees = parsed.headingDegrees;
    } else {
      ensureUnset('headingDegrees');
    }

    if (parsed.sessionId !== undefined) {
      update.$set.sessionId = parsed.sessionId;
    } else {
      ensureUnset('sessionId');
    }

    if (parsed.deviceId !== undefined) {
      update.$set.deviceId = parsed.deviceId;
    } else {
      ensureUnset('deviceId');
    }

    if (parsed.appVersion !== undefined) {
      update.$set.appVersion = parsed.appVersion;
    } else {
      ensureUnset('appVersion');
    }

    if (parsed.expiresAt) {
      update.$set.expiresAt = new Date(parsed.expiresAt);
    } else {
      ensureUnset('expiresAt');
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
          distanceMeters: 1,
          sessionId: 1,
          source: 1,
          linkedPinIds: 1
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
        lastSeenAt: toISOString(doc.lastSeenAt) || toISOString(new Date()),
        sessionId: toIdString(doc.sessionId),
        source: doc.source || undefined,
        linkedPinIds: mapIdList(doc.linkedPinIds)
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
