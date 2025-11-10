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

const pinStatsSchema = new mongoose.Schema(
  {
    bookmarkCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 }
  },
  { _id: false }
);

const pinOptionsSchema = new mongoose.Schema(
  {
    allowBookmarks: { type: Boolean, default: true },
    allowShares: { type: Boolean, default: true },
    allowReplies: { type: Boolean, default: true },
    showAttendeeList: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    contentAdvisory: { type: String, default: undefined },
    reminderMinutesBefore: { type: Number, default: undefined },
    highlightColor: { type: String, default: undefined },
    visibilityMode: {
      type: String,
      enum: ['map-only', 'list-only', 'map-and-list'],
      default: 'map-and-list'
    }
  },
  { _id: false }
);

const pinSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['event', 'discussion'], required: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
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
    proximityRadiusMeters: { type: Number, default: 1609 },
    photos: { type: [mediaAssetSchema], default: [] },
    coverPhoto: mediaAssetSchema,
    tagIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    tags: { type: [String], default: [] },
    relatedPinIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    linkedLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    linkedChatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProximityChatRoom' },
    visibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
    isActive: { type: Boolean, default: true },
    stats: { type: pinStatsSchema, default: () => ({}) },
    options: { type: pinOptionsSchema, default: () => ({}) },
    bookmarkCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    startDate: Date,
    endDate: Date,
    address: {
      precise: String,
      components: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
      }
    },
    participantLimit: Number,
    participantCount: { type: Number, default: 0 },
    attendingUserIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    attendeeWaitlistIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    attendable: { type: Boolean, default: true },
    approximateAddress: {
      city: String,
      state: String,
      country: String,
      formatted: String
    },
    expiresAt: Date,
    autoDelete: { type: Boolean, default: true }
  },
  { timestamps: true }
);

pinSchema.index({ coordinates: '2dsphere' });
pinSchema.index({ creatorId: 1, updatedAt: -1 });

module.exports = mongoose.model('Pin', pinSchema);
