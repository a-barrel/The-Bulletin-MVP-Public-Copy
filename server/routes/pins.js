const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const Pin = require('../models/Pin');
const User = require('../models/User');
const Reply = require('../models/Reply');
const { Bookmark } = require('../models/Bookmark');
const { PinListItemSchema, PinSchema, PinPreviewSchema } = require('../schemas/pin');
const { PinReplySchema } = require('../schemas/reply');
const { PublicUserSchema } = require('../schemas/user');
const verifyToken = require('../middleware/verifyToken');
const {
  broadcastPinCreated,
  broadcastPinUpdated,
  broadcastPinReply,
  broadcastAttendanceChange,
  broadcastBookmarkCreated
} = require('../services/updateFanoutService');
const { grantBadge } = require('../services/badgeService');
const { trackEvent } = require('../services/analyticsService');
const { mapMediaAsset: mapMediaAssetResponse } = require('../utils/media');
const { toIdString, mapIdList } = require('../utils/ids');
const { METERS_PER_MILE, milesToMeters } = require('../utils/geo');
const { timeAsync } = require('../utils/devLogger');

const router = express.Router();

const PinsQuerySchema = z.object({
  type: z.enum(['event', 'discussion']).optional(),
  creatorId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z.enum(['active', 'expired', 'all']).optional(),
  sort: z.enum(['recent', 'distance', 'expiration']).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  search: z.string().trim().optional(),
  categories: z.string().trim().optional(),
  types: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional()
});

const PinIdSchema = z.object({
  pinId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid pin id'
  })
});

const SharePinSchema = z.object({
  platform: z.string().trim().max(64).optional(),
  method: z.string().trim().max(64).optional()
});

const AttendanceUpdateSchema = z.object({
  attending: z.boolean()
});

const CreateReplySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message must be 4000 characters or fewer'),
  parentReplyId: z
    .string()
    .trim()
    .refine((value) => !value || mongoose.Types.ObjectId.isValid(value), {
      message: 'Invalid parent reply id'
    })
    .optional()
});

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const EVENT_MAX_LEAD_TIME_MS = 14 * MILLISECONDS_PER_DAY;
const DISCUSSION_MAX_DURATION_MS = 3 * MILLISECONDS_PER_DAY;
const PAST_TOLERANCE_MS = 60 * 1000;

const mapUserToPublic = (user) => {
  if (!user) return undefined;
  const doc = user.toObject ? user.toObject() : user;
  const avatar = doc.avatar ? mapMediaAssetResponse(doc.avatar, { toIdString }) : undefined;
  return PublicUserSchema.parse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar,
    stats: doc.stats || undefined,
    badges: doc.badges || [],
    primaryLocationId: toIdString(doc.primaryLocationId),
    accountStatus: doc.accountStatus || 'active'
  });
};

