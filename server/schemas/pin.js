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
  relatedPinIds: z.array(ObjectIdSchema).default([]),
  linkedLocationId: ObjectIdSchema.optional(),
  linkedChatRoomId: ObjectIdSchema.optional(),
  visibility: VisibilityLevelSchema.default('public'),
  isActive: z.boolean().default(true),
  stats: PinStatsSchema.default({ bookmarkCount: 0, replyCount: 0, shareCount: 0, viewCount: 0 }),
  bookmarkCount: z.number().int().nonnegative().default(0),
  replyCount: z.number().int().nonnegative().default(0),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  audit: AuditMetadataSchema.optional(),
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
  autoDelete: z.boolean().default(true)
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
  replyCount: z.number().int().nonnegative().optional(),
  stats: PinStatsSchema.optional()
});

module.exports = {
  PinStatsSchema,
  BasePinSchema,
  EventPinSchema,
  DiscussionPinSchema,
  PinSchema,
  PinPreviewSchema,
  PinListItemSchema
};
