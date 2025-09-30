import { z } from 'zod';
import { MediaAssetSchema, ObjectIdSchema, ReactionSchema, IsoDateStringSchema } from './common.js';
import { PublicUserSchema } from './user.js';

export const PinReplySchema = z.object({
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

export const ReplyPayloadSchema = PinReplySchema.pick({
  pinId: true,
  parentReplyId: true,
  message: true,
  attachments: true
});