const mapPinPreview = (pinDoc, creator) => {
  const doc = pinDoc.toObject();
  return PinPreviewSchema.parse({
    _id: toIdString(doc._id),
    type: doc.type,
    creatorId: toIdString(doc.creatorId),
    creator,
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

const mapPinOptions = (optionsDoc) => {
  if (!optionsDoc) {
    return undefined;
  }
  if (typeof optionsDoc.toObject === 'function') {
    return optionsDoc.toObject();
  }
  if (typeof optionsDoc === 'object') {
    return { ...optionsDoc };
  }
  return undefined;
};

const mapPinToListItem = (pinDoc, creator, options = {}) => {
  const preview = mapPinPreview(pinDoc, creator);
  const coverPhoto = pinDoc.coverPhoto
    ? mapMediaAssetResponse(pinDoc.coverPhoto, { toIdString })
    : undefined;
  const photos = Array.isArray(pinDoc.photos)
    ? pinDoc.photos
        .map((photo) => mapMediaAssetResponse(photo, { toIdString }))
        .filter(Boolean)
    : undefined;

  const viewerHasBookmarked =
    typeof options.viewerHasBookmarked === 'boolean' ? options.viewerHasBookmarked : undefined;
  const viewerIsAttending =
    typeof options.viewerIsAttending === 'boolean' ? options.viewerIsAttending : undefined;
  const viewerOwnsPin =
    typeof options.viewerOwnsPin === 'boolean' ? options.viewerOwnsPin : undefined;

  return PinListItemSchema.parse({
    ...preview,
    distanceMeters: undefined,
    isBookmarked: viewerHasBookmarked,
    viewerHasBookmarked,
    viewerIsAttending,
    viewerOwnsPin,
    replyCount: pinDoc.replyCount ?? undefined,
    stats: pinDoc.stats || undefined,
    options: mapPinOptions(pinDoc.options),
    coverPhoto,
    photos
  });
};

const ensureUserStats = (userDoc) => {
  if (!userDoc) {
    return null;
  }

  if (!userDoc.stats) {
    userDoc.stats = {
      eventsHosted: 0,
      eventsAttended: 0,
      posts: 0,
      bookmarks: 0,
      followers: 0,
      following: 0
    };
  }

  return userDoc.stats;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseCsvParam = (value) => {
  if (!value || typeof value !== 'string') {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parseDateParam = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const USER_SUMMARY_PROJECTION =
  'username displayName roles accountStatus avatar stats relationships.blockedUserIds';

const buildBlockedSet = (userDoc) => new Set(mapIdList(userDoc?.relationships?.blockedUserIds));

const isBlockedBetweenUsers = (viewer, target) => {
  if (!viewer || !target) {
    return false;
  }
  const viewerId = toIdString(viewer._id ?? viewer);
  const targetId = toIdString(target._id ?? target);
  if (!viewerId || !targetId) {
    return false;
  }
  const viewerBlocked = buildBlockedSet(viewer);
  if (viewerBlocked.has(targetId)) {
    return true;
  }
  const targetBlocked = buildBlockedSet(target);
  return targetBlocked.has(viewerId);
};

const ensureBookmarkForUser = async ({ userDoc, pinDoc }) => {
  if (!userDoc?._id || !pinDoc?._id) {
    return {
      created: false,
      bookmark: null,
      pin: pinDoc,
      bookmarkCount: pinDoc?.bookmarkCount ?? 0
    };
  }

  const userId = userDoc._id;
  const pinId = pinDoc._id;

  try {
    const existing = await Bookmark.findOne({ userId, pinId });
    if (existing) {
      return {
        created: false,
        bookmark: existing,
        pin: pinDoc,
        bookmarkCount: pinDoc.bookmarkCount ?? 0
      };
    }

    let bookmark;
    try {
      bookmark = await Bookmark.create({
        userId,
        pinId,
        tagIds: []
      });
    } catch (error) {
      if (error?.code === 11000 || error?.code === 11001) {
        const duplicate = await Bookmark.findOne({ userId, pinId });
        return {
          created: false,
          bookmark: duplicate,
          pin: pinDoc,
          bookmarkCount: pinDoc.bookmarkCount ?? 0
        };
      }
      throw error;
    }

    try {
      ensureUserStats(userDoc);
      userDoc.stats.bookmarks = (userDoc.stats.bookmarks ?? 0) + 1;
      userDoc.markModified('stats');
      await userDoc.save();
    } catch (error) {
      console.error('Failed to update user bookmark stats during ensureBookmarkForUser:', error);
    }

    try {
      const currentBookmarkCount = pinDoc.bookmarkCount ?? 0;
      pinDoc.bookmarkCount = currentBookmarkCount + 1;
      if (pinDoc.stats) {
        pinDoc.stats.bookmarkCount = (pinDoc.stats.bookmarkCount ?? 0) + 1;
      } else {
        pinDoc.stats = {
          bookmarkCount: pinDoc.bookmarkCount,
          replyCount: pinDoc.replyCount ?? 0,
          shareCount: 0,
          viewCount: 0
        };
      }
      pinDoc.markModified('stats');
      await pinDoc.save();
    } catch (error) {
      console.error('Failed to update pin bookmark stats during ensureBookmarkForUser:', error);
    }

    return {
      created: true,
      bookmark,
      pin: pinDoc,
      bookmarkCount: pinDoc.bookmarkCount ?? 0
    };
  } catch (error) {
    console.error('Failed to ensure bookmark for user:', error);
    return {
      created: false,
      bookmark: null,
      pin: pinDoc,
      bookmarkCount: pinDoc?.bookmarkCount ?? 0,
      error
    };
  }
};

const resolveViewerUser = async (req) => {
  if (!req?.user?.uid) {
    return null;
  }

  try {
    const viewer = await User.findOne({ firebaseUid: req.user.uid });
    return viewer;
  } catch (error) {
    console.error('Failed to resolve viewer user for request:', error);
    return null;
  }
};

const mapPinToFull = (pinDoc, creator, options = {}) => {
  const doc = pinDoc.toObject();
  const base = {
    _id: toIdString(doc._id),
    type: doc.type,
    creatorId: toIdString(doc.creatorId),
    creator,
    title: doc.title,
    description: doc.description,
    coordinates: {
      type: 'Point',
      coordinates: doc.coordinates.coordinates,
      accuracy: doc.coordinates.accuracy ?? undefined
    },
    proximityRadiusMeters: doc.proximityRadiusMeters,
    photos: Array.isArray(doc.photos)
      ? doc.photos.map((photo) => mapMediaAssetResponse(photo, { toIdString }))
      : [],
    coverPhoto: mapMediaAssetResponse(doc.coverPhoto, { toIdString }),
    tagIds: mapIdList(doc.tagIds),
    tags: doc.tags || [],
    relatedPinIds: mapIdList(doc.relatedPinIds),
    linkedLocationId: toIdString(doc.linkedLocationId),
    linkedChatRoomId: toIdString(doc.linkedChatRoomId),
    visibility: doc.visibility,
    isActive: doc.isActive,
    stats: doc.stats || undefined,
    options: mapPinOptions(doc.options),
    bookmarkCount: doc.bookmarkCount ?? 0,
    replyCount: doc.replyCount ?? 0,
    createdAt: pinDoc.createdAt.toISOString(),
    updatedAt: pinDoc.updatedAt.toISOString(),
    audit: undefined
  };

  if (doc.type === 'event') {
    base.startDate = doc.startDate ? doc.startDate.toISOString() : undefined;
    base.endDate = doc.endDate ? doc.endDate.toISOString() : undefined;
    base.address = doc.address
      ? {
          precise: doc.address.precise,
          components: doc.address.components || undefined
        }
      : undefined;
    base.participantCount = doc.participantCount ?? 0;
    base.participantLimit = doc.participantLimit ?? undefined;
    base.attendingUserIds = mapIdList(doc.attendingUserIds);
    base.attendeeWaitlistIds = mapIdList(doc.attendeeWaitlistIds);
    base.attendable = doc.attendable ?? true;
    if (options.viewerId) {
      const viewerId = options.viewerId;
      base.viewerIsAttending = base.attendingUserIds.some((id) => id === viewerId);
    }
  }

  if (doc.type === 'discussion') {
    base.approximateAddress = doc.approximateAddress || undefined;
    base.expiresAt = doc.expiresAt ? doc.expiresAt.toISOString() : undefined;
    base.autoDelete = doc.autoDelete ?? true;
  }

  if (typeof options.viewerHasBookmarked === 'boolean') {
    base.viewerHasBookmarked = options.viewerHasBookmarked;
  }

  if (typeof options.viewerDistanceMeters === 'number' && Number.isFinite(options.viewerDistanceMeters)) {
    base.viewerDistanceMeters = options.viewerDistanceMeters;
  }

  if (typeof options.viewerWithinInteractionRadius === 'boolean') {
    base.viewerWithinInteractionRadius = options.viewerWithinInteractionRadius;
  }

  if (typeof options.viewerInteractionLockReason === 'string' && options.viewerInteractionLockReason.trim()) {
    base.viewerInteractionLockReason = options.viewerInteractionLockReason.trim();
  }

  if (typeof options.viewerInteractionLockMessage === 'string' && options.viewerInteractionLockMessage.trim()) {
    base.viewerInteractionLockMessage = options.viewerInteractionLockMessage.trim();
  }

  return PinSchema.parse(base);
};

const buildAudit = (audit, createdAt, updatedAt) => ({
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
  createdBy: audit?.createdBy ? toIdString(audit.createdBy) : undefined,
  updatedBy: audit?.updatedBy ? toIdString(audit.updatedBy) : undefined
});

const mapReply = (replyDoc, author) => {
  const doc = replyDoc.toObject();
  return PinReplySchema.parse({
    _id: toIdString(doc._id),
    pinId: toIdString(doc.pinId),
    parentReplyId: toIdString(doc.parentReplyId),
    authorId: toIdString(doc.authorId),
    author,
    message: doc.message,
    attachments: doc.attachments || [],
    reactions: (doc.reactions || []).map((reaction) => ({
      userId: toIdString(reaction.userId),
      type: reaction.type,
      reactedAt: (reaction.reactedAt || replyDoc.createdAt).toISOString()
    })),
    mentionedUserIds: mapIdList(doc.mentionedUserIds),
    createdAt: replyDoc.createdAt.toISOString(),
    updatedAt: replyDoc.updatedAt.toISOString(),
    audit: doc.audit ? buildAudit(doc.audit, replyDoc.createdAt, replyDoc.updatedAt) : undefined
  });
};

const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

const MediaAssetInputSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  description: z.string().optional()
});

const PinOptionsInputSchema = z
  .object({
    allowBookmarks: z.boolean().optional(),
    allowShares: z.boolean().optional(),
    allowReplies: z.boolean().optional(),
    showAttendeeList: z.boolean().optional(),
    featured: z.boolean().optional(),
    visibilityMode: z.enum(['map-only', 'list-only', 'map-and-list']).optional(),
    reminderMinutesBefore: z.number().int().nonnegative().max(10080).optional(),
    contentAdvisory: z.string().trim().max(140).optional(),
    highlightColor: z
      .string()
      .trim()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
      .optional()
  })
  .strict();

const normaliseMediaAsset = (asset, uploadedBy) => ({
  url: asset.url,
  width: asset.width,
  height: asset.height,
  mimeType: asset.mimeType ?? 'image/jpeg',
  description: asset.description,
  uploadedAt: new Date(),
  uploadedBy
});

const NearbyPinsQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  distanceMiles: z.coerce.number().positive().max(250),
  limit: z.coerce.number().int().positive().max(50).default(20),
  type: z.enum(['event', 'discussion']).optional(),
  types: z.string().trim().optional(),
  search: z.string().trim().optional(),
  categories: z.string().trim().optional(),
  status: z.enum(['active', 'expired', 'all']).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  friendEngagements: z.string().trim().optional()
});

const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

const BaseCreatePinSchema = z.object({
  type: z.enum(['event', 'discussion']),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(4000),
  coordinates: CoordinatesSchema,
  proximityRadiusMeters: z.number().int().positive().max(50000).optional(),
  creatorId: z.string().optional(),
  photos: z.array(MediaAssetInputSchema).max(3).optional(),
  coverPhoto: MediaAssetInputSchema.optional(),
  options: PinOptionsInputSchema.optional()
});

const EventAddressComponentsSchema = z
  .object({
    line1: z.string().trim().min(1),
    line2: z.string().trim().optional(),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1),
    postalCode: z.string().trim().min(1),
    country: z.string().trim().min(2)
  })
  .partial()
  .refine(
    (components) => Object.values(components).some((value) => value !== undefined),
    'Address components must include at least one field'
  );

const EventAddressSchema = z.object({
  precise: z.string().trim().min(1),
  components: EventAddressComponentsSchema.optional()
});

const EventPinCreateSchema = BaseCreatePinSchema.extend({
  type: z.literal('event'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  address: EventAddressSchema.optional()
});

const ApproximateAddressInputSchema = z.object({
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  formatted: z.string().trim().optional()
});

const DiscussionPinCreateSchema = BaseCreatePinSchema.extend({
  type: z.literal('discussion'),
  expiresAt: z.coerce.date(),
  autoDelete: z.boolean().optional(),
  approximateAddress: ApproximateAddressInputSchema.optional()
});

const CreatePinSchema = z.discriminatedUnion('type', [
  EventPinCreateSchema,
  DiscussionPinCreateSchema
]);

router.post('/', verifyToken, async (req, res) => {
  try {
    const input = CreatePinSchema.parse(req.body);

    const now = Date.now();
    const maxEventTimestamp = now + EVENT_MAX_LEAD_TIME_MS;
    const maxDiscussionTimestamp = now + DISCUSSION_MAX_DURATION_MS;

    if (input.type === 'event' && input.endDate < input.startDate) {
      return res.status(400).json({ message: 'endDate must be after startDate' });
    }

    if (input.type === 'event') {
      if (input.startDate.getTime() < now - PAST_TOLERANCE_MS) {
        return res.status(400).json({ message: 'Start date cannot be in the past.' });
      }
      if (input.endDate.getTime() < now - PAST_TOLERANCE_MS) {
        return res.status(400).json({ message: 'End date cannot be in the past.' });
      }
      if (input.startDate.getTime() > maxEventTimestamp || input.endDate.getTime() > maxEventTimestamp) {
        return res
          .status(400)
          .json({ message: 'Events can only be scheduled up to 14 days in advance.' });
      }
    } else if (input.type === 'discussion') {
      if (input.expiresAt.getTime() < now - PAST_TOLERANCE_MS) {
        return res.status(400).json({ message: 'Expiration date cannot be in the past.' });
      }
      if (input.expiresAt.getTime() > maxDiscussionTimestamp) {
        return res
          .status(400)
          .json({ message: 'Discussions can only stay active for up to 3 days.' });
      }
    }

    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(403).json({ message: 'Unable to resolve authenticated user for pin creation' });
    }

    let creatorObjectId = viewer._id;
    let creatorUserDoc = viewer;
    if (input.creatorId) {
      if (!mongoose.Types.ObjectId.isValid(input.creatorId)) {
        return res.status(400).json({ message: 'Invalid creator id' });
      }

      const requestedCreatorId = new mongoose.Types.ObjectId(input.creatorId);
      const viewerRoles = Array.isArray(viewer.roles) ? viewer.roles : [];
      const viewerIsPrivileged =
        viewerRoles.includes('admin') || viewerRoles.includes('super-admin') || viewerRoles.includes('system-admin');

      if (!requestedCreatorId.equals(viewer._id) && !viewerIsPrivileged) {
        return res.status(403).json({ message: 'You are not allowed to create pins for other users' });
      }

      creatorObjectId = requestedCreatorId;
      if (!requestedCreatorId.equals(viewer._id)) {
        const overrideCreator = await User.findById(requestedCreatorId);
        if (!overrideCreator) {
          return res.status(404).json({ message: 'Specified creator user not found' });
        }
        creatorUserDoc = overrideCreator;
      }
    }

    const coordinates = {
      type: 'Point',
      coordinates: [input.coordinates.longitude, input.coordinates.latitude]
    };

  const pinData = {
    type: input.type,
    creatorId: creatorObjectId,
    title: input.title,
    description: input.description,
    coordinates,
    proximityRadiusMeters: input.proximityRadiusMeters ?? 1609,
    visibility: 'public',
    options: input.options ?? undefined
  };

    if (input.type === 'event') {
      pinData.startDate = input.startDate;
      pinData.endDate = input.endDate;
      pinData.address = input.address
        ? {
            precise: input.address.precise,
            components: input.address.components
          }
        : undefined;
    } else if (input.type === 'discussion') {
      pinData.expiresAt = input.expiresAt;
      pinData.autoDelete = input.autoDelete ?? true;
      pinData.approximateAddress = input.approximateAddress
        ? {
            city: input.approximateAddress.city,
            state: input.approximateAddress.state,
            country: input.approximateAddress.country,
            formatted: input.approximateAddress.formatted
          }
        : undefined;
    }

    if (input.photos?.length) {
      pinData.photos = input.photos.map((photo) => normaliseMediaAsset(photo, creatorObjectId));
    }

    if (input.coverPhoto) {
      pinData.coverPhoto = normaliseMediaAsset(input.coverPhoto, creatorObjectId);
    } else if (pinData.photos?.length) {
      pinData.coverPhoto = pinData.photos[0];
    }

    const pin = await Pin.create(pinData);
    try {
      ensureUserStats(creatorUserDoc);
      if (pin.type === 'event') {
        creatorUserDoc.stats.eventsHosted = (creatorUserDoc.stats.eventsHosted ?? 0) + 1;
      } else if (pin.type === 'discussion') {
        creatorUserDoc.stats.posts = (creatorUserDoc.stats.posts ?? 0) + 1;
      }
      creatorUserDoc.markModified('stats');
      await creatorUserDoc.save();
    } catch (error) {
      console.error('Failed to update creator stats after pin creation:', error);
    }
    const hydrated = await Pin.findById(pin._id).populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION });
    let sourcePin = hydrated ?? pin;
    const creatorPublic = hydrated ? mapUserToPublic(hydrated.creatorId) : undefined;
    const viewerId = viewer ? toIdString(viewer._id) : undefined;

    const bookmarkResult = await ensureBookmarkForUser({
      userDoc: creatorUserDoc,
      pinDoc: sourcePin
    });
    if (bookmarkResult?.pin) {
      sourcePin = bookmarkResult.pin;
    }

    if (bookmarkResult?.created) {
      broadcastBookmarkCreated({
        pin: sourcePin,
        bookmarker: creatorUserDoc
      }).catch((error) => {
        console.error('Failed to queue auto-bookmark updates after pin creation:', error);
      });
    }

    let viewerHasBookmarked = false;
    if (viewer) {
      if (creatorUserDoc && viewer._id.equals(creatorUserDoc._id)) {
        viewerHasBookmarked = Boolean(bookmarkResult?.created || bookmarkResult?.bookmark);
      } else {
        const viewerBookmarkExists = await Bookmark.exists({
          userId: viewer._id,
          pinId: sourcePin._id
        });
        viewerHasBookmarked = Boolean(viewerBookmarkExists);
      }
    }

    let createBadgeResult = null;
    if (viewer) {
      try {
        createBadgeResult = await grantBadge({
          userId: viewer._id,
          badgeId: 'create-first-pin',
          sourceUserId: viewer._id
        });
      } catch (error) {
        console.error('Failed to grant create pin badge:', error);
      }
    }

    const payload = mapPinToFull(sourcePin, creatorPublic, {
      viewerId,
      viewerHasBookmarked
    });
    if (createBadgeResult?.granted) {
      payload._badgeEarnedId = createBadgeResult.badge.id;
    }
    broadcastPinCreated(sourcePin).catch((error) => {
      console.error('Failed to queue pin creation updates:', error);
    });
    res.status(201).json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin payload', issues: error.errors });
    }
    req.logError?.(error, { handler: 'pins:create' });
    console.error('Failed to create pin:', error);
    res.status(500).json({ message: 'Failed to create pin' });
  }
});

