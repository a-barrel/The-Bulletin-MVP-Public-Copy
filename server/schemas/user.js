const { z } = require('zod');
const { MediaAssetSchema, ObjectIdSchema, IsoDateStringSchema } = require('./common');

const UserPreferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  notifications: z.object({
    proximity: z.boolean().default(true),
    updates: z.boolean().default(true),
    marketing: z.boolean().default(false)
  }).partial(),
  radiusPreferenceMeters: z.number().int().positive().default(16093).optional()
});

const UserStatsSchema = z.object({
  eventsHosted: z.number().int().nonnegative().default(0),
  eventsAttended: z.number().int().nonnegative().default(0),
  posts: z.number().int().nonnegative().default(0),
  bookmarks: z.number().int().nonnegative().default(0),
  followers: z.number().int().nonnegative().default(0),
  following: z.number().int().nonnegative().default(0)
});

const PublicUserSchema = z.object({
  _id: ObjectIdSchema,
  username: z.string().min(3),
  displayName: z.string().min(1),
  avatar: MediaAssetSchema.optional(),
  stats: UserStatsSchema.optional(),
  badges: z.array(z.string()).default([])
});

const UserProfileSchema = PublicUserSchema.extend({
  email: z.string().email().optional(),
  bio: z.string().max(500).optional(),
  banner: MediaAssetSchema.optional(),
  preferences: UserPreferencesSchema.optional(),
  blockedUserIds: z.array(ObjectIdSchema).default([]),
  roles: z.array(z.enum(['user', 'moderator', 'admin'])).default(['user']),
  locationSharingEnabled: z.boolean().default(false),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema
});

module.exports = {
  UserPreferencesSchema,
  UserStatsSchema,
  PublicUserSchema,
  UserProfileSchema
};
