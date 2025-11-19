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
const { broadcastBookmarkCreated } = require('../services/updateFanoutService');
const { grantBadge } = require('../services/badgeService');
const { mapMediaAsset } = require('../utils/media');
const { toIdString, mapIdList } = require('../utils/ids');
const { toIsoDateString } = require('../utils/dates');
const { canViewerModeratePins } = require('../utils/moderation');

const router = express.Router();

const parseOptionalBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const BookmarkQuerySchema = z.object({
  userId: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || mongoose.Types.ObjectId.isValid(value), {
      message: 'Invalid user id'
    }),
  limit: z.coerce.number().int().positive().max(100).default(50),
  hideFullEvents: z
    .union([z.boolean(), z.string(), z.number()])
    .optional()
    .transform(parseOptionalBoolean)
});

const ExportQuerySchema = z.object({
  userId: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || mongoose.Types.ObjectId.isValid(value), {
      message: 'Invalid user id'
    })
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

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (stringValue === '') {
    return '';
  }

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const ensureUserStatsShape = (user) => {
  if (!user) {
    return;
  }

  if (!user.stats) {
    user.stats = {
      eventsHosted: 0,
      eventsAttended: 0,
      posts: 0,
      bookmarks: 0,
      followers: 0,
      following: 0
    };
    return;
  }

  user.stats.eventsHosted = user.stats.eventsHosted ?? 0;
  user.stats.eventsAttended = user.stats.eventsAttended ?? 0;
  user.stats.posts = user.stats.posts ?? 0;
  user.stats.bookmarks = user.stats.bookmarks ?? 0;
  user.stats.followers = user.stats.followers ?? 0;
  user.stats.following = user.stats.following ?? 0;
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
    avatar: mapMediaAsset(doc.avatar, { toIdString }),
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
    tagIds: mapIdList(doc.tagIds),
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
    bookmarkIds: mapIdList(doc.bookmarkIds),
    followerIds: mapIdList(doc.followerIds),
    createdAt: collectionDoc.createdAt.toISOString(),
    updatedAt: collectionDoc.updatedAt.toISOString(),
    bookmarks
  });
};

const buildBlockedSet = (user) => new Set(mapIdList(user?.relationships?.blockedUserIds));

const isPinAtCapacity = (pinDoc) => {
  if (!pinDoc || pinDoc.type !== 'event') {
    return false;
  }
  const limit =
    typeof pinDoc.participantLimit === 'number' && pinDoc.participantLimit > 0
      ? pinDoc.participantLimit
      : null;
  if (!limit) {
    return false;
  }
  const explicitCount =
    typeof pinDoc.participantCount === 'number' ? pinDoc.participantCount : null;
  const attendeeListCount = Array.isArray(pinDoc.attendingUserIds)
    ? pinDoc.attendingUserIds.length
    : null;
  const count = explicitCount ?? attendeeListCount ?? 0;
  return count >= limit;
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

    const hideFullEvents = query.hideFullEvents !== false;
    const viewerIsPrivileged = viewer ? canViewerModeratePins(viewer) : false;
    const bookmarks = await Bookmark.find({ userId: targetUserId })
      .sort({ createdAt: -1 })
      .limit(query.limit)
      .populate({ path: 'pinId', populate: { path: 'creatorId' } });

    const viewerBlockedSet = viewer ? buildBlockedSet(viewer) : new Set();
    const viewerId = viewer ? toIdString(viewer._id) : null;

    const filteredBookmarks = bookmarks.filter((bookmark) => {
      const creatorDoc = bookmark?.pinId?.creatorId;
      if (!creatorDoc) {
        return !(hideFullEvents && !viewerIsPrivileged && isPinAtCapacity(bookmark.pinId));
      }
      const creatorId = toIdString(creatorDoc._id ?? creatorDoc);
      if (creatorId && viewerBlockedSet.has(creatorId)) {
        return false;
      }
      if (viewerId) {
        const creatorBlockedSet = buildBlockedSet(creatorDoc);
        if (creatorBlockedSet.has(viewerId)) {
          return false;
        }
      }
      if (hideFullEvents && !viewerIsPrivileged && isPinAtCapacity(bookmark.pinId)) {
        return false;
      }
      return true;
    });

    const payload = filteredBookmarks.map((bookmark) => {
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

router.get('/history', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }
    const historyEntries = Array.isArray(viewer.viewHistory) ? viewer.viewHistory : [];
    if (!historyEntries.length) {
      return res.json([]);
    }

    const pinIds = historyEntries
      .map((entry) => entry?.pinId)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const pins = await Pin.find({ _id: { $in: pinIds } }).populate({
      path: 'creatorId'
    });
    const pinMap = new Map(pins.map((pinDoc) => [toIdString(pinDoc._id), pinDoc]));

    const payload = historyEntries
      .map((entry) => {
        if (!entry?.pinId) {
          return null;
        }
        const pinIdString = toIdString(entry.pinId);
        if (!pinIdString) {
          return null;
        }
        const pinDoc = pinMap.get(pinIdString);
        if (!pinDoc) {
          return null;
        }

        return {
          pinId: pinIdString,
          viewedAt: entry.viewedAt ? new Date(entry.viewedAt).toISOString() : new Date().toISOString(),
          pin: mapPinToPreview(pinDoc)
        };
      })
      .filter(Boolean);

    res.json(payload);
  } catch (error) {
    console.error('Failed to load bookmark history:', error);
    res.status(500).json({ message: 'Failed to load bookmark history' });
  }
});

router.delete('/history', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }
    await User.updateOne({ _id: viewer._id }, { $set: { viewHistory: [] } });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to clear bookmark history:', error);
    res.status(500).json({ message: 'Failed to clear bookmark history' });
  }
});

