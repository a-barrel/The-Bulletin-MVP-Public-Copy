const mongoose = require('mongoose');

const entityReferenceSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: {
      type: String,
      enum: ['user', 'pin', 'bookmark', 'reply', 'location', 'chat-room', 'update', 'collection'],
      required: true
    },
    label: String,
    summary: String
  },
  { _id: false }
);

const pinPreviewSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['event', 'discussion'], required: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      },
      accuracy: Number
    },
    proximityRadiusMeters: Number,
    linkedLocationId: { type: mongoose.Schema.Types.ObjectId },
    linkedChatRoomId: { type: mongoose.Schema.Types.ObjectId },
    startDate: Date,
    endDate: Date,
    expiresAt: Date
  },
  { _id: false }
);

const updateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sourceUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetUserIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    payload: {
      type: {
        type: String,
        enum: [
          'new-pin',
          'pin-update',
          'event-starting-soon',
          'event-reminder',
          'popular-pin',
      'bookmark-update',
      'system',
      'chat-message',
      'friend-request',
      'chat-room-transition',
      'badge-earned',
      'discussion-expiring-soon'
    ],
    required: true
  },
      pin: pinPreviewSchema,
      title: { type: String, required: true },
      body: String,
      metadata: mongoose.Schema.Types.Mixed,
      relatedEntities: { type: [entityReferenceSchema], default: [] }
    },
    deliveredAt: Date,
    readAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

updateSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Update', updateSchema);