router.get('/nearby', verifyToken, async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      distanceMiles,
      limit,
      type,
      types: typesParam,
      search,
      categories: categoriesParam,
      status: statusParam,
      startDate: startDateParam,
      endDate: endDateParam,
      friendEngagements: friendEngagementsParam
    } = NearbyPinsQuerySchema.parse(req.query);

    const maxDistanceMeters = milesToMeters(distanceMiles) ?? distanceMiles * METERS_PER_MILE;
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }
    const viewerBlockedSet = buildBlockedSet(viewer);
    const viewerId = toIdString(viewer._id);
    const viewerFriendObjectIds = mapIdList(viewer.relationships?.friendIds)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const normalizedFriendEngagements = parseCsvParam(friendEngagementsParam)
      .map((entry) => entry.toLowerCase())
      .filter((entry) => entry === 'created' || entry === 'replied' || entry === 'attending');
    const friendFilterActive = normalizedFriendEngagements.length > 0;

    if (friendFilterActive && viewerFriendObjectIds.length === 0) {
      return res.json([]);
    }

    let friendReplyPinIds = [];
    if (friendFilterActive && normalizedFriendEngagements.includes('replied')) {
      friendReplyPinIds = await Reply.distinct('pinId', {
        authorId: { $in: viewerFriendObjectIds }
      });
    }
    const friendFilterClauses = [];
    if (normalizedFriendEngagements.includes('created') && viewerFriendObjectIds.length) {
      friendFilterClauses.push({ creatorId: { $in: viewerFriendObjectIds } });
    }
    if (normalizedFriendEngagements.includes('attending') && viewerFriendObjectIds.length) {
      friendFilterClauses.push({ attendingUserIds: { $in: viewerFriendObjectIds } });
    }
    if (normalizedFriendEngagements.includes('replied') && friendReplyPinIds.length) {
      friendFilterClauses.push({ _id: { $in: friendReplyPinIds } });
    }

    const now = new Date();
    const filters = [];

    if (friendFilterActive) {
      if (!friendFilterClauses.length) {
        return res.json([]);
      }
      filters.push({ $or: friendFilterClauses });
    }

    // Status filters
    const effectiveStatus = statusParam || 'active';
    if (effectiveStatus === 'active') {
      filters.push({ $or: [{ isActive: { $exists: false } }, { isActive: true }] });
      filters.push({
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } }
        ]
      });
      filters.push({
        $or: [
          { type: 'discussion' },
          { type: 'event', endDate: { $exists: false } },
          { type: 'event', endDate: null },
          { type: 'event', endDate: { $gt: now } }
        ]
      });
    } else if (effectiveStatus === 'expired') {
      filters.push({ expiresAt: { $exists: true, $lte: now } });
    } else {
      filters.push({ $or: [{ isActive: { $exists: false } }, { isActive: true }] });
    }

    // Type filters
    const typeSet = new Set();
    if (type) {
      typeSet.add(type);
    }
    parseCsvParam(typesParam).forEach((entry) => {
      if (entry.toLowerCase() === 'event' || entry.toLowerCase() === 'discussion') {
        typeSet.add(entry.toLowerCase());
      }
    });
    const requestedTypes = Array.from(typeSet);
    if (requestedTypes.length === 1) {
      filters.push({ type: requestedTypes[0] });
    } else if (requestedTypes.length > 1) {
      filters.push({ type: { $in: requestedTypes } });
    }

    // Keyword search
    if (search && search.trim()) {
      const pattern = new RegExp(escapeRegex(search.trim()), 'i');
      filters.push({
        $or: [{ title: pattern }, { description: pattern }, { tags: pattern }]
      });
    }

    // Categories
    const categoryList = parseCsvParam(categoriesParam);
    if (categoryList.length > 0) {
      filters.push({
        $or: categoryList.map((category) => ({
          tags: { $regex: new RegExp(`^${escapeRegex(category)}$`, 'i') }
        }))
      });
    }

    // Date range
    const startDate = parseDateParam(startDateParam);
    const endDate = parseDateParam(endDateParam);
    if (startDate || endDate) {
      const range = {};
      if (startDate) {
        range.$gte = startDate;
      }
      if (endDate) {
        range.$lte = endDate;
      }
      filters.push({
        $or: [
          { startDate: range },
          { endDate: range },
          { createdAt: range },
          { expiresAt: range }
        ]
      });
    }

    const findQuery = {
      ...(filters.length ? { $and: filters } : {}),
      coordinates: {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: maxDistanceMeters
        }
      }
    };

    const pins = await timeAsync('pins', `nearby:${toIdString(viewer._id)}`, () =>
      Pin.find(findQuery)
        .limit(limit)
        .populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION })
    );

    const filteredPins = pins.filter((pinDoc) => {
      const creatorDoc = pinDoc.creatorId;
      if (!creatorDoc) {
        return false;
      }
      const creatorId = toIdString(creatorDoc._id);
      if (creatorId && viewerBlockedSet.has(creatorId)) {
        return false;
      }
      if (isBlockedBetweenUsers(viewer, creatorDoc)) {
        return false;
      }
      return true;
    });

    const pinObjectIds = filteredPins.map((pinDoc) => pinDoc._id).filter(Boolean);
    let viewerBookmarkSet = new Set();
    if (pinObjectIds.length > 0) {
      const bookmarks = await Bookmark.find(
        { userId: viewer._id, pinId: { $in: pinObjectIds } },
        { pinId: 1 }
      ).lean();
      viewerBookmarkSet = new Set(bookmarks.map((bookmark) => toIdString(bookmark.pinId)).filter(Boolean));
    }

    const payload = filteredPins.map((pinDoc) => {
      const pinIdString = toIdString(pinDoc._id);
      let viewerHasBookmarked = pinIdString ? viewerBookmarkSet.has(pinIdString) : false;
      const creatorPublic = mapUserToPublic(pinDoc.creatorId);
      const pinCreatorId = toIdString(pinDoc.creatorId?._id ?? pinDoc.creatorId);
      const viewerOwnsPin = Boolean(viewerId && pinCreatorId && viewerId === pinCreatorId);
      let viewerIsAttending = false;
      if (Array.isArray(pinDoc.attendingUserIds) && viewerId) {
        viewerIsAttending = pinDoc.attendingUserIds.some((attendeeId) => {
          try {
            return toIdString(attendeeId) === viewerId;
          } catch {
            return false;
          }
        });
      }
      if (viewerOwnsPin || viewerIsAttending) {
        viewerHasBookmarked = true;
      }
      const listItem = mapPinToListItem(pinDoc, creatorPublic, {
        viewerHasBookmarked,
        viewerIsAttending,
        viewerOwnsPin
      });
      const [pinLongitude, pinLatitude] = pinDoc.coordinates.coordinates;
      const distanceMeters = haversineDistanceMeters(latitude, longitude, pinLatitude, pinLongitude);
      return {
        ...listItem,
        distanceMeters,
        isBookmarked: viewerHasBookmarked,
        viewerHasBookmarked
      };
    });

    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid nearby pins query', issues: error.errors });
    }
    req.logError?.(error, { handler: 'pins:nearby' });
    console.error('Failed to load nearby pins:', error);
    res.status(500).json({ message: 'Failed to load nearby pins' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const query = PinsQuerySchema.parse(req.query);
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }
    const viewerBlockedSet = buildBlockedSet(viewer);
    const limit = query.limit;
    const now = new Date();
    const filters = [];
    const sortMode = query.sort ?? 'recent';
    const statusFilter = query.status ?? 'active';

    if (statusFilter !== 'expired') {
      filters.push({ $or: [{ isActive: { $exists: false } }, { isActive: true }] });
    }

    if (query.type) {
      filters.push({ type: query.type });
    }

    if (query.creatorId) {
      if (!mongoose.Types.ObjectId.isValid(query.creatorId)) {
        return res.status(400).json({ message: 'Invalid creator id' });
      }
      filters.push({ creatorId: new mongoose.Types.ObjectId(query.creatorId) });
    }

    if (statusFilter === 'active') {
      if (sortMode === 'expiration') {
        filters.push({ expiresAt: { $gt: now } });
      } else {
        filters.push({
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }]
        });
      }
    } else if (statusFilter === 'expired') {
      filters.push({ expiresAt: { $exists: true, $lte: now } });
    } else if (statusFilter === 'all' && sortMode === 'expiration') {
      filters.push({ expiresAt: { $exists: true } });
    }

    const typeSet = new Set();
    if (query.type) {
      typeSet.add(query.type);
    }
    parseCsvParam(query.types).forEach((entry) => {
      if (entry.toLowerCase() === 'event' || entry.toLowerCase() === 'discussion') {
        typeSet.add(entry.toLowerCase());
      }
    });
    const requestedTypes = Array.from(typeSet);
    if (requestedTypes.length === 1) {
      filters.push({ type: requestedTypes[0] });
    } else if (requestedTypes.length > 1) {
      filters.push({ type: { $in: requestedTypes } });
    }

    if (query.search && query.search.trim()) {
      const pattern = new RegExp(escapeRegex(query.search.trim()), 'i');
      filters.push({
        $or: [{ title: pattern }, { description: pattern }, { tags: pattern }]
      });
    }

    const categoryList = parseCsvParam(query.categories);
    if (categoryList.length > 0) {
      filters.push({
        $or: categoryList.map((category) => ({
          tags: { $regex: new RegExp(`^${escapeRegex(category)}$`, 'i') }
        }))
      });
    }

    const startDate = parseDateParam(query.startDate);
    const endDate = parseDateParam(query.endDate);
    if (startDate || endDate) {
      const range = {};
      if (startDate) {
        range.$gte = startDate;
      }
      if (endDate) {
        range.$lte = endDate;
      }
      filters.push({
        $or: [
          { startDate: range },
          { endDate: range },
          { createdAt: range },
          { expiresAt: range }
        ]
      });
    }

    const matchQuery =
      filters.length === 0
        ? {}
        : filters.length === 1
        ? filters[0]
        : { $and: filters };

    if (sortMode === 'distance') {
      if (
        query.latitude === undefined ||
        query.longitude === undefined ||
        !Number.isFinite(query.latitude) ||
        !Number.isFinite(query.longitude)
      ) {
        return res
          .status(400)
          .json({ message: 'Latitude and longitude are required for distance sorting' });
      }

      const geoNearStage = {
        $geoNear: {
          near: { type: 'Point', coordinates: [query.longitude, query.latitude] },
          distanceField: 'distanceMeters',
          spherical: true
        }
      };

      if (Object.keys(matchQuery).length > 0) {
        geoNearStage.$geoNear.query = matchQuery;
      }

      const pipeline = [geoNearStage, { $limit: limit }];
      const aggregated = await timeAsync(
        'pins',
        `list:distance:aggregate:${toIdString(viewer._id)}`,
        () => Pin.aggregate(pipeline)
      );
      const hydrated = aggregated.map((doc) => Pin.hydrate(doc));
      const populated = await timeAsync(
        'pins',
        `list:distance:populate:${toIdString(viewer._id)}`,
        () =>
          Pin.populate(hydrated, {
            path: 'creatorId',
            select: USER_SUMMARY_PROJECTION
          })
      );

      const distanceLookup = new Map(aggregated.map((doc, index) => [toIdString(doc._id), aggregated[index]?.distanceMeters]));

      const filteredPins = populated.filter((pinDoc) => {
        const creatorDoc = pinDoc.creatorId;
        if (!creatorDoc) {
          return false;
        }
        const creatorId = toIdString(creatorDoc._id);
        if (creatorId && viewerBlockedSet.has(creatorId)) {
          return false;
        }
        if (isBlockedBetweenUsers(viewer, creatorDoc)) {
          return false;
        }
        return true;
      });

      const payload = filteredPins.map((pinDoc) => {
        const creatorPublic = mapUserToPublic(pinDoc.creatorId);
        const listItem = mapPinToListItem(pinDoc, creatorPublic);
        return {
          ...listItem,
          distanceMeters: distanceLookup.get(toIdString(pinDoc._id))
        };
      });

      return res.json(payload);
    }

    const sortSpec =
      sortMode === 'expiration'
        ? { expiresAt: 1, updatedAt: -1, _id: -1 }
        : { updatedAt: -1, _id: -1 };

    const pins = await timeAsync('pins', `list:${toIdString(viewer._id)}`, () =>
      Pin.find(matchQuery)
        .sort(sortSpec)
        .limit(limit)
        .populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION })
    );

    const filteredPins = pins.filter((pin) => {
      const creatorDoc = pin.creatorId;
      if (!creatorDoc) {
        return false;
      }
      const creatorId = toIdString(creatorDoc._id);
      if (creatorId && viewerBlockedSet.has(creatorId)) {
        return false;
      }
      if (isBlockedBetweenUsers(viewer, creatorDoc)) {
        return false;
      }
      return true;
    });

    const payload = filteredPins.map((pin) => {
      const creatorPublic = mapUserToPublic(pin.creatorId);
      return mapPinToListItem(pin, creatorPublic);
    });

    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin query', issues: error.errors });
    }
    console.error('Failed to load pins:', error);
    res.status(500).json({ message: 'Failed to load pins' });
  }
});

