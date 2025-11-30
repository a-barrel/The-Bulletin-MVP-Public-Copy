const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const {
  ProximityChatRoom,
  ProximityChatMessage,
  ProximityChatPresence
} = require('../models/ProximityChat');
const User = require('../models/User');
const Location = require('../models/Location');
const { Bookmark } = require('../models/Bookmark');
const verifyToken = require('../middleware/verifyToken');
const {
  mapRoom,
  mapMessage,
  mapPresence,
  createRoom,
  createMessage,
  upsertPresence
} = require('../services/proximityChatService');
const { canViewerModeratePins } = require('../utils/moderation');
const {
  broadcastChatMessage,
  broadcastChatRoomTransition
} = require('../services/updateFanoutService');
const { grantBadge } = require('../services/badgeService');
const { fetchGifAttachment, searchGifAttachments } = require('../services/gifService');
const { MediaAssetSchema } = require('../schemas/common');
const { toIdString, mapIdList } = require('../utils/ids');

const router = express.Router();
const ENABLE_QUERY_TIMERS = process.env.PINPOINT_ENABLE_QUERY_TIMERS === '1';

const toObjectIdList = (ids) =>
  Array.from(ids)
    .map((value) => toIdString(value))
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

const buildBlockedSet = (user) => new Set(mapIdList(user?.relationships?.blockedUserIds));

const PROFANITY_WORDS = [
  'fuck',
  'fucking',
  'fucker',
  'fuckers',
  'shit',
  'bitch',
  'bitches',
  'ass',
  'asshole',
  'bastard',
  'damn',
  'dick',
  'dicks',
  'piss',
  'cunt'
];

const FRUITS = [
  'Apple',
  'Banana',
  'Cherry',
  'Mango',
  'Pineapple',
  'Watermelon',
  'Peach',
  'Kiwi',
  'Grapefruit',
  'Blueberry'
];

const PROFANITY_REGEX = new RegExp(`\\b(${PROFANITY_WORDS.join('|')})\\b`, 'gi');

const normalizeFruit = (fruit, original) => {
  if (original === original.toUpperCase()) {
    return fruit.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return fruit.charAt(0).toUpperCase() + fruit.slice(1).toLowerCase();
  }
  return fruit.toLowerCase();
};

const pickFruitForWord = (word) => {
  const normalized = word.toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash + normalized.charCodeAt(index)) % FRUITS.length;
  }
  return FRUITS[hash];
};

const replaceProfanityWithFruit = (text = '') => {
  if (typeof text !== 'string' || !text) {
    return text;
  }
  return text.replace(PROFANITY_REGEX, (match) => normalizeFruit(pickFruitForWord(match), match));
};

const countProfanityInstances = (text = '') => {
  if (typeof text !== 'string' || !text) {
    return 0;
  }

  const matches = text.match(PROFANITY_REGEX);
  return matches ? matches.length : 0;
};

const parseBooleanParam = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return fallback;
    }
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
};

const normalizeReactionInput = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const stringValue = `${value}`.trim();
  if (!stringValue) {
    return null;
  }
  const isEmoji =
    /\p{Extended_Pictographic}/u.test(stringValue) ||
    Array.from(stringValue).length === 1; // keep single glyphs as-is
  if (isEmoji) {
    return stringValue;
  }
  const underscored = stringValue.toLowerCase().replace(/[\s-]+/g, '_');
  return underscored.slice(0, 64);
};

const RoomQuerySchema = z.object({
  pinId: z.string().optional(),
  ownerId: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  includeBookmarked: z.union([z.boolean(), z.string()]).optional(),
  adminView: z.union([z.boolean(), z.string()]).optional()
});

const RoomIdSchema = z.object({
  roomId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid room id'
  })
});

const MessageIdSchema = z.object({
  roomId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid room id'
  }),
  messageId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid message id'
  })
});

const ObjectIdString = z
  .string()
  .trim()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), { message: 'Invalid object id' });

const CreateRoomRequestSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  radiusMeters: z.number().positive(),
  pinId: ObjectIdString.optional(),
  presetKey: z.string().trim().optional(),
  isGlobal: z.boolean().optional()
});

const CreateMessageRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    pinId: ObjectIdString.optional(),
    replyToMessageId: ObjectIdString.optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracy: z.number().nonnegative().optional(),
    attachments: z.array(MediaAssetSchema).max(10).optional()
  })
  .refine(
    (value) =>
      (value.latitude === undefined && value.longitude === undefined) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    { message: 'Latitude and longitude must both be provided together.' }
  );

const CreatePresenceRequestSchema = z
  .object({
    sessionId: ObjectIdString.optional(),
    joinedAt: z.string().datetime().optional(),
    lastActiveAt: z.string().datetime().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracy: z.number().nonnegative().optional()
  })
  .refine(
    (value) =>
      (value.latitude === undefined && value.longitude === undefined) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    { message: 'Latitude and longitude must both be provided together.' }
  );

const AccessQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional()
});

const ReactionMutationSchema = z
  .object({
    emoji: z.string().trim().optional().nullable(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional()
  })
  .refine(
    (value) =>
      (value.latitude === undefined && value.longitude === undefined) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    { message: 'Latitude and longitude must both be provided together.' }
  );

const resolveViewerUser = async (req) => {
  if (!req?.user?.uid) {
    return null;
  }

  try {
    const viewer = await User.findOne({ firebaseUid: req.user.uid });
    return viewer;
  } catch (error) {
    console.error('Failed to resolve viewer user for chats route:', error);
    return null;
  }
};

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

const normalizeRoomName = (value) => `${value ?? ''}`.trim().toLowerCase();

const resolveCoordinateKey = (room) => {
  const coordinates = room?.coordinates?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
};

const pickPreferredRoom = (current, candidate) => {
  if (!current) {
    return candidate;
  }
  if (!candidate) {
    return current;
  }

  const currentHasPreset = Boolean(current?.presetKey && `${current.presetKey}`.trim());
  const candidateHasPreset = Boolean(candidate?.presetKey && `${candidate.presetKey}`.trim());

  if (currentHasPreset !== candidateHasPreset) {
    return candidateHasPreset ? candidate : current;
  }

  const toMillis = (value) => {
    if (value instanceof Date) {
      return value.getTime();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  const currentUpdated = toMillis(current.updatedAt || current.createdAt);
  const candidateUpdated = toMillis(candidate.updatedAt || candidate.createdAt);

  return candidateUpdated > currentUpdated ? candidate : current;
};

const dedupeRooms = (rooms) => {
  if (!Array.isArray(rooms)) {
    return [];
  }

  const byPreset = new Map();
  const byFallback = new Map();

  for (const room of rooms) {
    if (!room) {
      continue;
    }

    const presetKey =
      room.presetKey && room.presetKey.trim ? room.presetKey.trim() : room.presetKey;

    if (presetKey) {
      byPreset.set(presetKey, pickPreferredRoom(byPreset.get(presetKey), room));
      continue;
    }

    const nameKey = normalizeRoomName(room.name);
    const coordinateKey = resolveCoordinateKey(room) ?? '';
    const fallbackKey = `${nameKey}|${coordinateKey}`;
    byFallback.set(fallbackKey, pickPreferredRoom(byFallback.get(fallbackKey), room));
  }

  const fallbackRooms = [...byFallback.values()].filter((room) => {
    const presetKey =
      room?.presetKey && room.presetKey.trim ? room.presetKey.trim() : room?.presetKey;
    return !presetKey || !byPreset.has(presetKey);
  });

  return [...byPreset.values(), ...fallbackRooms];
};

async function fetchViewerBookmarks(viewerId) {
  const records = await Bookmark.find({ userId: viewerId }).select('pinId').lean();
  const set = new Set();
  for (const record of records) {
    const pinId = toIdString(record?.pinId);
    if (pinId) {
      set.add(pinId);
    }
  }
  return set;
}

async function resolveViewerCoordinates({ viewerId, latitude, longitude }) {
  if (latitude !== undefined && longitude !== undefined) {
    return { latitude, longitude, source: 'query' };
  }

  const latest = await Location.findOne({ userId: viewerId })
    .sort({ lastSeenAt: -1, createdAt: -1 })
    .lean();

  if (!latest?.coordinates?.coordinates || latest.coordinates.coordinates.length < 2) {
    return null;
  }

  const [storedLongitude, storedLatitude] = latest.coordinates.coordinates;
  if (!Number.isFinite(storedLatitude) || !Number.isFinite(storedLongitude)) {
    return null;
  }

  return {
    latitude: storedLatitude,
    longitude: storedLongitude,
    source: 'latest-location',
    accuracy: latest.accuracy ?? undefined
  };
}

async function buildViewerAccessContext({ viewer, latitude, longitude, includeBookmarked = true }) {
  const viewerId = toIdString(viewer._id);
  const coordinates = await resolveViewerCoordinates({ viewerId, latitude, longitude });
  let bookmarkedPinIds = new Set();
  if (includeBookmarked) {
    bookmarkedPinIds = await fetchViewerBookmarks(viewer._id);
  }
  return {
    viewerId,
    coordinates,
    bookmarkedPinIds
  };
}

const isViewerParticipant = (roomDoc, viewerId) => {
  if (!viewerId) {
    return false;
  }
  if (toIdString(roomDoc.ownerId) === viewerId) {
    return true;
  }
  const moderators = mapIdList(roomDoc.moderatorIds);
  if (moderators.includes(viewerId)) {
    return true;
  }
  const participants = mapIdList(roomDoc.participantIds);
  return participants.includes(viewerId);
};

const evaluateRoomAccess = (roomDoc, { viewerId, coordinates, bookmarkedPinIds }) => {
  const pinId = toIdString(roomDoc.pinId);
  const isBookmarked = Boolean(pinId && bookmarkedPinIds && bookmarkedPinIds.has(pinId));
  const participant = isViewerParticipant(roomDoc, viewerId);

  if (roomDoc.isGlobal) {
    return { allowed: true, reason: 'global', distanceMeters: null };
  }

  if (participant) {
    return { allowed: true, reason: 'participant', distanceMeters: null };
  }

  if (isBookmarked) {
    return { allowed: true, reason: 'bookmarked', distanceMeters: null };
  }

  if (!coordinates) {
    const isDebug = String(process.env.PINPOINT_RUNTIME_MODE).toLowerCase() === 'offline';
    if (isDebug) {
      return {
        allowed: true,
        reason: 'within-radius',
        distanceMeters: 0
      };
    }
    return { allowed: false, reason: 'no-location', distanceMeters: null };
  }

  const roomCoordinates = roomDoc.coordinates?.coordinates;
  if (!Array.isArray(roomCoordinates) || roomCoordinates.length < 2) {
    return { allowed: false, reason: 'invalid-room-coordinates', distanceMeters: null };
  }

  const [roomLongitude, roomLatitude] = roomCoordinates;
  if (!Number.isFinite(roomLatitude) || !Number.isFinite(roomLongitude)) {
    return { allowed: false, reason: 'invalid-room-coordinates', distanceMeters: null };
  }

  const distanceMeters = haversineDistanceMeters(
    coordinates.latitude,
    coordinates.longitude,
    roomLatitude,
    roomLongitude
  );

  if (!Number.isFinite(distanceMeters)) {
    return { allowed: false, reason: 'invalid-distance', distanceMeters: null };
  }

  const withinRadius = distanceMeters <= (roomDoc.radiusMeters ?? 0);
  return {
    allowed: withinRadius,
    reason: withinRadius ? 'within-radius' : 'outside-radius',
    distanceMeters
  };
};

const buildAccessDeniedMessage = (reason) => {
  switch (reason) {
    case 'no-location':
      return 'Share your location to browse nearby chat rooms.';
    case 'invalid-room-coordinates':
    case 'invalid-distance':
      return 'Chat room location data is unavailable.';
    case 'outside-radius':
      return 'You are outside this chat room\'s interaction radius.';
    default:
      return 'You are not permitted to access this chat room.';
  }
};

router.get('/gif-search', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const queryParam =
      typeof req.query.q === 'string'
        ? req.query.q
        : typeof req.query.query === 'string'
          ? req.query.query
          : '';
    const query = `${queryParam}`.trim();
    if (!query) {
      return res.status(400).json({ message: 'Enter a search term to find a GIF.' });
    }

    const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitValue = Number.parseInt(limitRaw, 10);
    const limit = Number.isFinite(limitValue) ? limitValue : undefined;

    const result = await searchGifAttachments(query, { limit });
    if (!result.ok) {
      const status =
        result.reason === 'missing-api-key' || result.reason === 'api-error' ? 503 : 400;
      const message =
        result.reason === 'missing-api-key'
          ? 'GIF search is not configured for this environment.'
          : result.reason === 'no-results'
            ? `No GIFs found for "${query}".`
            : result.message || 'Unable to fetch GIFs right now.';
      return res.status(status).json({ message });
    }

    const payload = result.results.map((entry) => ({
      id: entry.id,
      attachment: entry.attachment,
      sourceUrl: entry.sourceUrl
    }));

    res.json({ query, results: payload });
  } catch (error) {
    console.error('Failed to search GIFs:', error);
    res.status(500).json({ message: 'Failed to search for GIFs.' });
  }
});

router.post('/rooms', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const input = CreateRoomRequestSchema.parse(req.body);
    const viewerId = viewer._id.toString();
    const participantIds = new Set([viewerId]);

    const payload = await createRoom({
      ownerId: viewerId,
      name: input.name,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      radiusMeters: input.radiusMeters,
      pinId: input.pinId,
      presetKey: input.presetKey,
      participantIds: Array.from(participantIds),
      moderatorIds: [viewerId],
      isGlobal: input.isGlobal
    });

    res.status(201).json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid chat room payload', issues: error.errors });
    }
    console.error('Failed to create chat room:', error);
    res.status(500).json({ message: 'Failed to create chat room' });
  }
});

