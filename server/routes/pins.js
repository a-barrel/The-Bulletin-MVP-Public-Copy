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

const toIdString = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value._id) return value._id.toString();
  return String(value);
};

const METERS_PER_MILE = 1609.34;

const mapUserToPublic = (user) => {
  if (!user) return undefined;
  const doc = user.toObject ? user.toObject() : user;
  const avatar = doc.avatar ? mapMediaAssetResponse(doc.avatar) : undefined;
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
    photos: Array.isArray(doc.photos) ? doc.photos.map(mapMediaAssetResponse) : [],
    coverPhoto: mapMediaAssetResponse(doc.coverPhoto),
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
    if (options.viewerId) {
      const viewerId = options.viewerId;
      base.viewerIsAttending = (doc.attendingUserIds || []).some(
        (id) => toIdString(id) === viewerId
      );
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

const normaliseMediaAsset = (asset, uploadedBy) => ({
  url: asset.url,
  width: asset.width,
  height: asset.height,
  mimeType: asset.mimeType ?? 'image/jpeg',
  description: asset.description,
  uploadedAt: new Date(),
  uploadedBy
});

const mapMediaAssetResponse = (asset) => {
  if (!asset) {
    return undefined;
  }

  const doc = asset.toObject ? asset.toObject() : asset;
  return {
    url: doc.url,
    thumbnailUrl: doc.thumbnailUrl || undefined,
    width: doc.width ?? undefined,
    height: doc.height ?? undefined,
    mimeType: doc.mimeType || undefined,
    description: doc.description || undefined,
    uploadedAt: doc.uploadedAt ? doc.uploadedAt.toISOString() : undefined,
    uploadedBy: doc.uploadedBy ? toIdString(doc.uploadedBy) : undefined
  };
};

const NearbyPinsQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  distanceMiles: z.coerce.number().positive().max(250),
  limit: z.coerce.number().int().positive().max(50).default(20),
  type: z.enum(['event', 'discussion']).optional()
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
  photos: z.array(MediaAssetInputSchema).max(10).optional(),
  coverPhoto: MediaAssetInputSchema.optional()
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

    if (input.type === 'event' && input.endDate < input.startDate) {
      return res.status(400).json({ message: 'endDate must be after startDate' });
    }

    let creatorObjectId;
    if (input.creatorId) {
      if (!mongoose.Types.ObjectId.isValid(input.creatorId)) {
        return res.status(400).json({ message: 'Invalid creator id' });
      }
      creatorObjectId = new mongoose.Types.ObjectId(input.creatorId);
    } else {
      let fallbackUser = await User.findOne().sort({ createdAt: 1 });
      if (!fallbackUser) {
        fallbackUser = await User.findOneAndUpdate(
          { username: 'offline-demo' },
          {
            username: 'offline-demo',
            displayName: 'Offline Demo User',
            email: 'offline@example.com',
            accountStatus: 'active'
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      }
      creatorObjectId = fallbackUser._id;
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
      visibility: 'public'
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
    const hydrated = await Pin.findById(pin._id).populate('creatorId');
    const sourcePin = hydrated ?? pin;
    const creatorPublic = hydrated ? mapUserToPublic(hydrated.creatorId) : undefined;
    const viewer = await resolveViewerUser(req);
    const viewerId = viewer ? toIdString(viewer._id) : undefined;
    const payload = mapPinToFull(sourcePin, creatorPublic, {
      viewerId,
      viewerHasBookmarked: false
    });
    res.status(201).json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin payload', issues: error.errors });
    }
    console.error('Failed to create pin:', error);
    res.status(500).json({ message: 'Failed to create pin' });
  }
});

router.get('/nearby', verifyToken, async (req, res) => {
  try {
    const { latitude, longitude, distanceMiles, limit, type } = NearbyPinsQuerySchema.parse(req.query);
    const maxDistanceMeters = distanceMiles * METERS_PER_MILE;

    const geoQuery = {
      coordinates: {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: maxDistanceMeters
        }
      }
    };

    if (type) {
      geoQuery.type = type;
    }

    const pins = await Pin.find(geoQuery)
      .limit(limit)
      .populate('creatorId');

    const payload = pins.map((pinDoc) => {
      const creatorPublic = mapUserToPublic(pinDoc.creatorId);
      const listItem = mapPinToListItem(pinDoc, creatorPublic);
      const [pinLongitude, pinLatitude] = pinDoc.coordinates.coordinates;
      const distanceMeters = haversineDistanceMeters(latitude, longitude, pinLatitude, pinLongitude);
      return {
        ...listItem,
        distanceMeters
      };
    });

    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid nearby pins query', issues: error.errors });
    }
    console.error('Failed to load nearby pins:', error);
    res.status(500).json({ message: 'Failed to load nearby pins' });
  }
});

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

    const viewer = await resolveViewerUser(req);
    const viewerId = viewer ? toIdString(viewer._id) : undefined;
    let viewerHasBookmarked = false;
    if (viewer) {
      const bookmarkExists = await Bookmark.exists({ userId: viewer._id, pinId: pin._id });
      viewerHasBookmarked = Boolean(bookmarkExists);
    }
    const payload = mapPinToFull(pin, mapUserToPublic(pin.creatorId), {
      viewerId,
      viewerHasBookmarked
    });
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

    const pin = await Pin.findById(pinId).populate('creatorId');
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
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

    if (attending) {
      if (!isAlreadyAttending) {
        if (pin.participantLimit && attendeeIds.length >= pin.participantLimit) {
          return res.status(409).json({ message: 'Participant limit reached' });
        }
        pin.attendingUserIds.push(viewer._id);
      }
    } else if (isAlreadyAttending) {
      pin.attendingUserIds = pin.attendingUserIds.filter(
        (id) => toIdString(id) !== viewerId
      );
      pin.markModified('attendingUserIds');
    }

    pin.participantCount = pin.attendingUserIds.length;

    await pin.save();

    const bookmarkExists = await Bookmark.exists({ userId: viewer._id, pinId: pin._id });
    const payload = mapPinToFull(pin, mapUserToPublic(pin.creatorId), {
      viewerId,
      viewerHasBookmarked: Boolean(bookmarkExists)
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

    const attendeeIdStrings = (pin.attendingUserIds || []).map(toIdString).filter(Boolean);
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

router.post('/:pinId/replies', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const input = CreateReplySchema.parse(req.body);

    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const pin = await Pin.findById(pinId);
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    let parentReplyId = undefined;
    if (input.parentReplyId) {
      parentReplyId = new mongoose.Types.ObjectId(input.parentReplyId);
      const parentExists = await Reply.exists({ _id: parentReplyId, pinId });
      if (!parentExists) {
        return res.status(404).json({ message: 'Parent reply not found for this pin' });
      }
    }

    const reply = await Reply.create({
      pinId: pin._id,
      parentReplyId,
      authorId: viewer._id,
      message: input.message.trim(),
      attachments: [],
      mentionedUserIds: []
    });

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

    const populatedReply = await Reply.findById(reply._id).populate('authorId');
    const payload = mapReply(populatedReply ?? reply, mapUserToPublic(populatedReply?.authorId ?? viewer));
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

router.put('/:pinId', verifyToken, async (req, res) => {
  try {
    const { pinId } = PinIdSchema.parse(req.params);
    const input = CreatePinSchema.parse(req.body);

    const pin = await Pin.findById(pinId).populate('creatorId');
    if (!pin) {
      return res.status(404).json({ message: 'Pin not found' });
    }

    if (input.type === 'event' && input.endDate < input.startDate) {
      return res.status(400).json({ message: 'endDate must be after startDate' });
    }

    if (input.type === 'discussion' && input.proximityRadiusMeters && input.proximityRadiusMeters <= 0) {
      return res.status(400).json({ message: 'proximityRadiusMeters must be greater than zero' });
    }

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
    const hydrated = await Pin.findById(pin._id).populate('creatorId');
    const sourcePin = hydrated ?? pin;
    const creatorPublic = hydrated ? mapUserToPublic(hydrated.creatorId) : mapUserToPublic(pin.creatorId);
    const viewer = await resolveViewerUser(req);
    const viewerId = viewer ? toIdString(viewer._id) : undefined;
    let viewerHasBookmarked = false;
    if (viewer) {
      const bookmarkExists = await Bookmark.exists({ userId: viewer._id, pinId: sourcePin._id });
      viewerHasBookmarked = Boolean(bookmarkExists);
    }
    const payload = mapPinToFull(sourcePin, creatorPublic, {
      viewerId,
      viewerHasBookmarked
    });
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid pin payload', issues: error.errors });
    }
    console.error('Failed to update pin:', error);
    res.status(500).json({ message: 'Failed to update pin' });
  }
});

module.exports = router;