router.get('/categories', verifyToken, async (req, res) => {
  try {
    const categories = await Pin.aggregate([
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 50 }
    ]);

    res.json(
      categories.map((entry) => ({
        name: entry._id,
        count: entry.count
      }))
    );
  } catch (error) {
    console.error('Failed to load pin categories:', error);
    res.status(500).json({ message: 'Failed to load pin categories' });
  }
});

router.get('/:pinId', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const pin = await timeAsync('pins', `detail:${pinId}`, () =>
      Pin.findById(pinId).populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION })
    );
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (isBlockedBetweenUsers(viewer, pin.creatorId)) {
      return res.status(404).json({ message: 'Pin not found' });
    }
    const viewerId = viewer ? toIdString(viewer._id) : undefined;
    let viewerHasBookmarked = false;
    if (viewer) {
      const bookmarkExists = await Bookmark.exists({ userId: viewer._id, pinId: pin._id });
      viewerHasBookmarked = Boolean(bookmarkExists);
    }
    const previewModeRaw =
      typeof req.query.preview === 'string' ? req.query.preview.trim().toLowerCase() : undefined;

    const mapOptions = {
      viewerId,
      viewerHasBookmarked
    };

    if (previewModeRaw === 'far') {
      const distanceMeters = Math.max(pin.proximityRadiusMeters ?? 1609, 1609) * 3;
      mapOptions.viewerDistanceMeters = distanceMeters;
      mapOptions.viewerWithinInteractionRadius = false;
      mapOptions.viewerInteractionLockReason = 'outside-radius';
      mapOptions.viewerInteractionLockMessage =
        'You are outside this pin\'s interaction radius. Move closer to interact with it.';
    }

    const payload = mapPinToFull(pin, mapUserToPublic(pin.creatorId), mapOptions);
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin id', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load pin' });
  }
});

