const { z } = require('zod');
const { MediaAssetSchema, ObjectIdSchema, ReactionSchema, IsoDateStringSchema } = require('./common');
const { PublicUserSchema } = require('./user');

const PinReplySchema = z.object({
  _id: ObjectIdSchema,
  pinId: ObjectIdSchema,
  parentReplyId: ObjectIdSchema.optional(),
  author: PublicUserSchema,
  message: z.string().max(4000),
  attachments: z.array(MediaAssetSchema).default([]),
  reactions: z.array(ReactionSchema).default([]),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema
});

const ReplyPayloadSchema = PinReplySchema.pick({
  pinId: true,
  parentReplyId: true,
  message: true,
  attachments: true
});

module.exports = {
  PinReplySchema,
  ReplyPayloadSchema
};
