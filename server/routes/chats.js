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
const { broadcastChatMessage } = require('../services/updateFanoutService');
const { grantBadge } = require('../services/badgeService');

const router = express.Router();

const RoomQuerySchema = z.object({
  pinId: z.string().optional(),
  ownerId: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  includeBookmarked: z
    .union([z.boolean(), z.string().transform((value) => value.toLowerCase() !== 'false')])
    .optional()
});

const RoomIdSchema = z.object({
  roomId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid room id'
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
    accuracy: z.number().nonnegative().optional()
  })
  .refine(
    (value) =>
      (value.latitude === undefined && value.longitude === undefined) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    { message: 'Latitude and longitude must both be provided together.' }
  );

const CreatePresenceRequestSchema = z.object({
  sessionId: ObjectIdString.optional(),
  joinedAt: z.string().datetime().optional(),
  lastActiveAt: z.string().datetime().optional()
});

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

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value._id) return value._id.toString();
  return String(value);
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
  const moderators = Array.isArray(roomDoc.moderatorIds)
    ? roomDoc.moderatorIds.map((id) => toIdString(id))
    : [];
  if (moderators.includes(viewerId)) {
    return true;
  }
  const participants = Array.isArray(roomDoc.participantIds)
    ? roomDoc.participantIds.map((id) => toIdString(id))
    : [];
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

    const { messageDoc, response } = await createMessage({
      roomId,
      authorId: viewer._id.toString(),
      message: input.message,
      pinId: input.pinId,
      replyToMessageId: input.replyToMessageId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy
    });

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

    const accessContext = await buildViewerAccessContext({
      viewer,
      includeBookmarked: true
    });
    const access = evaluateRoomAccess(room, accessContext);
    if (!access.allowed) {
      return res
        .status(403)
        .json({ message: buildAccessDeniedMessage(access.reason) });
    }

    const payload = await upsertPresence({
      roomId,
      userId: viewer._id.toString(),
      sessionId: input.sessionId,
      joinedAt: input.joinedAt,
      lastActiveAt: input.lastActiveAt
    });

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

    const includeBookmarked =
      query.includeBookmarked === undefined ? true : Boolean(query.includeBookmarked);

    const rooms = await ProximityChatRoom.find(criteria).sort({ updatedAt: -1 });

    const accessContext = await buildViewerAccessContext({
      viewer,
      latitude: query.latitude,
      longitude: query.longitude,
      includeBookmarked
    });

    const filtered = rooms.filter((room) => evaluateRoomAccess(room, accessContext).allowed);
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

    const accessContext = await buildViewerAccessContext({
      viewer,
      includeBookmarked: true
    });
    const access = evaluateRoomAccess(room, accessContext);
    if (!access.allowed) {
      return res
        .status(403)
        .json({ message: buildAccessDeniedMessage(access.reason) });
    }

    const messages = await ProximityChatMessage.find({ roomId })
      .sort({ createdAt: 1 })
      .populate('authorId');

    const payload = messages.map((message) => mapMessage(message));
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

    const accessContext = await buildViewerAccessContext({
      viewer,
      includeBookmarked: true
    });
    const access = evaluateRoomAccess(room, accessContext);
    if (!access.allowed) {
      return res
        .status(403)
        .json({ message: buildAccessDeniedMessage(access.reason) });
    }

    const presences = await ProximityChatPresence.find({ roomId });
    const payload = presences.map(mapPresence);
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