router.post('/rooms/:roomId/messages', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { roomId } = RoomIdSchema.parse(req.params);
    const input = CreateMessageRequestSchema.parse(req.body);
    const room = await ProximityChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    const accessContext = await buildViewerAccessContext({
      viewer,
      latitude: input.latitude,
      longitude: input.longitude,
      includeBookmarked: true
    });
    const access = evaluateRoomAccess(room, accessContext);
    if (!access.allowed) {
      return res
        .status(403)
        .json({ message: buildAccessDeniedMessage(access.reason) });
    }

    const trimmedMessage = input.message.trim();
    const isGifCommand = trimmedMessage.toLowerCase().startsWith('/gif');

    let messageForStorage = input.message;
    let attachments = Array.isArray(input.attachments) ? input.attachments : [];

    if (isGifCommand) {
      const query = trimmedMessage.slice(4).trim();
      if (!query) {
        return res
          .status(400)
          .json({ message: 'Usage: /gif <search term>' });
      }

      messageForStorage = `GIF: ${query}`;
      if (!attachments.length) {
        const gifResult = await fetchGifAttachment(query);
        if (!gifResult.ok) {
          const status =
            gifResult.reason === 'missing-api-key' || gifResult.reason === 'api-error'
              ? 503
              : 400;
          let message = 'Unable to send GIF right now.';
          if (gifResult.reason === 'missing-api-key') {
            message = 'GIF search is not configured for this environment.';
          } else if (gifResult.reason === 'no-results') {
            message = `No GIFs found for "${query}".`;
          } else if (gifResult.reason === 'empty-query') {
            message = 'Enter a search term after /gif (e.g., "/gif cats").';
          } else if (gifResult.message) {
            message = gifResult.message;
          }
          return res.status(status).json({ message });
        }

        attachments = gifResult.attachment ? [gifResult.attachment] : [];
      }
    }

    const profanityCount = countProfanityInstances(messageForStorage);
    const sanitizedMessage = replaceProfanityWithFruit(messageForStorage);

    const { messageDoc, response } = await createMessage(
      {
        roomId,
        authorId: viewer._id.toString(),
        message: sanitizedMessage,
        pinId: input.pinId,
        replyToMessageId: input.replyToMessageId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        attachments
      },
      { viewerId: viewer._id.toString() }
    );

    let chatBadgeResult = null;
    try {
      chatBadgeResult = await grantBadge({
        userId: viewer._id,
        badgeId: 'chat-first-message',
        sourceUserId: viewer._id
      });
    } catch (error) {
      console.error('Failed to grant chat badge:', error);
    }

    if (chatBadgeResult?.granted) {
      response.badgeEarnedId = chatBadgeResult.badge.id;
    }

    response.message = messageDoc.message;
    if (attachments.length && !response.imageUrl) {
      response.imageUrl = attachments[0]?.url;
    }

    if (profanityCount > 0) {
      try {
        await User.updateOne(
          { _id: viewer._id },
          { $inc: { 'stats.cussCount': profanityCount } }
        );
      } catch (error) {
        console.error('Failed to increment cuss count for user', viewer._id, error);
      }
    }

    res.status(201).json(response);

    broadcastChatMessage({
      room,
      message: messageDoc,
      author: viewer
    }).catch((error) => {
      console.error('Failed to queue chat message updates:', error);
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid chat message payload', issues: error.errors });
    }
    console.error('Failed to create chat message:', error);
    res.status(500).json({ message: 'Failed to create chat message' });
  }
});