router.post('/:pinId/attendance', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const { attending } = AttendanceUpdateSchema.parse(req.body);

    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const pin = await Pin.findById(pinId).populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION });
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    if (isBlockedBetweenUsers(viewer, pin.creatorId)) {
      return res.status(403).json({ message: 'You cannot interact with this pin.' });
    }

    if (pin.type !== 'event') {
      return res
        .status(400)
        .json({ message: 'Only event pins support attendance tracking' });
    }

    if (pin.attendable === false) {
      return res.status(400).json({ message: 'This event is not accepting attendees' });
    }

    if (!Array.isArray(pin.attendingUserIds)) {
      pin.attendingUserIds = [];
    }

    const viewerId = toIdString(viewer._id);
    const attendeeIds = pin.attendingUserIds.map((id) => toIdString(id));
    const isAlreadyAttending = attendeeIds.includes(viewerId);
    let viewerJoined = false;
    let viewerLeft = false;

    if (attending) {
      if (!isAlreadyAttending) {
        if (pin.participantLimit && attendeeIds.length >= pin.participantLimit) {
          return res.status(409).json({ message: 'Participant limit reached' });
        }
        pin.attendingUserIds.push(viewer._id);
        viewerJoined = true;
      }
    } else if (isAlreadyAttending) {
      pin.attendingUserIds = pin.attendingUserIds.filter(
        (id) => toIdString(id) !== viewerId
      );
      pin.markModified('attendingUserIds');
      viewerLeft = true;
    }

    pin.participantCount = pin.attendingUserIds.length;

    await pin.save();
    if (viewerJoined || viewerLeft) {
      try {
        ensureUserStats(viewer);
        const existingCount = viewer.stats.eventsAttended ?? 0;
        if (viewerJoined) {
          viewer.stats.eventsAttended = existingCount + 1;
        } else if (viewerLeft) {
          viewer.stats.eventsAttended = Math.max(0, existingCount - 1);
        }
        viewer.markModified('stats');
        await viewer.save();
      } catch (error) {
        console.error('Failed to update attendee stats:', error);
      }
    }

    let viewerHasBookmarked = false;
    if (attending && viewerJoined) {
      const bookmarkResult = await ensureBookmarkForUser({
        userDoc: viewer,
        pinDoc: pin
      });
      viewerHasBookmarked = Boolean(bookmarkResult?.created || bookmarkResult?.bookmark);
      if (bookmarkResult?.created) {
        broadcastBookmarkCreated({
          pin,
          bookmarker: viewer
        }).catch((error) => {
          console.error('Failed to queue auto-bookmark updates after attendance change:', error);
        });
      }
    } else {
      const bookmarkExists = await Bookmark.exists({ userId: viewer._id, pinId: pin._id });
      viewerHasBookmarked = Boolean(bookmarkExists);
    }
    let attendanceBadgeResult = null;
    if (attending) {
      try {
        attendanceBadgeResult = await grantBadge({
          userId: viewer._id,
          badgeId: 'attend-first-event',
          sourceUserId: viewer._id
        });
      } catch (error) {
        console.error('Failed to grant attendance badge:', error);
      }
    }

    const payload = mapPinToFull(pin, mapUserToPublic(pin.creatorId), {
      viewerId,
      viewerHasBookmarked
    });
    if (attendanceBadgeResult?.granted) {
      payload._badgeEarnedId = attendanceBadgeResult.badge.id;
    }

    broadcastAttendanceChange({ pin, attendee: viewer, attending }).catch((error) => {
      console.error('Failed to queue attendance updates:', error);
    });
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid attendance payload', issues: error.errors });
    }
    console.error('Failed to update pin attendance:', error);
    res.status(500).json({ message: 'Failed to update pin attendance' });
  }
});

