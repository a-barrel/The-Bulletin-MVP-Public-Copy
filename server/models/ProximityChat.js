const mongoose = require('mongoose');

const mediaAssetSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    thumbnailUrl: String,
    width: Number,
    height: Number,
    mimeType: String,
    description: String,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: false }
);

const proximityChatRoomSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: String,
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
    radiusMeters: { type: Number, required: true },
    isGlobal: { type: Boolean, default: false },
    participantCount: { type: Number, default: 0 },
    participantIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    moderatorIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    pinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pin' },
    presetKey: { type: String },
    audit: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  },
  { timestamps: true }
);

proximityChatRoomSchema.index({ coordinates: '2dsphere' });

const proximityChatMessageSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProximityChatRoom', required: true },
    pinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pin' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    replyToMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProximityChatMessage' },
    message: { type: String, required: true },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number]
      },
      accuracy: Number
    },
    attachments: { type: [mediaAssetSchema], default: [] },
    audit: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  },
  { timestamps: true }
);

const proximityChatPresenceSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProximityChatRoom', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId },
    joinedAt: { type: Date, required: true },
    lastActiveAt: { type: Date, required: true }
  },
  { timestamps: false }
);

proximityChatPresenceSchema.index({ roomId: 1, userId: 1 }, { unique: true });

module.exports = {
  ProximityChatRoom: mongoose.model('ProximityChatRoom', proximityChatRoomSchema),
  ProximityChatMessage: mongoose.model('ProximityChatMessage', proximityChatMessageSchema),
  ProximityChatPresence: mongoose.model('ProximityChatPresence', proximityChatPresenceSchema)
};
