const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const User = require('../models/User');
const Pin = require('../models/Pin');
const { PublicUserSchema, UserProfileSchema } = require('../schemas/user');
const { PinListItemSchema } = require('../schemas/pin');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const UsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

const PinQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20)
});

const toIdString = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value._id) return value._id.toString();
  return String(value);
};

const mapUserToPublic = (userDoc) => {
  const doc = userDoc.toObject ? userDoc.toObject() : userDoc;
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

const mapUserToProfile = (userDoc) => {
  const doc = userDoc.toObject();
  return UserProfileSchema.parse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar: doc.avatar || undefined,
    stats: doc.stats || undefined,
    badges: doc.badges || [],
    primaryLocationId: toIdString(doc.primaryLocationId),
    accountStatus: doc.accountStatus || 'active',
    email: doc.email || undefined,
    bio: doc.bio || undefined,
    banner: doc.banner || undefined,
    preferences: doc.preferences || undefined,
    relationships: doc.relationships || undefined,
    locationSharingEnabled: Boolean(doc.locationSharingEnabled),
    pinnedPinIds: (doc.pinnedPinIds || []).map(toIdString),
    ownedPinIds: (doc.ownedPinIds || []).map(toIdString),
    bookmarkCollectionIds: (doc.bookmarkCollectionIds || []).map(toIdString),
    proximityChatRoomIds: (doc.proximityChatRoomIds || []).map(toIdString),
    recentLocationIds: (doc.recentLocationIds || []).map(toIdString),
    createdAt: userDoc.createdAt.toISOString(),
    updatedAt: userDoc.updatedAt.toISOString(),
    audit: undefined
  });
};

const mapPinToListItem = (pinDoc, creator) => {
  const doc = pinDoc.toObject();
  return PinListItemSchema.parse({
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
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : undefined,
    distanceMeters: undefined,
    isBookmarked: undefined,
    replyCount: doc.replyCount ?? undefined,
    stats: doc.stats || undefined
  });
};

router.get('/', verifyToken, async (req, res) => {
  try {
    const query = UsersQuerySchema.parse(req.query);
    const criteria = {};
    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      criteria.$or = [{ username: regex }, { displayName: regex }];
    }

    const users = await User.find(criteria)
      .sort({ updatedAt: -1 })
      .limit(query.limit);

    const payload = users.map(mapUserToPublic);
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid user query', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load users' });
  }
});

router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const payload = mapUserToProfile(user);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load user profile' });
  }
});

router.get('/:userId/pins', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const query = PinQuerySchema.parse(req.query);

    const pins = await Pin.find({ creatorId: userId })
      .sort({ updatedAt: -1 })
      .limit(query.limit);

    const creator = await User.findById(userId);
    const creatorPublic = creator ? mapUserToPublic(creator) : undefined;

    const list = pins.map((pin) => mapPinToListItem(pin, creatorPublic));
    res.json(list);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin query', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load user pins' });
  }
});

module.exports = router;
