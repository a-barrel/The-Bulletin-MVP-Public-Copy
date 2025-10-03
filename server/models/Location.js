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

module.exports = mongoose.model('Location', locationSchema);
