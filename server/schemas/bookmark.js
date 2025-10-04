const { z } = require('zod');
const { IsoDateStringSchema, ObjectIdSchema, AuditMetadataSchema } = require('./common');
const { PinPreviewSchema } = require('./pin');

const BookmarkSchema = z.object({
  _id: ObjectIdSchema,
  userId: ObjectIdSchema,
  pinId: ObjectIdSchema,
  collectionId: ObjectIdSchema.optional(),
  createdAt: IsoDateStringSchema,
  notes: z.string().max(500).optional(),
  reminderAt: IsoDateStringSchema.optional(),
  tagIds: z.array(ObjectIdSchema).default([]),
  pin: PinPreviewSchema.optional(),
  audit: AuditMetadataSchema.optional()
});

const BookmarkCollectionSchema = z.object({
  _id: ObjectIdSchema,
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  userId: ObjectIdSchema,
  bookmarkIds: z.array(ObjectIdSchema).default([]),
  followerIds: z.array(ObjectIdSchema).default([]),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
  bookmarks: z.array(BookmarkSchema).default([])
});

module.exports = {
  BookmarkSchema,
  BookmarkCollectionSchema
};