router.patch('/rooms/:roomId/messages/:messageId/reactions', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { roomId, messageId } = MessageIdSchema.parse(req.params);
    const input = ReactionMutationSchema.parse(req.body);
    const desiredReaction = normalizeReactionInput(input.emoji);
    if (input.emoji !== undefined && input.emoji !== null && !desiredReaction) {
      return res.status(400).json({ message: 'Unsupported reaction emoji.' });
    }

    const room = await ProximityChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    const accessContext = await buildViewerAccessContext({
      viewer,
      latitude: input.latitude,
      longitude: input.longitude,
      includeBookmarked: true
    });
    const access = evaluateRoomAccess(room, accessContext);
    if (!access.allowed) {
      return res
        .status(403)
        .json({ message: buildAccessDeniedMessage(access.reason) });
    }

    const message = await ProximityChatMessage.findOne({ _id: messageId, roomId }).populate({
      path: 'authorId',
      select: 'username displayName roles accountStatus avatar stats relationships.blockedUserIds'
    });
    if (!message) {
      return res.status(404).json({ message: 'Chat message not found' });
    }

    const viewerIdString = toIdString(viewer._id);
    const countsMap =
      message.reactionCounts instanceof Map
        ? message.reactionCounts
        : new Map(Object.entries(message.reactionCounts || {}));
    const reactionsByUserMap =
      message.reactionsByUser instanceof Map
        ? message.reactionsByUser
        : new Map(Object.entries(message.reactionsByUser || {}));

    const rawExisting = viewerIdString
      ? reactionsByUserMap.get
        ? reactionsByUserMap.get(viewerIdString)
        : reactionsByUserMap[viewerIdString]
      : null;
    const existingSet = new Set(
      Array.isArray(rawExisting)
        ? rawExisting
        : typeof rawExisting === 'string' && rawExisting
          ? [rawExisting]
          : []
    );

    if (desiredReaction) {
      if (existingSet.has(desiredReaction)) {
        const prevCount = Number(
          countsMap.get ? countsMap.get(desiredReaction) : countsMap[desiredReaction]
        );
        const nextCount = Math.max(0, Number.isFinite(prevCount) ? prevCount - 1 : 0);
        if (countsMap.set) {
          countsMap.set(desiredReaction, nextCount);
        } else {
          countsMap[desiredReaction] = nextCount;
        }
        existingSet.delete(desiredReaction);
      } else {
        const current = Number(
          countsMap.get ? countsMap.get(desiredReaction) : countsMap[desiredReaction]
        );
        const nextCount = Math.max(0, Number.isFinite(current) ? current : 0) + 1;
        if (countsMap.set) {
          countsMap.set(desiredReaction, nextCount);
        } else {
          countsMap[desiredReaction] = nextCount;
        }
        existingSet.add(desiredReaction);
      }
    }

    const nextViewerReactions = Array.from(existingSet).filter(
      (value) => typeof value === 'string' && value.trim()
    );
    if (nextViewerReactions.length) {
      if (reactionsByUserMap.set) {
        reactionsByUserMap.set(viewerIdString, nextViewerReactions);
      } else {
        reactionsByUserMap[viewerIdString] = nextViewerReactions;
      }
    } else if (viewerIdString) {
      reactionsByUserMap.delete
        ? reactionsByUserMap.delete(viewerIdString)
        : delete reactionsByUserMap[viewerIdString];
    }

    const normalizedCounts = {};
    if (countsMap.forEach) {
      countsMap.forEach((raw, key) => {
        const value = Number(raw);
        if (typeof key === 'string' && key && Number.isFinite(value) && value > 0) {
          normalizedCounts[key] = value;
        }
      });
    } else {
      Object.entries(countsMap || {}).forEach(([key, raw]) => {
        const value = Number(raw);
        if (typeof key === 'string' && key && Number.isFinite(value) && value > 0) {
          normalizedCounts[key] = value;
        }
      });
    }
    const normalizedReactionsByUser = {};
    if (reactionsByUserMap.forEach) {
      reactionsByUserMap.forEach((value, key) => {
        if (!key) return;
        const list = Array.isArray(value)
          ? value
          : typeof value === 'string'
            ? [value]
            : [];
        const filtered = list.filter((entry) => typeof entry === 'string' && entry.trim());
        if (filtered.length) normalizedReactionsByUser[key] = filtered;
      });
    } else {
      Object.entries(reactionsByUserMap || {}).forEach(([key, value]) => {
        if (!key) return;
        const list = Array.isArray(value)
          ? value
          : typeof value === 'string'
            ? [value]
            : [];
        const filtered = list.filter((entry) => typeof entry === 'string' && entry.trim());
        if (filtered.length) normalizedReactionsByUser[key] = filtered;
      });
    }

    message.reactionCounts = normalizedCounts;
    message.reactionsByUser = normalizedReactionsByUser;
    message.markModified('reactionCounts');
    message.markModified('reactionsByUser');
    await message.save();

    const payload = mapMessage(message, { viewerId: viewerIdString });
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid reaction payload', issues: error.errors });
    }
    console.error('Failed to toggle chat reaction:', error);
    res.status(500).json({ message: 'Failed to update reaction' });
  }
});