router.get('/:pinId/attendees', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const pin = await Pin.findById(pinId);
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    if (pin.type !== 'event') {
      return res.status(400).json({ message: 'Only event pins have attendees' });
    }

    const attendeeIdStrings = mapIdList(pin.attendingUserIds);
    if (attendeeIdStrings.length === 0) {
      return res.json([]);
    }

    const attendeeObjectIds = attendeeIdStrings
      .map((id) => {
        if (mongoose.Types.ObjectId.isValid(id)) {
          return new mongoose.Types.ObjectId(id);
        }
        return null;
      })
      .filter(Boolean);

    if (attendeeObjectIds.length === 0) {
      return res.json([]);
    }

    const users = await User.find({ _id: { $in: attendeeObjectIds } });
    const usersById = new Map(users.map((userDoc) => [toIdString(userDoc._id), userDoc]));
    const attendees = [];
    const skippedUsers = [];

    for (const id of attendeeIdStrings) {
      const userDoc = usersById.get(id);
      if (!userDoc) {
        continue;
      }
      try {
        attendees.push(mapUserToPublic(userDoc));
      } catch (error) {
        if (error instanceof ZodError) {
          skippedUsers.push({ userId: id, issues: error.errors });
          continue;
        }
        throw error;
      }
    }

    if (skippedUsers.length > 0) {
      console.warn('Skipped malformed attendee records', skippedUsers);
    }

    res.json(attendees);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin id', issues: error.errors });
    }
    console.error('Failed to load pin attendees:', error);
    res.status(500).json({ message: 'Failed to load pin attendees' });
  }
});

