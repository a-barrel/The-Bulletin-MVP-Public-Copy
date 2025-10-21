const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const {
  ProximityChatRoom,
  ProximityChatMessage,
  ProximityChatPresence
} = require('../models/ProximityChat');
const {
  ProximityChatRoomSchema,
  ProximityChatMessageSchema,
  ProximityChatPresenceSchema
} = require('../schemas/proximityChat');
const { PublicUserSchema } = require('../schemas/user');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const RoomQuerySchema = z.object({
  pinId: z.string().optional(),
  ownerId: z.string().optional()
});

const RoomIdSchema = z.object({
  roomId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid room id'
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
  const url = doc.url || doc.thumbnailUrl;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return undefined;
  }

  const payload = {
    url: url.trim(),
    thumbnailUrl: doc.thumbnailUrl || undefined,
    width: doc.width ?? undefined,
    height: doc.height ?? undefined,
    mimeType: doc.mimeType || undefined,
    description: doc.description || undefined,
    uploadedAt: toIsoDateString(doc.uploadedAt),
    uploadedBy: toIdString(doc.uploadedBy)
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null)
  );
};

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

const buildAudit = (audit, createdAt, updatedAt) => ({
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
  createdBy: audit?.createdBy ? toIdString(audit.createdBy) : undefined,
  updatedBy: audit?.updatedBy ? toIdString(audit.updatedBy) : undefined
});

const mapRoom = (roomDoc) => {
  const doc = roomDoc.toObject();
  return ProximityChatRoomSchema.parse({
    _id: toIdString(doc._id),
    ownerId: toIdString(doc.ownerId),
    name: doc.name,
    description: doc.description || undefined,
    coordinates: {
      type: 'Point',
      coordinates: doc.coordinates.coordinates,
      accuracy: doc.coordinates.accuracy ?? undefined
    },
    radiusMeters: doc.radiusMeters,
    isGlobal: Boolean(doc.isGlobal),
    participantCount: doc.participantCount ?? 0,
    participantIds: (doc.participantIds || []).map(toIdString),
    moderatorIds: (doc.moderatorIds || []).map(toIdString),
    pinId: toIdString(doc.pinId),
    createdAt: roomDoc.createdAt.toISOString(),
    updatedAt: roomDoc.updatedAt.toISOString(),
    audit: doc.audit ? buildAudit(doc.audit, roomDoc.createdAt, roomDoc.updatedAt) : undefined
  });
};

const mapMessage = (messageDoc) => {
  const doc = messageDoc.toObject();
  const coordinates = doc.coordinates && Array.isArray(doc.coordinates.coordinates) && doc.coordinates.coordinates.length === 2
    ? {
        type: 'Point',
        coordinates: doc.coordinates.coordinates,
        accuracy: doc.coordinates.accuracy ?? undefined
      }
    : undefined;

  return ProximityChatMessageSchema.parse({
    _id: toIdString(doc._id),
    roomId: toIdString(doc.roomId),
    pinId: toIdString(doc.pinId),
    authorId: toIdString(doc.authorId),
    author: mapUserToPublic(doc.authorId),
    replyToMessageId: toIdString(doc.replyToMessageId),
    message: doc.message,
    coordinates,
    attachments: doc.attachments || [],
    createdAt: messageDoc.createdAt.toISOString(),
    updatedAt: messageDoc.updatedAt.toISOString(),
    audit: doc.audit ? buildAudit(doc.audit, messageDoc.createdAt, messageDoc.updatedAt) : undefined
  });
};

const mapPresence = (presenceDoc) => {
  const doc = presenceDoc.toObject();
  return ProximityChatPresenceSchema.parse({
    roomId: toIdString(doc.roomId),
    userId: toIdString(doc.userId),
    sessionId: toIdString(doc.sessionId),
    joinedAt: doc.joinedAt.toISOString(),
    lastActiveAt: doc.lastActiveAt.toISOString()
  });
};

router.get('/rooms', verifyToken, async (req, res) => {
  try {
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

    const rooms = await ProximityChatRoom.find(criteria).sort({ updatedAt: -1 });
    const payload = rooms.map(mapRoom);
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid room query', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load chat rooms' });
  }
});

router.get('/rooms/:roomId/messages', verifyToken, async (req, res) => {
  try {
    const { roomId } = RoomIdSchema.parse(req.params);
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: 'Invalid room id' });
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
    res.status(500).json({ message: 'Failed to load chat messages' });
  }
});

router.get('/rooms/:roomId/presence', verifyToken, async (req, res) => {
  try {
    const { roomId } = RoomIdSchema.parse(req.params);
    const presences = await ProximityChatPresence.find({ roomId });
    const payload = presences.map(mapPresence);
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid room id', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load presence list' });
  }
});

module.exports = router;

