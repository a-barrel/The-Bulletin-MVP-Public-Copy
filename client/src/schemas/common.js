import { z } from 'zod';

export const IsoDateStringSchema = z.string().datetime({ message: 'Expected ISO-8601 timestamp' });

export const ObjectIdSchema = z.string().min(1, 'Expected a MongoDB object id string');

export const TimestampSchema = z.object({
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema
});

export const GeoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90) // latitude
  ]),
  accuracy: z.number().min(0).max(5000).optional()
});

export const LocationBoundsSchema = z.object({
  center: GeoPointSchema,
  radiusMeters: z.number().int().positive()
});

export const AddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().trim().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(2),
  formatted: z.string().optional()
});

export const ApproximateAddressSchema = z.object({
  city: z.string().min(1),
  state: z.string().min(1).optional(),
  country: z.string().min(2).optional(),
  formatted: z.string().optional()
});

export const MediaAssetSchema = z.object({
  _id: ObjectIdSchema.optional(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  description: z.string().optional(),
  uploadedAt: IsoDateStringSchema.optional()
});

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  total: z.number().int().nonnegative().optional()
});

export const ReactionSchema = z.object({
  userId: ObjectIdSchema,
  type: z.enum(['like', 'interested', 'going', 'curious', 'flag']),
  reactedAt: IsoDateStringSchema
});

export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});
