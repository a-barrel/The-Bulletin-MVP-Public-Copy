import { z } from 'zod';
import { GeoPointSchema, IsoDateStringSchema, MediaAssetSchema, ObjectIdSchema } from './common.js';
import { PublicUserSchema } from './user.js';

export const ProximityChatRoomSchema = z.object({
  _id: ObjectIdSchema,
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  coordinates: GeoPointSchema,
  radiusMeters: z.number().int().positive(),
  participantCount: z.number().int().nonnegative().default(0),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema
});

export const ProximityChatMessageSchema = z.object({
  _id: ObjectIdSchema,
  roomId: ObjectIdSchema,
  author: PublicUserSchema,
  message: z.string().max(2000),
  coordinates: GeoPointSchema.optional(),
  attachments: z.array(MediaAssetSchema).default([]),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema
});

export const ProximityChatPresenceSchema = z.object({
  roomId: ObjectIdSchema,
  userId: ObjectIdSchema,
  joinedAt: IsoDateStringSchema,
  lastActiveAt: IsoDateStringSchema
});
