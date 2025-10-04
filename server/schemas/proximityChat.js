const { z } = require('zod');
const {
  GeoPointSchema,
  IsoDateStringSchema,
  MediaAssetSchema,
  ObjectIdSchema,
  AuditMetadataSchema
} = require('./common');
const { PublicUserSchema } = require('./user');

const ProximityChatRoomSchema = z.object({
  _id: ObjectIdSchema,
  ownerId: ObjectIdSchema,
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  coordinates: GeoPointSchema,
  radiusMeters: z.number().int().positive(),
  participantCount: z.number().int().nonnegative().default(0),
  participantIds: z.array(ObjectIdSchema).default([]),
  moderatorIds: z.array(ObjectIdSchema).default([]),
  pinId: ObjectIdSchema.optional(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  audit: AuditMetadataSchema.optional()
});

const ProximityChatMessageSchema = z.object({
  _id: ObjectIdSchema,
  roomId: ObjectIdSchema,
  pinId: ObjectIdSchema.optional(),
  authorId: ObjectIdSchema,
  author: PublicUserSchema.optional(),
  replyToMessageId: ObjectIdSchema.optional(),
  message: z.string().max(2000),
  coordinates: GeoPointSchema.optional(),
  attachments: z.array(MediaAssetSchema).default([]),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  audit: AuditMetadataSchema.optional()
});

const ProximityChatPresenceSchema = z.object({
  roomId: ObjectIdSchema,
  userId: ObjectIdSchema,
  sessionId: ObjectIdSchema.optional(),
  joinedAt: IsoDateStringSchema,
  lastActiveAt: IsoDateStringSchema
});

module.exports = {
  ProximityChatRoomSchema,
  ProximityChatMessageSchema,
  ProximityChatPresenceSchema
};