router.post('/:pinId/share', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const input = SharePinSchema.parse(req.body ?? {});

    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const pin = await Pin.findById(pinId).populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION });
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    if (isBlockedBetweenUsers(viewer, pin.creatorId)) {
      return res.status(403).json({ message: 'You cannot share this pin.' });
    }

    pin.shareCount = (pin.shareCount ?? 0) + 1;
    if (pin.stats) {
      pin.stats.shareCount = (pin.stats.shareCount ?? 0) + 1;
    } else {
      pin.stats = {
        bookmarkCount: pin.bookmarkCount ?? 0,
        replyCount: pin.replyCount ?? 0,
        shareCount: pin.shareCount ?? 1,
        viewCount: pin.stats?.viewCount ?? 0
      };
    }
    pin.markModified('stats');
    await pin.save();

    await trackEvent({
      eventName: 'pin-share',
      actorId: viewer._id,
      targetId: pin.creatorId?._id ?? pin.creatorId,
      payload: {
        pinId: toIdString(pin._id),
        platform: input.platform || 'unspecified',
        method: input.method || 'share-button'
      }
    });

    res.status(201).json({
      pinId: toIdString(pin._id),
      shareCount: pin.shareCount ?? 0,
      stats: {
        shareCount: pin.stats?.shareCount ?? pin.shareCount ?? 0
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid share payload', issues: error.errors });
    }
    console.error('Failed to record pin share:', error);
    res.status(500).json({ message: 'Failed to record pin share' });
  }
});

router.post('/:pinId/replies', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const input = CreateReplySchema.parse(req.body);

    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const pin = await Pin.findById(pinId).populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION });
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    if (isBlockedBetweenUsers(viewer, pin.creatorId)) {
      return res.status(403).json({ message: 'You cannot interact with this pin.' });
    }

    let parentReplyId = undefined;
    let parentReplyDoc = null;
    if (input.parentReplyId) {
      parentReplyId = new mongoose.Types.ObjectId(input.parentReplyId);
      parentReplyDoc = await Reply.findOne({ _id: parentReplyId, pinId }).populate({ path: 'authorId', select: USER_SUMMARY_PROJECTION });
      if (!parentReplyDoc) {
        return res.status(404).json({ message: 'Parent reply not found for this pin' });
      }
      if (isBlockedBetweenUsers(viewer, parentReplyDoc.authorId)) {
        return res.status(403).json({ message: 'You cannot reply to this comment.' });
      }
    }

    const replyTimingLabel = `pins:reply:create:${pinId}:${Date.now()}`;
    let reply;
    console.time(replyTimingLabel);
    try {
      reply = await Reply.create({
        pinId: pin._id,
        parentReplyId,
        authorId: viewer._id,
        message: input.message.trim(),
        attachments: [],
        mentionedUserIds: []
      });
    } finally {
      console.timeEnd(replyTimingLabel);
    }

    pin.replyCount = (pin.replyCount ?? 0) + 1;
    if (pin.stats) {
      pin.stats.replyCount = (pin.stats.replyCount ?? 0) + 1;
    } else {
      pin.stats = {
        bookmarkCount: 0,
        replyCount: 1,
        shareCount: 0,
        viewCount: 0
      };
    }
    await pin.save();

    const populatedReply = await Reply.findById(reply._id).populate({ path: 'authorId', select: USER_SUMMARY_PROJECTION });
    const payload = mapReply(populatedReply ?? reply, mapUserToPublic(populatedReply?.authorId ?? viewer));
    broadcastPinReply({
      pin,
      reply: populatedReply ?? reply,
      author: populatedReply?.authorId ?? viewer,
      parentReply: parentReplyDoc
    }).catch((error) => {
      console.error('Failed to queue pin reply updates:', error);
    });
    res.status(201).json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid reply payload', issues: error.errors });
    }
    console.error('Failed to create reply:', error);
    res.status(500).json({ message: 'Failed to create reply' });
  }
});

router.get('/:pinId/replies', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }
    const viewerBlockedSet = buildBlockedSet(viewer);

    const pin = await Pin.findById(pinId).populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION });
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }
    if (isBlockedBetweenUsers(viewer, pin.creatorId)) {
      return res.status(404).json({ message: 'Replies unavailable.' });
    }

    const repliesTimingLabel = `pins:replies:${pinId}:${Date.now()}`;
    let replies;
    console.time(repliesTimingLabel);
    try {
      replies = await Reply.find({ pinId })
        .sort({ createdAt: -1, updatedAt: -1, _id: -1 })
        .populate({ path: 'authorId', select: USER_SUMMARY_PROJECTION });
    } finally {
      console.timeEnd(repliesTimingLabel);
    }

    const filteredReplies = replies.filter((reply) => {
      const author = reply.authorId;
      if (!author) {
        return false;
      }
      const authorId = toIdString(author._id);
      if (authorId && viewerBlockedSet.has(authorId)) {
        return false;
      }
      if (isBlockedBetweenUsers(viewer, author)) {
        return false;
      }
      return true;
    });

    const payload = filteredReplies.map((reply) => mapReply(reply, mapUserToPublic(reply.authorId)));
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin id', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load replies' });
  }
});

