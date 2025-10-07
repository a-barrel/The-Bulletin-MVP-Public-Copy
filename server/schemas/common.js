const { z } = require('zod');

const IsoDateStringSchema = z.string().datetime({ message: 'Expected ISO-8601 timestamp' });

const ObjectIdSchema = z.string().min(1, 'Expected a MongoDB object id string');

const TimestampSchema = z.object({
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema
});

const AuditMetadataSchema = TimestampSchema.extend({
  createdBy: ObjectIdSchema.optional(),
  updatedBy: ObjectIdSchema.optional()
});

const VisibilityLevelSchema = z.enum(['public', 'friends', 'private']);

const EntityTypeSchema = z.enum([
  'user',
  'pin',
  'bookmark',
  'reply',
  'location',
  'chat-room',
  'update',
  'collection'
]);

const EntityReferenceSchema = z.object({
  id: ObjectIdSchema,
  type: EntityTypeSchema,
  label: z.string().min(1).optional(),
  summary: z.string().optional()
});

const GeoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90)
  ]),
  accuracy: z.number().min(0).max(5000).optional()
});

const LocationBoundsSchema = z.object({
  center: GeoPointSchema,
  radiusMeters: z.number().int().positive()
});

const AddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().trim().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(2),
  formatted: z.string().optional()
});

const ApproximateAddressSchema = z
  .object({
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(2),
    formatted: z.string()
  })
  .partial()
  .refine(
    (address) => Object.values(address).some((value) => value !== undefined),
    'Approximate address must include at least one field'
  );

const MediaAssetSchema = z.object({
  _id: ObjectIdSchema.optional(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  description: z.string().optional(),
  uploadedAt: IsoDateStringSchema.optional(),
  uploadedBy: ObjectIdSchema.optional()
});

const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  total: z.number().int().nonnegative().optional()
});

const ReactionSchema = z.object({
  userId: ObjectIdSchema,
  type: z.enum(['like', 'interested', 'going', 'curious', 'flag']),
  reactedAt: IsoDateStringSchema
});

const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

module.exports = {
  IsoDateStringSchema,
  ObjectIdSchema,
  TimestampSchema,
  AuditMetadataSchema,
  VisibilityLevelSchema,
  EntityTypeSchema,
  EntityReferenceSchema,
  GeoPointSchema,
  LocationBoundsSchema,
  AddressSchema,
  ApproximateAddressSchema,
  MediaAssetSchema,
  PaginationSchema,
  ReactionSchema,
  CoordinatesSchema
};
