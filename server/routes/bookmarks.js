const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const { Bookmark, BookmarkCollection } = require('../models/Bookmark');

const { BookmarkSchema, BookmarkCollectionSchema } = require('../schemas/bookmark');
const { PinPreviewSchema } = require('../schemas/pin');
const { PublicUserSchema } = require('../schemas/user');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const BookmarkQuerySchema = z.object({
  userId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid user id'
  }),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

const CollectionQuerySchema = z.object({
  userId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid user id'
  })
});

const toIdString = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value._id) return value._id.toString();
  return String(value);
};

const mapUserToPublic = (user) => {
  if (!user) return undefined;
  const doc = user.toObject ? user.toObject() : user;
  return PublicUserSchema.parse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar: doc.avatar || undefined,
    stats: doc.stats || undefined,
    badges: doc.badges || [],
    primaryLocationId: toIdString(doc.primaryLocationId),
    accountStatus: doc.accountStatus || 'active'
  });
};

const mapPinToPreview = (pinDoc) => {
  if (!pinDoc) return undefined;
  const doc = pinDoc.toObject();
  return PinPreviewSchema.parse({
    _id: toIdString(doc._id),
    type: doc.type,
    creatorId: toIdString(doc.creatorId),
    creator: mapUserToPublic(doc.creatorId),
    title: doc.title,
    coordinates: {
      type: 'Point',
      coordinates: doc.coordinates.coordinates,
      accuracy: doc.coordinates.accuracy ?? undefined
    },
    proximityRadiusMeters: doc.proximityRadiusMeters,
    linkedLocationId: toIdString(doc.linkedLocationId),
    linkedChatRoomId: toIdString(doc.linkedChatRoomId),
    startDate: doc.startDate ? doc.startDate.toISOString() : undefined,
    endDate: doc.endDate ? doc.endDate.toISOString() : undefined,
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : undefined
  });
};

const buildAudit = (audit, createdAt, updatedAt) => ({
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
  createdBy: audit?.createdBy ? toIdString(audit.createdBy) : undefined,
  updatedBy: audit?.updatedBy ? toIdString(audit.updatedBy) : undefined
});

const mapBookmark = (bookmarkDoc, pinPreview) => {
  const doc = bookmarkDoc.toObject();
  return BookmarkSchema.parse({
    _id: toIdString(doc._id),
    userId: toIdString(doc.userId),
    pinId: toIdString(doc.pinId),
    collectionId: toIdString(doc.collectionId),
    createdAt: bookmarkDoc.createdAt.toISOString(),
    notes: doc.notes || undefined,
    reminderAt: doc.reminderAt ? doc.reminderAt.toISOString() : undefined,
    tagIds: (doc.tagIds || []).map(toIdString),
    pin: pinPreview,
    audit: buildAudit(doc.audit, bookmarkDoc.createdAt, bookmarkDoc.updatedAt)
  });
};

const mapCollection = (collectionDoc, bookmarks) => {
  const doc = collectionDoc.toObject();
  return BookmarkCollectionSchema.parse({
    _id: toIdString(doc._id),
    name: doc.name,
    description: doc.description || undefined,
    userId: toIdString(doc.userId),
    bookmarkIds: (doc.bookmarkIds || []).map(toIdString),
    followerIds: (doc.followerIds || []).map(toIdString),
    createdAt: collectionDoc.createdAt.toISOString(),
    updatedAt: collectionDoc.updatedAt.toISOString(),
    bookmarks
  });
};

router.get('/', verifyToken, async (req, res) => {
  try {
    const query = BookmarkQuerySchema.parse(req.query);
    const bookmarks = await Bookmark.find({ userId: query.userId })
      .sort({ createdAt: -1 })
      .limit(query.limit)
      .populate({ path: 'pinId', populate: { path: 'creatorId' } });

    const payload = bookmarks.map((bookmark) => {
      const pinPreview = mapPinToPreview(bookmark.pinId);
      return mapBookmark(bookmark, pinPreview);
    });

    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid bookmark query', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load bookmarks' });
  }
});

router.get('/collections', verifyToken, async (req, res) => {
  try {
    const query = CollectionQuerySchema.parse(req.query);
    const collections = await BookmarkCollection.find({ userId: query.userId }).sort({ updatedAt: -1 });

    const bookmarkIds = collections.flatMap((collection) => collection.bookmarkIds || []);
    const bookmarks = await Bookmark.find({ _id: { $in: bookmarkIds } }).populate({
      path: 'pinId',
      populate: { path: 'creatorId' }
    });
    const bookmarksById = new Map(bookmarks.map((bookmark) => [bookmark._id.toString(), bookmark]));

    const payload = collections.map((collection) => {
      const items = (collection.bookmarkIds || []).map((bookmarkId) => {
        const bookmark = bookmarksById.get(bookmarkId.toString());
        if (!bookmark) return undefined;
        return mapBookmark(bookmark, mapPinToPreview(bookmark.pinId));
      }).filter(Boolean);

      return mapCollection(collection, items);
    });

    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid collection query', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load bookmark collections' });
  }
});

module.exports = router;