router.get('/export', verifyToken, async (req, res) => {
  try {
    const query = ExportQuerySchema.parse(req.query);
    const viewer = await resolveViewerUser(req);
    if (!viewer && !query.userId) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserId = query.userId
      ? new mongoose.Types.ObjectId(query.userId)
      : viewer._id;

    const bookmarks = await Bookmark.find({ userId: targetUserId })
      .sort({ createdAt: -1 })
      .populate({ path: 'pinId', populate: { path: 'creatorId' } });

    const viewerBlockedSet = viewer ? buildBlockedSet(viewer) : new Set();
    const viewerId = viewer ? toIdString(viewer._id) : null;

    const filteredBookmarks = bookmarks.filter((bookmark) => {
      const creatorDoc = bookmark?.pinId?.creatorId;
      if (!creatorDoc) {
        return true;
      }
      const creatorId = toIdString(creatorDoc._id ?? creatorDoc);
      if (creatorId && viewerBlockedSet.has(creatorId)) {
        return false;
      }
      if (viewerId) {
        const creatorBlockedSet = buildBlockedSet(creatorDoc);
        if (creatorBlockedSet.has(viewerId)) {
          return false;
        }
      }
      return true;
    });

    const header = [
      'Bookmark ID',
      'Saved At',
      'Pin ID',
      'Pin Title',
      'Pin Type',
      'Pin Creator',
      'Pin Creator ID',
      'Notes',
      'Reminder At',
      'Collection ID'
    ];

    const rows = filteredBookmarks.map((bookmark) => {
      const pinPreview = mapPinToPreview(bookmark.pinId);
      const creator = pinPreview?.creator;
      const creatorName =
        creator?.displayName || creator?.username || '';

      return [
        toIdString(bookmark._id),
        bookmark.createdAt.toISOString(),
        pinPreview?._id ?? '',
        pinPreview?.title ?? '',
        pinPreview?.type ?? '',
        creatorName ?? '',
        creator?._id ?? '',
        bookmark.notes ?? '',
        bookmark.reminderAt ? bookmark.reminderAt.toISOString() : '',
        toIdString(bookmark.collectionId) ?? ''
      ];
    });

    const csvLines = [
      header.map(escapeCsvValue).join(','),
      ...rows.map((row) => row.map(escapeCsvValue).join(','))
    ].join('\r\n');

    const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ownerId = query.userId || toIdString(viewer?._id) || 'bookmarks';
    const filename = `bookmarks-${ownerId}-${safeTimestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\ufeff${csvLines}`);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid bookmark export query', issues: error.errors });
    }
    console.error('Failed to export bookmarks:', error);
    res.status(500).json({ message: 'Failed to export bookmarks' });
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

    const pin = await Pin.findById(pinId).populate('creatorId');
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
    let bookmarkBadgeResult = null;

    if (!existingBookmark) {
      createdBookmark = await Bookmark.create({
        userId: userObjectId,
        pinId: pinObjectId,
        tagIds: []
      });

      ensureUserStatsShape(viewer);
      viewer.stats.bookmarks = (viewer.stats.bookmarks ?? 0) + 1;
      try {
        await viewer.save();
      } catch (error) {
        console.error('Failed to update user bookmark stats:', error);
      }
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

      broadcastBookmarkCreated({
        pin,
        bookmarker: viewer
      }).catch((error) => {
        console.error('Failed to queue bookmark updates:', error);
      });
    }

    const bookmarkCount = pin.bookmarkCount ?? 0;

    if (bookmarkCountIncrement === 1) {
      try {
        bookmarkBadgeResult = await grantBadge({
          userId: viewer._id,
          badgeId: 'bookmark-first-pin',
          sourceUserId: viewer._id
        });
      } catch (error) {
        console.error('Failed to grant bookmark badge:', error);
      }
    }

    res.status(existingBookmark ? 200 : 201).json({
      bookmarkId: toIdString(createdBookmark?._id),
      pinId: toIdString(pinObjectId),
      bookmarkCount,
      viewerHasBookmarked: true,
      alreadyBookmarked: Boolean(existingBookmark),
      bookmarkWasCreated: bookmarkCountIncrement === 1,
      badgeEarnedId: bookmarkBadgeResult?.granted ? bookmarkBadgeResult.badge.id : null
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
    const viewerId = toIdString(viewer._id);
    const pinObjectId = new mongoose.Types.ObjectId(pinId);

    const pin = await Pin.findById(pinObjectId, { creatorId: 1, attendingUserIds: 1, bookmarkCount: 1, stats: 1 });
    if (pin) {
      const pinCreatorId = toIdString(pin.creatorId);
      const ownsPin = Boolean(pinCreatorId && viewerId && pinCreatorId === viewerId);
      const isAttending =
        Array.isArray(pin.attendingUserIds) &&
        pin.attendingUserIds.some((attendeeId) => {
          try {
            return toIdString(attendeeId) === viewerId;
          } catch {
            return false;
          }
        });

      if (ownsPin) {
        return res.status(403).json({ message: 'Creators keep their pins bookmarked automatically.' });
      }

      if (isAttending) {
        return res.status(403).json({ message: 'Attendees keep these pins bookmarked automatically.' });
      }
    }

    const bookmark = await Bookmark.findOneAndDelete({
      userId: userObjectId,
      pinId: pinObjectId
    });

    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found for this pin' });
    }

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

    ensureUserStatsShape(viewer);
    viewer.stats.bookmarks = Math.max(0, (viewer.stats.bookmarks ?? 0) - 1);
    try {
      await viewer.save();
    } catch (error) {
      console.error('Failed to update user bookmark stats:', error);
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
