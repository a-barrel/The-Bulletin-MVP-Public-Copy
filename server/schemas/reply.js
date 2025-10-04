const { z } = require('zod');
const {
  MediaAssetSchema,
  ObjectIdSchema,
  ReactionSchema,
  IsoDateStringSchema,
  AuditMetadataSchema
} = require('./common');
const { PublicUserSchema } = require('./user');

const PinReplySchema = z.object({
  _id: ObjectIdSchema,
  pinId: ObjectIdSchema,
  parentReplyId: ObjectIdSchema.optional(),
  authorId: ObjectIdSchema,
  author: PublicUserSchema.optional(),
  message: z.string().max(4000),
  attachments: z.array(MediaAssetSchema).default([]),
  reactions: z.array(ReactionSchema).default([]),
  mentionedUserIds: z.array(ObjectIdSchema).default([]),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  audit: AuditMetadataSchema.optional()
});

const ReplyPayloadSchema = PinReplySchema.pick({
  pinId: true,
  parentReplyId: true,
  authorId: true,
  message: true,
  attachments: true,
  mentionedUserIds: true
});

module.exports = {
  PinReplySchema,
  ReplyPayloadSchema
};
