const { z } = require('zod');
const {
  ApproximateAddressSchema,
  GeoPointSchema,
  IsoDateStringSchema,
  MediaAssetSchema,
  ObjectIdSchema,
  VisibilityLevelSchema,
  AuditMetadataSchema
} = require('./common');
const { PublicUserSchema } = require('./user');

const PinStatsSchema = z.object({
  bookmarkCount: z.number().int().nonnegative().default(0),
  replyCount: z.number().int().nonnegative().default(0),
  shareCount: z.number().int().nonnegative().default(0),
  viewCount: z.number().int().nonnegative().default(0)
});

const RawPinOptionsSchema = z
  .object({
    allowBookmarks: z.boolean().optional(),
    allowShares: z.boolean().optional(),
    allowReplies: z.boolean().optional(),
    showAttendeeList: z.boolean().optional(),
    featured: z.boolean().optional(),
    visibilityMode: z.enum(['map-only', 'list-only', 'map-and-list']).optional(),
    reminderMinutesBefore: z.number().int().nonnegative().max(10080).optional(),
    contentAdvisory: z.string().trim().max(140).optional(),
    highlightColor: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
      .optional()
  })
  .strict()
  .default({});

const PinOptionsSchema = RawPinOptionsSchema.transform((value) => ({
  allowBookmarks: value.allowBookmarks ?? true,
  allowShares: value.allowShares ?? true,
  allowReplies: value.allowReplies ?? true,
  showAttendeeList: value.showAttendeeList ?? true,
  featured: value.featured ?? false,
  visibilityMode: value.visibilityMode ?? 'map-and-list',
  reminderMinutesBefore: value.reminderMinutesBefore,
  contentAdvisory: value.contentAdvisory,
  highlightColor: value.highlightColor
}));

const PinModerationSchema = z.object({
  status: z.enum(['clean', 'flagged', 'removed']).default('clean'),
  flaggedAt: IsoDateStringSchema.optional(),
  flaggedBy: ObjectIdSchema.optional(),
  flaggedReason: z.string().optional()
});

const BasePinSchema = z.object({
  _id: ObjectIdSchema,
  creatorId: ObjectIdSchema,
  creator: PublicUserSchema.optional(),
  title: z.string().min(1),
  description: z.string().max(4000),
  coordinates: GeoPointSchema,
  proximityRadiusMeters: z.number().int().positive().default(1609),
  photos: z.array(MediaAssetSchema).default([]),
  coverPhoto: MediaAssetSchema.optional(),
  tagIds: z.array(ObjectIdSchema).default([]),
  tags: z.array(z.string()).default([]),
  options: PinOptionsSchema.optional(),
  relatedPinIds: z.array(ObjectIdSchema).default([]),
  linkedLocationId: ObjectIdSchema.optional(),
  linkedChatRoomId: ObjectIdSchema.optional(),
  visibility: VisibilityLevelSchema.default('public'),
  isActive: z.boolean().default(true),
  stats: PinStatsSchema.default({ bookmarkCount: 0, replyCount: 0, shareCount: 0, viewCount: 0 }),
  bookmarkCount: z.number().int().nonnegative().default(0),
  replyCount: z.number().int().nonnegative().default(0),
  checkInCount: z.number().int().nonnegative().optional(),
  lastCheckInAt: IsoDateStringSchema.optional(),
  checkedInUserIds: z.array(ObjectIdSchema).optional(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  audit: AuditMetadataSchema.optional(),
  moderation: PinModerationSchema.optional(),
  viewerIsAttending: z.boolean().optional(),
  viewerHasBookmarked: z.boolean().optional(),
  viewerDistanceMeters: z.number().nonnegative().optional(),
  viewerWithinInteractionRadius: z.boolean().optional(),
  viewerInteractionLockReason: z.string().optional(),
  viewerInteractionLockMessage: z.string().optional()
});

const EventAddressComponentsSchema = z
  .object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(2)
  })
  .partial()
  .refine(
    (components) => Object.values(components).some((value) => value !== undefined),
    'Address components must include at least one field'
  );

const EventAddressSchema = z.object({
  precise: z.string().min(1),
  components: EventAddressComponentsSchema.optional()
});

const EventPinSchema = BasePinSchema.extend({
  type: z.literal('event'),
  startDate: IsoDateStringSchema,
  endDate: IsoDateStringSchema,
  address: EventAddressSchema.optional(),
  participantCount: z.number().int().nonnegative().default(0),
  participantLimit: z.number().int().positive().optional(),
  attendingUserIds: z.array(ObjectIdSchema).optional(),
  attendeeWaitlistIds: z.array(ObjectIdSchema).default([]),
  attendable: z.boolean().default(true)
});

const DiscussionPinSchema = BasePinSchema.extend({
  type: z.literal('discussion'),
  approximateAddress: ApproximateAddressSchema.optional(),
  expiresAt: IsoDateStringSchema,
  autoDelete: z.boolean().default(true),
  replyLimit: z.number().int().positive().optional()
});

const PinSchema = z.discriminatedUnion('type', [EventPinSchema, DiscussionPinSchema]);

const PinPreviewSchema = z.object({
  _id: ObjectIdSchema,
  type: z.enum(['event', 'discussion']),
  creatorId: ObjectIdSchema,
  creator: PublicUserSchema.optional(),
  title: z.string().min(1),
  coordinates: GeoPointSchema,
  proximityRadiusMeters: z.number().int().positive(),
  linkedLocationId: ObjectIdSchema.optional(),
  linkedChatRoomId: ObjectIdSchema.optional(),
  startDate: IsoDateStringSchema.optional(),
  endDate: IsoDateStringSchema.optional(),
  expiresAt: IsoDateStringSchema.optional()
});

const PinListItemSchema = PinPreviewSchema.extend({
  distanceMeters: z.number().nonnegative().optional(),
  isBookmarked: z.boolean().optional(),
  viewerHasBookmarked: z.boolean().optional(),
  viewerIsAttending: z.boolean().optional(),
  viewerOwnsPin: z.boolean().optional(),
  replyCount: z.number().int().nonnegative().optional(),
  stats: PinStatsSchema.optional(),
  options: PinOptionsSchema.optional(),
  coverPhoto: MediaAssetSchema.optional(),
  photos: z.array(MediaAssetSchema).optional()
});

module.exports = {
  PinStatsSchema,
  PinOptionsSchema,
  PinModerationSchema,
  BasePinSchema,
  EventPinSchema,
  DiscussionPinSchema,
  PinSchema,
  PinPreviewSchema,
  PinListItemSchema
};
