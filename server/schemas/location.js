const { z } = require('zod');
const { GeoPointSchema, IsoDateStringSchema, ObjectIdSchema } = require('./common');

const LocationUpdateSchema = z.object({
  _id: ObjectIdSchema.optional(),
  userId: ObjectIdSchema,
  coordinates: GeoPointSchema,
  isPublic: z.boolean().default(true),
  accuracy: z.number().min(0).max(5000).optional(),
  createdAt: IsoDateStringSchema,
  expiresAt: IsoDateStringSchema.optional()
});

const NearbyUserSchema = z.object({
  userId: ObjectIdSchema,
  coordinates: GeoPointSchema,
  distanceMeters: z.number().nonnegative(),
  lastSeenAt: IsoDateStringSchema
});

const LocationQuerySchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  maxDistance: z.number().int().positive().default(16093)
});

const LocationWriteSchema = z.object({
  userId: z.string().min(1),
  coordinates: GeoPointSchema,
  isPublic: z.boolean().default(true),
  accuracy: z.number().min(0).max(5000).optional(),
  createdAt: IsoDateStringSchema.optional(),
  lastSeenAt: IsoDateStringSchema.optional(),
  expiresAt: IsoDateStringSchema.optional()
});

module.exports = {
  LocationUpdateSchema,
  NearbyUserSchema,
  LocationQuerySchema,
  LocationWriteSchema
};