router.put('/:pinId', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const input = CreatePinSchema.parse(req.body);
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const viewerId = toIdString(viewer._id);
    const viewerRoles = Array.isArray(viewer.roles) ? viewer.roles : [];
    const hasElevatedRole = viewerRoles.includes('admin') || viewerRoles.includes('moderator');

    const now = Date.now();
    const maxEventTimestamp = now + EVENT_MAX_LEAD_TIME_MS;
    const maxDiscussionTimestamp = now + DISCUSSION_MAX_DURATION_MS;

    const pin = await Pin.findById(pinId).populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION });
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    const pinCreatorId = toIdString(pin.creatorId?._id ?? pin.creatorId);
    if (!hasElevatedRole && (!viewerId || !pinCreatorId || viewerId !== pinCreatorId)) {
      return res.status(403).json({ message: 'You do not have permission to update this pin.' });
    }

    if (input.creatorId && !hasElevatedRole) {
      if (input.creatorId !== viewerId) {
        return res.status(403).json({ message: 'You cannot reassign this pin.' });
      }
    }

    if (input.type === 'event' && input.endDate < input.startDate) {
      return res.status(400).json({ message: 'endDate must be after startDate' });
    }

    if (input.type === 'event') {
      if (input.startDate.getTime() < now - PAST_TOLERANCE_MS) {
        return res.status(400).json({ message: 'Start date cannot be in the past.' });
      }
      if (input.endDate.getTime() < now - PAST_TOLERANCE_MS) {
        return res.status(400).json({ message: 'End date cannot be in the past.' });
      }
      if (input.startDate.getTime() > maxEventTimestamp || input.endDate.getTime() > maxEventTimestamp) {
        return res
          .status(400)
          .json({ message: 'Events can only be scheduled up to 14 days in advance.' });
      }
    } else if (input.type === 'discussion') {
      if (input.expiresAt.getTime() < now - PAST_TOLERANCE_MS) {
        return res.status(400).json({ message: 'Expiration date cannot be in the past.' });
      }
      if (input.expiresAt.getTime() > maxDiscussionTimestamp) {
        return res
          .status(400)
          .json({ message: 'Discussions can only stay active for up to 3 days.' });
      }
    }

    if (input.type === 'discussion' && input.proximityRadiusMeters && input.proximityRadiusMeters <= 0) {
      return res.status(400).json({ message: 'proximityRadiusMeters must be greater than zero' });
    }

    const previousPin = pin.toObject({ depopulate: false });

    let creatorObjectId = pin.creatorId?._id ? pin.creatorId._id : pin.creatorId;
    if (input.creatorId) {
      if (!mongoose.Types.ObjectId.isValid(input.creatorId)) {
        return res.status(400).json({ message: 'Invalid creator id' });
      }
      creatorObjectId = new mongoose.Types.ObjectId(input.creatorId);
    }

    const coordinates = {
      type: 'Point',
      coordinates: [input.coordinates.longitude, input.coordinates.latitude]
    };

    pin.type = input.type;
    pin.creatorId = creatorObjectId;
    pin.title = input.title;
    pin.description = input.description;
    pin.coordinates = coordinates;
    pin.proximityRadiusMeters = input.proximityRadiusMeters ?? pin.proximityRadiusMeters ?? 1609;

    if (input.type === 'event') {
      pin.startDate = input.startDate;
      pin.endDate = input.endDate;
      pin.address = input.address
        ? {
            precise: input.address.precise,
            components: input.address.components
          }
        : undefined;
      pin.expiresAt = undefined;
      pin.autoDelete = undefined;
      pin.approximateAddress = undefined;
    } else if (input.type === 'discussion') {
      pin.expiresAt = input.expiresAt;
      pin.autoDelete = input.autoDelete ?? true;
      pin.approximateAddress = input.approximateAddress
        ? {
            city: input.approximateAddress.city,
            state: input.approximateAddress.state,
            country: input.approximateAddress.country,
            formatted: input.approximateAddress.formatted
          }
        : undefined;
      pin.startDate = undefined;
      pin.endDate = undefined;
      pin.address = undefined;
    }

    if (Array.isArray(input.photos)) {
      pin.photos = input.photos.map((photo) => normaliseMediaAsset(photo, creatorObjectId));
    }

    if (input.coverPhoto) {
      pin.coverPhoto = normaliseMediaAsset(input.coverPhoto, creatorObjectId);
    } else if (pin.photos.length > 0) {
      pin.coverPhoto = pin.photos[0];
    } else {
      pin.coverPhoto = undefined;
    }

    await pin.save();
    const hydrated = await Pin.findById(pin._id).populate({ path: 'creatorId', select: USER_SUMMARY_PROJECTION });
    const sourcePin = hydrated ?? pin;
    const creatorPublic = hydrated ? mapUserToPublic(hydrated.creatorId) : mapUserToPublic(pin.creatorId);
    let viewerHasBookmarked = false;
    if (viewerId) {
      const bookmarkExists = await Bookmark.exists({ userId: viewer._id, pinId: sourcePin._id });
      viewerHasBookmarked = Boolean(bookmarkExists);
    }
    const payload = mapPinToFull(sourcePin, creatorPublic, {
      viewerId,
      viewerHasBookmarked
    });
    await broadcastPinUpdated({ previous: previousPin, updated: sourcePin, editor: viewer });
    return res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin payload', issues: error.errors });
    }
    console.error('Failed to update pin:', error);
    res.status(500).json({ message: 'Failed to update pin' });
  }
});

router.delete('/:pinId', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const pin = await Pin.findById(pinId);
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    const viewerId = toIdString(viewer._id);
    const pinCreatorId = toIdString(pin.creatorId);
    if (!viewerId || viewerId !== pinCreatorId) {
      return res.status(403).json({ message: 'You do not have permission to delete this pin.' });
    }

    await Reply.deleteMany({ pinId: pin._id });
    await Bookmark.deleteMany({ pinId: pin._id });
    await pin.deleteOne();

    await trackEvent('pin_deleted', {
      pinId: toIdString(pin._id),
      userId: viewerId
    });

    return res.json({ success: true, message: 'Pin deleted successfully.' });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin id', issues: error.errors });
    }
    console.error('Failed to delete pin:', error);
    return res.status(500).json({ message: 'Failed to delete pin' });
  }
});

module.exports = router;
