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

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    email: String,
    bio: String,
    avatar: mediaAssetSchema,
    banner: mediaAssetSchema,
    roles: { type: [String], default: ['user'] },
    accountStatus: { type: String, enum: ['active', 'inactive', 'suspended', 'deleted'], default: 'active' },
    preferences: {
      theme: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
      notifications: {
        proximity: { type: Boolean, default: true },
        updates: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false }
      },
      radiusPreferenceMeters: { type: Number, default: 16093 }
    },
    stats: {
      eventsHosted: { type: Number, default: 0 },
      eventsAttended: { type: Number, default: 0 },
      posts: { type: Number, default: 0 },
      bookmarks: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 }
    },
    relationships: {
      followerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      followingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      friendIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      mutedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      blockedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    locationSharingEnabled: { type: Boolean, default: false },
    primaryLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    pinnedPinIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pin' }],
    ownedPinIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pin' }],
    bookmarkCollectionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BookmarkCollection' }],
    proximityChatRoomIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProximityChatRoom' }],
    recentLocationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
