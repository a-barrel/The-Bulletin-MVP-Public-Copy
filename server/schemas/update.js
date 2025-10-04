const { z } = require('zod');
const { IsoDateStringSchema, ObjectIdSchema, EntityReferenceSchema } = require('./common');
const { PinPreviewSchema } = require('./pin');

const UpdatePayloadSchema = z.object({
  type: z.enum([
    'new-pin',
    'pin-update',
    'event-starting-soon',
    'popular-pin',
    'bookmark-update',
    'system',
    'chat-message',
    'friend-request'
  ]),
  pin: PinPreviewSchema.optional(),
  title: z.string().min(1),
  body: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
  relatedEntities: z.array(EntityReferenceSchema).default([])
});

const UpdateSchema = z.object({
  _id: ObjectIdSchema,
  userId: ObjectIdSchema,
  sourceUserId: ObjectIdSchema.optional(),
  targetUserIds: z.array(ObjectIdSchema).default([]),
  payload: UpdatePayloadSchema,
  createdAt: IsoDateStringSchema,
  deliveredAt: IsoDateStringSchema.optional(),
  readAt: IsoDateStringSchema.optional()
});

module.exports = {
  UpdatePayloadSchema,
  UpdateSchema
};
