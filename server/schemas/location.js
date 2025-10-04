const { z } = require('zod');
const { GeoPointSchema, IsoDateStringSchema, ObjectIdSchema } = require('./common');

const LocationSourceSchema = z.enum(['web', 'ios', 'android', 'background']);

const LocationUpdateSchema = z.object({
  _id: ObjectIdSchema.optional(),
  userId: ObjectIdSchema,
  coordinates: GeoPointSchema,
  isPublic: z.boolean().default(true),
  accuracy: z.number().min(0).max(5000).optional(),
  altitudeMeters: z.number().optional(),
  speedMetersPerSecond: z.number().min(0).optional(),
  headingDegrees: z.number().min(0).max(360).optional(),
  sessionId: ObjectIdSchema.optional(),
  deviceId: ObjectIdSchema.optional(),
  source: LocationSourceSchema.default('web'),
  appVersion: z.string().optional(),
  createdAt: IsoDateStringSchema,
  lastSeenAt: IsoDateStringSchema.optional(),
  expiresAt: IsoDateStringSchema.optional(),
  linkedPinIds: z.array(ObjectIdSchema).default([])
});

const NearbyUserSchema = z.object({
  userId: ObjectIdSchema,
  coordinates: GeoPointSchema,
  distanceMeters: z.number().nonnegative(),
  lastSeenAt: IsoDateStringSchema,
  sessionId: ObjectIdSchema.optional(),
  source: LocationSourceSchema.optional(),
  linkedPinIds: z.array(ObjectIdSchema).default([])
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
  altitudeMeters: z.number().optional(),
  speedMetersPerSecond: z.number().min(0).optional(),
  headingDegrees: z.number().min(0).max(360).optional(),
  sessionId: ObjectIdSchema.optional(),
  deviceId: ObjectIdSchema.optional(),
  source: LocationSourceSchema.default('web'),
  appVersion: z.string().optional(),
  createdAt: IsoDateStringSchema.optional(),
  lastSeenAt: IsoDateStringSchema.optional(),
  expiresAt: IsoDateStringSchema.optional(),
  linkedPinIds: z.array(ObjectIdSchema).default([])
});

module.exports = {
  LocationSourceSchema,
  LocationUpdateSchema,
  NearbyUserSchema,
  LocationQuerySchema,
  LocationWriteSchema
};
