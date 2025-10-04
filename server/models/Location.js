const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value) => Array.isArray(value) && value.length === 2,
          message: 'Coordinates must be a [longitude, latitude] tuple'
        }
      }
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 5000
    },
    altitudeMeters: {
      type: Number
    },
    speedMetersPerSecond: {
      type: Number,
      min: 0
    },
    headingDegrees: {
      type: Number,
      min: 0,
      max: 360
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    source: {
      type: String,
      enum: ['web', 'ios', 'android', 'background'],
      default: 'web'
    },
    appVersion: {
      type: String
    },
    linkedPinIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date
    }
  },
  {
    minimize: false
  }
);

locationSchema.index({ coordinates: '2dsphere' });
locationSchema.index({ lastSeenAt: -1 });
locationSchema.index({ userId: 1, sessionId: 1 });

module.exports = mongoose.model('Location', locationSchema);