router.post('/rooms/:roomId/presence', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { roomId } = RoomIdSchema.parse(req.params);
    const input = CreatePresenceRequestSchema.parse(req.body);
    const room = await ProximityChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    const existingPresences = await ProximityChatPresence.find({ userId: viewer._id });
    const currentPresence = existingPresences.find((presence) =>
      presence.roomId && presence.roomId.equals(room._id)
    );

    const accessContext = await buildViewerAccessContext({
      viewer,
      latitude: input.latitude,
      longitude: input.longitude,
      includeBookmarked: true
    });
    const access = evaluateRoomAccess(room, accessContext);
    if (!access.allowed) {
      return res
        .status(403)
        .json({ message: buildAccessDeniedMessage(access.reason) });
    }

    const coordinates =
      input.latitude !== undefined && input.longitude !== undefined
        ? { latitude: input.latitude, longitude: input.longitude }
        : null;

    const payload = await upsertPresence({
      roomId,
      userId: viewer._id.toString(),
      sessionId: input.sessionId,
      joinedAt: input.joinedAt,
      lastActiveAt: input.lastActiveAt
    });

    if (!currentPresence) {
      await broadcastChatRoomTransition({
        userId: viewer._id,
        fromRoom: null,
        toRoom: room,
        distanceMeters: access.distanceMeters,
        coordinates
      });
    }

    res.status(201).json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid chat presence payload', issues: error.errors });
    }
    console.error('Failed to upsert chat presence:', error);
    res.status(500).json({ message: 'Failed to update chat presence' });
  }
});

