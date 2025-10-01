import { z } from 'zod';
import { IsoDateStringSchema, ObjectIdSchema } from './common.js';
import { PinPreviewSchema } from './pin.js';

export const UpdatePayloadSchema = z.object({
  type: z.enum([
    'new-pin',
    'pin-update',
    'event-starting-soon',
    'popular-pin',
    'bookmark-update',
    'system'
  ]),
  pin: PinPreviewSchema.optional(),
  title: z.string().min(1),
  body: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional()
});

export const UpdateSchema = z.object({
  _id: ObjectIdSchema,
  userId: ObjectIdSchema,
  payload: UpdatePayloadSchema,
  createdAt: IsoDateStringSchema,
  readAt: IsoDateStringSchema.optional()
});
