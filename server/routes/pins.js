const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const Pin = require('../models/Pin');
const Reply = require('../models/Reply');
const { PinListItemSchema, PinSchema, PinPreviewSchema } = require('../schemas/pin');
const { PinReplySchema } = require('../schemas/reply');
const { PublicUserSchema } = require('../schemas/user');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const PinsQuerySchema = z.object({
  type: z.enum(['event', 'discussion']).optional(),
  creatorId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

const PinIdSchema = z.object({
  pinId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid pin id'
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

const mapPinToListItem = (pinDoc, creator) => {
  const preview = mapPinPreview(pinDoc, creator);
  return PinListItemSchema.parse({
    ...preview,
    distanceMeters: undefined,
    isBookmarked: undefined,
    replyCount: pinDoc.replyCount ?? undefined,
    stats: pinDoc.stats || undefined
  });
};

const mapPinToFull = (pinDoc, creator) => {
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
    photos: doc.photos || [],
    coverPhoto: doc.coverPhoto || undefined,
    tagIds: (doc.tagIds || []).map(toIdString),
    tags: doc.tags || [],
    relatedPinIds: (doc.relatedPinIds || []).map(toIdString),
    linkedLocationId: toIdString(doc.linkedLocationId),
    linkedChatRoomId: toIdString(doc.linkedChatRoomId),
    visibility: doc.visibility,
    isActive: doc.isActive,
    stats: doc.stats || undefined,
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
    base.attendingUserIds = (doc.attendingUserIds || []).map(toIdString);
    base.attendeeWaitlistIds = (doc.attendeeWaitlistIds || []).map(toIdString);
    base.attendable = doc.attendable ?? true;
  }

  if (doc.type === 'discussion') {
    base.approximateAddress = doc.approximateAddress || undefined;
    base.expiresAt = doc.expiresAt ? doc.expiresAt.toISOString() : undefined;
    base.autoDelete = doc.autoDelete ?? true;
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
    mentionedUserIds: (doc.mentionedUserIds || []).map(toIdString),
    createdAt: replyDoc.createdAt.toISOString(),
    updatedAt: replyDoc.updatedAt.toISOString(),
    audit: doc.audit ? buildAudit(doc.audit, replyDoc.createdAt, replyDoc.updatedAt) : undefined
  });
};

router.get('/', verifyToken, async (req, res) => {
  try {
    const query = PinsQuerySchema.parse(req.query);
    const criteria = {};
    if (query.type) {
      criteria.type = query.type;
    }
    if (query.creatorId) {
      if (!mongoose.Types.ObjectId.isValid(query.creatorId)) {
        return res.status(400).json({ message: 'Invalid creator id' });
      }
      criteria.creatorId = query.creatorId;
    }

    const pins = await Pin.find(criteria)
      .sort({ updatedAt: -1 })
      .limit(query.limit)
      .populate('creatorId');

    const payload = pins.map((pin) => {
      const creatorPublic = mapUserToPublic(pin.creatorId);
      return mapPinToListItem(pin, creatorPublic);
    });

    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin query', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load pins' });
  }
});

router.get('/:pinId', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const pin = await Pin.findById(pinId).populate('creatorId');
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    const payload = mapPinToFull(pin, mapUserToPublic(pin.creatorId));
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin id', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load pin' });
  }
});

router.get('/:pinId/replies', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const replies = await Reply.find({ pinId })
      .sort({ createdAt: 1 })
      .populate('authorId');

    const payload = replies.map((reply) => mapReply(reply, mapUserToPublic(reply.authorId)));
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin id', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load replies' });
  }
});

module.exports = router;
