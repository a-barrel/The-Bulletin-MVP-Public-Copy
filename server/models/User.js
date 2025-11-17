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
    firebaseUid: { type: String, unique: true, sparse: true },
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
        pinCreated: { type: Boolean, default: true },
        pinUpdates: { type: Boolean, default: true },
        eventReminders: { type: Boolean, default: true },
        discussionReminders: { type: Boolean, default: true },
        bookmarkReminders: { type: Boolean, default: true },
        chatMessages: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        chatTransitions: { type: Boolean, default: true },
        friendRequests: { type: Boolean, default: true },
        badgeUnlocks: { type: Boolean, default: true },
        moderationAlerts: { type: Boolean, default: true },
        dmMentions: { type: Boolean, default: true },
        emailDigests: { type: Boolean, default: false },
        quietHours: {
          type: [
            {
              day: {
                type: String,
                enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
              },
              start: { type: String, default: '22:00' },
              end: { type: String, default: '07:00' },
              enabled: { type: Boolean, default: true }
            }
          ],
          default: []
        }
      },
      notificationsMutedUntil: { type: Date, default: null },
      radiusPreferenceMeters: { type: Number, default: 16093 },
      statsPublic: { type: Boolean, default: true },
      filterCussWords: { type: Boolean, default: false },
      dmPermission: { type: String, enum: ['everyone', 'friends', 'nobody'], default: 'everyone' },
      digestFrequency: {
        type: String,
        enum: ['immediate', 'daily', 'weekly', 'never'],
        default: 'weekly'
      },
      display: {
        textScale: { type: Number, default: 1 },
        reduceMotion: { type: Boolean, default: false },
        highContrast: { type: Boolean, default: false },
        mapDensity: { type: String, enum: ['compact', 'balanced', 'detailed'], default: 'balanced' },
        celebrationSounds: { type: Boolean, default: true }
      },
      data: {
        autoExportReminders: { type: Boolean, default: false }
      }
    },
    stats: {
      eventsHosted: { type: Number, default: 0 },
      eventsAttended: { type: Number, default: 0 },
      posts: { type: Number, default: 0 },
      bookmarks: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
      cussCount: { type: Number, default: 0 }
    },
    badges: { type: [String], default: [] },
    relationships: {
      followerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      followingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      friendIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      mutedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      blockedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    messagingTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, default: 'web' },
        addedAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now }
      }
    ],
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
