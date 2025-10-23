const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const {
  ProximityChatRoom,
  ProximityChatMessage,
  ProximityChatPresence
} = require('../models/ProximityChat');
const User = require('../models/User');
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
  ownerId: z.string().optional()
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

    try {
      const room = await ProximityChatRoom.findById(roomId);
      if (room) {
        broadcastChatMessage({
          room,
          message: messageDoc,
          author: viewer
        }).catch((error) => {
          console.error('Failed to queue chat message updates:', error);
        });
      }
    } catch (fanoutError) {
      console.error('Failed to prepare chat message fan-out:', fanoutError);
    }
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