router.get('/rooms', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const query = RoomQuerySchema.parse(req.query);
    const criteria = {};
    if (query.pinId) {
      if (!mongoose.Types.ObjectId.isValid(query.pinId)) {
        return res.status(400).json({ message: 'Invalid pin id' });
      }
      criteria.pinId = query.pinId;
    }
    if (query.ownerId) {
      if (!mongoose.Types.ObjectId.isValid(query.ownerId)) {
        return res.status(400).json({ message: 'Invalid owner id' });
      }
      criteria.ownerId = query.ownerId;
    }

    const includeBookmarked = parseBooleanParam(query.includeBookmarked, true);
    const adminViewRequested = parseBooleanParam(query.adminView, false);
    const viewerIsPrivileged = adminViewRequested && canViewerModeratePins(viewer);

    const roomsTimingLabel = `chat:rooms:query:${viewer._id}:${Date.now()}`;
    if (ENABLE_QUERY_TIMERS) {
      console.time(roomsTimingLabel);
    }
    let rooms;
    try {
      rooms = await ProximityChatRoom.find(criteria).sort({ updatedAt: -1 });
    } finally {
      if (ENABLE_QUERY_TIMERS) {
        console.timeEnd(roomsTimingLabel);
      }
    }

    const accessContext = await buildViewerAccessContext({
      viewer,
      latitude: query.latitude,
      longitude: query.longitude,
      includeBookmarked
    });

    const filtered = viewerIsPrivileged
      ? rooms
      : rooms.filter((room) => evaluateRoomAccess(room, accessContext).allowed);
    const deduped = dedupeRooms(filtered);
    const payload = deduped.map(mapRoom);
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid room query', issues: error.errors });
    }
    console.error('Failed to load chat rooms:', error);
    res.status(500).json({ message: 'Failed to load chat rooms' });
  }
});

