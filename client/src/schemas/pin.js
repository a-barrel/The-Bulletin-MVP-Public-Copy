import { z } from 'zod';
import {
  ApproximateAddressSchema,
  GeoPointSchema,
  IsoDateStringSchema,
  MediaAssetSchema,
  ObjectIdSchema
} from './common.js';
import { PublicUserSchema } from './user.js';

const BasePinSchema = z.object({
  _id: ObjectIdSchema,
  title: z.string().min(1),
  description: z.string().max(4000),
  coordinates: GeoPointSchema,
  proximityRadiusMeters: z.number().int().positive().default(1609),
  photos: z.array(MediaAssetSchema).default([]),
  tags: z.array(z.string()).default([]),
  creator: PublicUserSchema,
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
  isActive: z.boolean().default(true),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  bookmarkCount: z.number().int().nonnegative().default(0),
  replyCount: z.number().int().nonnegative().default(0)
});

export const EventPinSchema = BasePinSchema.extend({
  type: z.literal('event'),
  startDate: IsoDateStringSchema,
  endDate: IsoDateStringSchema,
  address: z.object({
    precise: z.string().min(1),
    components: z.object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      postalCode: z.string().min(1),
      country: z.string().min(2)
    }).optional()
  }),
  participantCount: z.number().int().nonnegative().default(0),
  participantLimit: z.number().int().positive().optional(),
  attendingUserIds: z.array(ObjectIdSchema).optional(),
  attendable: z.boolean().default(true)
});

export const DiscussionPinSchema = BasePinSchema.extend({
  type: z.literal('discussion'),
  approximateAddress: ApproximateAddressSchema,
  expiresAt: IsoDateStringSchema,
  autoDelete: z.boolean().default(true)
});

export const PinSchema = z.discriminatedUnion('type', [EventPinSchema, DiscussionPinSchema]);

export const PinPreviewSchema = z.object({
  _id: ObjectIdSchema,
  type: z.enum(['event', 'discussion']),
  title: z.string().min(1),
  coordinates: GeoPointSchema,
  proximityRadiusMeters: z.number().int().positive(),
  creator: PublicUserSchema,
  startDate: IsoDateStringSchema.optional(),
  endDate: IsoDateStringSchema.optional(),
  expiresAt: IsoDateStringSchema.optional()
});

export const PinListItemSchema = PinPreviewSchema.extend({
  distanceMeters: z.number().nonnegative().optional(),
  isBookmarked: z.boolean().optional(),
  replyCount: z.number().int().nonnegative().optional()
});
