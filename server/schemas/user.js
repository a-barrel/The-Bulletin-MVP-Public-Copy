const { z } = require('zod');
const {
  MediaAssetSchema,
  ObjectIdSchema,
  IsoDateStringSchema,
  AuditMetadataSchema
} = require('./common');

const UserStatusSchema = z.enum(['active', 'inactive', 'suspended', 'deleted']);

const NotificationPreferencesSchema = z
  .object({
    proximity: z.boolean().default(true),
    updates: z.boolean().default(true),
    marketing: z.boolean().default(false),
    chatTransitions: z.boolean().default(true),
    friendRequests: z.boolean().default(true),
    badgeUnlocks: z.boolean().default(true),
    moderationAlerts: z.boolean().default(true),
    dmMentions: z.boolean().default(true),
    emailDigests: z.boolean().default(false)
  })
  .partial();

const DisplayPreferencesSchema = z
  .object({
    textScale: z.number().min(0.5).max(2).default(1),
    reduceMotion: z.boolean().default(false),
    highContrast: z.boolean().default(false),
    mapDensity: z.enum(['compact', 'balanced', 'detailed']).default('balanced'),
    celebrationSounds: z.boolean().default(true)
  })
  .partial();

const DataPreferencesSchema = z
  .object({
    autoExportReminders: z.boolean().default(false)
  })
  .partial();

const UserPreferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  notifications: NotificationPreferencesSchema.optional(),
  notificationsMutedUntil: z
    .union([z.string().datetime(), z.null()])
    .optional(),
  radiusPreferenceMeters: z.number().int().positive().default(16093).optional(),
  statsPublic: z.boolean().default(true).optional(),
  filterCussWords: z.boolean().default(false).optional(),
  dmPermission: z.enum(['everyone', 'friends', 'nobody']).default('everyone').optional(),
  digestFrequency: z.enum(['immediate', 'daily', 'weekly', 'never']).default('weekly').optional(),
  display: DisplayPreferencesSchema.optional(),
  data: DataPreferencesSchema.optional()
});

const UserStatsSchema = z.object({
  eventsHosted: z.number().int().nonnegative().default(0),
  eventsAttended: z.number().int().nonnegative().default(0),
  posts: z.number().int().nonnegative().default(0),
  bookmarks: z.number().int().nonnegative().default(0),
  followers: z.number().int().nonnegative().default(0),
  following: z.number().int().nonnegative().default(0),
  cussCount: z.number().int().nonnegative().default(0)
});

const UserRelationshipSchema = z.object({
  followerIds: z.array(ObjectIdSchema).default([]),
  followingIds: z.array(ObjectIdSchema).default([]),
  friendIds: z.array(ObjectIdSchema).default([]),
  mutedUserIds: z.array(ObjectIdSchema).default([]),
  blockedUserIds: z.array(ObjectIdSchema).default([])
});

const PublicUserSchema = z.object({
  _id: ObjectIdSchema,
  username: z.string().min(3),
  displayName: z.string().min(1),
  avatar: MediaAssetSchema.optional(),
  stats: UserStatsSchema.optional(),
  badges: z.array(z.string()).default([]),
  primaryLocationId: ObjectIdSchema.optional(),
  accountStatus: UserStatusSchema.default('active')
});

const UserProfileSchema = PublicUserSchema.extend({
  email: z.string().email().optional(),
  bio: z.string().max(500).optional(),
  banner: MediaAssetSchema.optional(),
  preferences: UserPreferencesSchema.optional(),
  relationships: UserRelationshipSchema.optional(),
  locationSharingEnabled: z.boolean().default(false),
  pinnedPinIds: z.array(ObjectIdSchema).default([]),
  ownedPinIds: z.array(ObjectIdSchema).default([]),
  bookmarkCollectionIds: z.array(ObjectIdSchema).default([]),
  proximityChatRoomIds: z.array(ObjectIdSchema).default([]),
  recentLocationIds: z.array(ObjectIdSchema).default([]),
  mutualFriendCount: z.number().int().nonnegative().default(0).optional(),
  mutualFriends: z.array(PublicUserSchema).default([]).optional(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  audit: AuditMetadataSchema.optional()
});

module.exports = {
  UserStatusSchema,
  UserPreferencesSchema,
  UserStatsSchema,
  UserRelationshipSchema,
  PublicUserSchema,
  UserProfileSchema
};