router.get('/rooms/:roomId/messages', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { roomId } = RoomIdSchema.parse(req.params);
    const room = await ProximityChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    const query = AccessQuerySchema.parse(req.query);
    const accessContext = await buildViewerAccessContext({
      viewer,
      latitude: query.latitude,
      longitude: query.longitude,
      includeBookmarked: true
    });
    const access = evaluateRoomAccess(room, accessContext);
    if (!access.allowed) {
      return res
        .status(403)
        .json({ message: buildAccessDeniedMessage(access.reason) });
    }

    const viewerBlockedIds = buildBlockedSet(viewer);
    const viewerIdString = toIdString(viewer._id);

    const messagesTimingLabel = `chat:messages:query:${roomId}:${Date.now()}`;
    if (ENABLE_QUERY_TIMERS) {
      console.time(messagesTimingLabel);
    }
    let messages;
    try {
      messages = await ProximityChatMessage.find({ roomId })
        .sort({ createdAt: 1 })
        .populate({
          path: 'authorId',
          select: 'username displayName roles accountStatus avatar stats relationships.blockedUserIds'
        });
    } finally {
      if (ENABLE_QUERY_TIMERS) {
        console.timeEnd(messagesTimingLabel);
      }
    }

    const filteredMessages = messages.filter((message) => {
      const authorDoc = message.authorId;
      const authorIdString = toIdString(authorDoc?._id || authorDoc);
      if (!authorIdString) {
        return true;
      }
      if (viewerBlockedIds.has(authorIdString)) {
        return false;
      }
      const authorBlockedSet = buildBlockedSet(authorDoc);
      if (authorBlockedSet.has(viewerIdString)) {
        return false;
      }
      return true;
    });

    const payload = filteredMessages.map((message) =>
      mapMessage(message, { viewerId: viewerIdString })
    );
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid room id', issues: error.errors });
    }
    console.error('Failed to load chat messages:', error);
    res.status(500).json({ message: 'Failed to load chat messages' });
  }
});

router.get('/rooms/:roomId/presence', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { roomId } = RoomIdSchema.parse(req.params);
    const room = await ProximityChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    const query = AccessQuerySchema.parse(req.query);
    const accessContext = await buildViewerAccessContext({
      viewer,
      latitude: query.latitude,
      longitude: query.longitude,
      includeBookmarked: true
    });
    const access = evaluateRoomAccess(room, accessContext);
    if (!access.allowed) {
      return res
        .status(403)
        .json({ message: buildAccessDeniedMessage(access.reason) });
    }

    const presences = await ProximityChatPresence.find({ roomId });

    const viewerBlockedIds = buildBlockedSet(viewer);
    const viewerIdString = toIdString(viewer._id);

    const participantIds = new Set(presences.map((presence) => toIdString(presence.userId)));
    const participantDocs = await User.find({ _id: { $in: toObjectIdList(participantIds) } })
      .select({ relationships: 1 })
      .lean();
    const participantMap = new Map(
      participantDocs.map((doc) => [toIdString(doc._id), doc])
    );

    const filteredPresences = presences.filter((presence) => {
      const userIdString = toIdString(presence.userId);
      if (!userIdString) {
        return true;
      }
      if (viewerBlockedIds.has(userIdString)) {
        return false;
      }
      const participantDoc = participantMap.get(userIdString);
      if (!participantDoc) {
        return true;
      }
      const participantBlocked = buildBlockedSet(participantDoc);
      if (participantBlocked.has(viewerIdString)) {
        return false;
      }
      return true;
    });

    const payload = filteredPresences.map(mapPresence);
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid room id', issues: error.errors });
    }
    console.error('Failed to load presence list:', error);
    res.status(500).json({ message: 'Failed to load presence list' });
  }
});

module.exports = router;
