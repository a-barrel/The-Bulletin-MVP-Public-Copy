const { z } = require('zod');
const { IsoDateStringSchema, ObjectIdSchema } = require('./common');
const { PinPreviewSchema } = require('./pin');

const BookmarkSchema = z.object({
  _id: ObjectIdSchema,
  userId: ObjectIdSchema,
  pinId: ObjectIdSchema,
  createdAt: IsoDateStringSchema,
  notes: z.string().max(500).optional(),
  reminderAt: IsoDateStringSchema.optional(),
  pin: PinPreviewSchema.optional()
});

const BookmarkCollectionSchema = z.object({
  _id: ObjectIdSchema,
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  userId: ObjectIdSchema,
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  bookmarks: z.array(BookmarkSchema).default([])
});

module.exports = {
  BookmarkSchema,
  BookmarkCollectionSchema
};
