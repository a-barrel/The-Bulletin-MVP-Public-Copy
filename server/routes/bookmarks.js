const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const { Bookmark, BookmarkCollection } = require('../models/Bookmark');
const Pin = require('../models/Pin');
const User = require('../models/User');

const { BookmarkSchema, BookmarkCollectionSchema } = require('../schemas/bookmark');
const { PinPreviewSchema } = require('../schemas/pin');
const { PublicUserSchema } = require('../schemas/user');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const BookmarkQuerySchema = z.object({
  userId: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || mongoose.Types.ObjectId.isValid(value), {
      message: 'Invalid user id'
    }),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

const CollectionQuerySchema = z.object({
  userId: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || mongoose.Types.ObjectId.isValid(value), {
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

const toIsoDateString = (value) => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value.toISOString === 'function') return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const mapMediaAsset = (asset) => {
  if (!asset) {
    return undefined;
  }

  const doc = asset.toObject ? asset.toObject() : asset;
  if (!doc.url) {
    return undefined;
  }
  const result = {
    url: doc.url,
    thumbnailUrl: doc.thumbnailUrl || undefined,
    width: doc.width ?? undefined,
    height: doc.height ?? undefined,
    mimeType: doc.mimeType || undefined,
    description: doc.description || undefined,
    uploadedAt: toIsoDateString(doc.uploadedAt),
    uploadedBy: toIdString(doc.uploadedBy)
  };

  return Object.fromEntries(
    Object.entries(result).filter(([, value]) => value !== undefined && value !== null)
  );
};

const resolveViewerUser = async (req) => {
  if (!req?.user?.uid) {
    return null;
  }

  try {
    const viewer = await User.findOne({ firebaseUid: req.user.uid });
    return viewer;
  } catch (error) {
    console.error('Failed to resolve viewer user for bookmarks route:', error);
    return null;
  }
};

const CreateBookmarkSchema = z.object({
  pinId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid pin id'
  })
});

const PinParamSchema = z.object({
  pinId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid pin id'
  })
});

const mapUserToPublic = (user) => {
  if (!user) return undefined;
  const doc = user.toObject ? user.toObject() : user;
  return PublicUserSchema.parse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar: mapMediaAsset(doc.avatar),
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
    const viewer = await resolveViewerUser(req);
    if (!viewer && !query.userId) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserId = query.userId
      ? new mongoose.Types.ObjectId(query.userId)
      : viewer._id;

    const bookmarks = await Bookmark.find({ userId: targetUserId })
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
    const viewer = await resolveViewerUser(req);
    if (!viewer && !query.userId) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserId = query.userId
      ? new mongoose.Types.ObjectId(query.userId)
      : viewer._id;

    const collections = await BookmarkCollection.find({ userId: targetUserId }).sort({
      updatedAt: -1
    });

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

router.post('/', verifyToken, async (req, res) => {
  try {
    const { pinId } = CreateBookmarkSchema.parse(req.body);
    const viewer = await resolveViewerUser(req);

    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const pin = await Pin.findById(pinId);
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    const pinObjectId = pin._id;
    const userObjectId = viewer._id;

    const existingBookmark = await Bookmark.findOne({
      userId: userObjectId,
      pinId: pinObjectId
    });

    let createdBookmark = existingBookmark;
    let bookmarkCountIncrement = 0;

    if (!existingBookmark) {
      createdBookmark = await Bookmark.create({
        userId: userObjectId,
        pinId: pinObjectId,
        tagIds: []
      });

      pin.bookmarkCount = (pin.bookmarkCount ?? 0) + 1;
      if (pin.stats) {
        pin.stats.bookmarkCount = (pin.stats.bookmarkCount ?? 0) + 1;
      } else {
        pin.stats = {
          bookmarkCount: pin.bookmarkCount,
          replyCount: pin.replyCount ?? 0,
          shareCount: 0,
          viewCount: 0
        };
      }
      await pin.save();
      bookmarkCountIncrement = 1;
    }

    const bookmarkCount = pin.bookmarkCount ?? 0;

    res.status(existingBookmark ? 200 : 201).json({
      bookmarkId: toIdString(createdBookmark?._id),
      pinId: toIdString(pinObjectId),
      bookmarkCount,
      viewerHasBookmarked: true,
      alreadyBookmarked: Boolean(existingBookmark),
      bookmarkWasCreated: bookmarkCountIncrement === 1
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid bookmark payload', issues: error.errors });
    }
    console.error('Failed to create bookmark:', error);
    res.status(500).json({ message: 'Failed to create bookmark' });
  }
});

router.delete('/:pinId', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinParamSchema.parse(req.params);
    const viewer = await resolveViewerUser(req);

    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userObjectId = viewer._id;
    const pinObjectId = new mongoose.Types.ObjectId(pinId);

    const bookmark = await Bookmark.findOneAndDelete({
      userId: userObjectId,
      pinId: pinObjectId
    });

    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found for this pin' });
    }

    const pin = await Pin.findById(pinObjectId);
    let bookmarkCount = 0;

    if (pin) {
      const currentCount = pin.bookmarkCount ?? 0;
      pin.bookmarkCount = Math.max(0, currentCount - 1);
      if (pin.stats) {
        const currentStatCount = pin.stats.bookmarkCount ?? 0;
        pin.stats.bookmarkCount = Math.max(0, currentStatCount - 1);
      }
      await pin.save();
      bookmarkCount = pin.bookmarkCount ?? 0;
    }

    res.json({
      removed: true,
      pinId: toIdString(pinObjectId),
      bookmarkCount,
      viewerHasBookmarked: false
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid bookmark identifier', issues: error.errors });
    }
    console.error('Failed to remove bookmark:', error);
    res.status(500).json({ message: 'Failed to remove bookmark' });
  }
});

module.exports = router;
