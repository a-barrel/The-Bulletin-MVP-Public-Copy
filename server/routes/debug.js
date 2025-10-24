const express = require('express');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const { z, ZodError } = require('zod');

const runtime = require('../config/runtime');
const User = require('../models/User');
const { Bookmark, BookmarkCollection } = require('../models/Bookmark');
const Update = require('../models/Update');
const Reply = require('../models/Reply');
const Pin = require('../models/Pin');
const verifyToken = require('../middleware/verifyToken');
const { UserProfileSchema } = require('../schemas/user');
const { BookmarkSchema, BookmarkCollectionSchema } = require('../schemas/bookmark');
const { UpdateSchema } = require('../schemas/update');
const { PinReplySchema } = require('../schemas/reply');
const { PinPreviewSchema } = require('../schemas/pin');
const {
  mapRoom: mapChatRoom,
  mapMessage: mapChatMessage,
  mapPresence: mapChatPresence,
  createRoom: createChatRoomRecord,
  createMessage: createChatMessageRecord,
  upsertPresence: upsertChatPresenceRecord
} = require('../services/proximityChatService');
const {
  listBadges,
  grantBadge,
  revokeBadge,
  resetBadges,
  getBadgeStatusForUser
} = require('../services/badgeService');

const router = express.Router();

const ObjectIdString = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), { message: 'Invalid object id' });

const BadgeQuerySchema = z.object({
  userId: z.string().trim().optional()
});

const BadgeMutationSchema = z.object({
  userId: z.string().trim().optional(),
  badgeId: z.string().trim().min(1)
});

const toObjectId = (value) => (value ? new mongoose.Types.ObjectId(value) : undefined);

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

const resolveViewerUser = async (req) => {
  if (!req?.user?.uid) {
    return null;
  }

  try {
    const viewer = await User.findOne({ firebaseUid: req.user.uid });
    return viewer;
  } catch (error) {
    console.error('Failed to resolve viewer user for debug route:', error);
    return null;
  }
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

const buildAudit = (audit, createdAt, updatedAt) => ({
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
  createdBy: audit?.createdBy ? toIdString(audit.createdBy) : undefined,
  updatedBy: audit?.updatedBy ? toIdString(audit.updatedBy) : undefined
});

const mapUserToProfile = (userDoc) => {
  const doc = userDoc.toObject();
  return UserProfileSchema.parse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar: mapMediaAsset(doc.avatar),
    stats: doc.stats || undefined,
    badges: doc.badges || [],
    primaryLocationId: toIdString(doc.primaryLocationId),
    accountStatus: doc.accountStatus || 'active',
    email: doc.email || undefined,
    bio: doc.bio || undefined,
    banner: mapMediaAsset(doc.banner),
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

const mapUpdate = (updateDoc) => {
  const doc = updateDoc.toObject();
  return UpdateSchema.parse({
    _id: toIdString(doc._id),
    userId: toIdString(doc.userId),
    sourceUserId: toIdString(doc.sourceUserId),
    targetUserIds: (doc.targetUserIds || []).map(toIdString),
    payload: doc.payload,
    createdAt: updateDoc.createdAt.toISOString(),
    deliveredAt: doc.deliveredAt ? doc.deliveredAt.toISOString() : undefined,
    readAt: doc.readAt ? doc.readAt.toISOString() : undefined
  });
};

const mapReply = (replyDoc) => {
  const doc = replyDoc.toObject();
  const author = doc.authorId && doc.authorId.username
    ? {
        _id: toIdString(doc.authorId._id),
        username: doc.authorId.username,
        displayName: doc.authorId.displayName,
        avatar: doc.authorId.avatar || undefined,
        stats: doc.authorId.stats || undefined,
        badges: doc.authorId.badges || [],
        primaryLocationId: toIdString(doc.authorId.primaryLocationId),
        accountStatus: doc.authorId.accountStatus || 'active'
      }
    : undefined;

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
      reactedAt: reaction.reactedAt ? reaction.reactedAt.toISOString() : undefined
    })),
    mentionedUserIds: (doc.mentionedUserIds || []).map(toIdString),
    createdAt: replyDoc.createdAt.toISOString(),
    updatedAt: replyDoc.updatedAt.toISOString(),
    audit: doc.audit ? buildAudit(doc.audit, replyDoc.createdAt, replyDoc.updatedAt) : undefined
  });
};

router.use(verifyToken);

router.get('/badges', async (req, res) => {
  try {
    const query = BadgeQuerySchema.parse(req.query);
    const viewer = await resolveViewerUser(req);
    const targetUserId = query.userId?.trim() || viewer?._id;
    if (!targetUserId) {
      return res.status(400).json({ message: 'Provide a userId or authenticate to view badges.' });
    }

    const status = await getBadgeStatusForUser(targetUserId);
    res.json(status);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid badge query', issues: error.errors });
    }
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Failed to load badge status:', error);
    res.status(500).json({ message: 'Failed to load badges' });
  }
});

router.post('/badges/grant', async (req, res) => {
  try {
    const input = BadgeMutationSchema.parse(req.body);
    const viewer = await resolveViewerUser(req);
    const targetUserId = input.userId?.trim() || viewer?._id;
    if (!targetUserId) {
      return res.status(400).json({ message: 'Provide a userId or authenticate to grant a badge.' });
    }

    await grantBadge({
      userId: targetUserId,
      badgeId: input.badgeId.trim().toLowerCase(),
      sourceUserId: viewer?._id ?? targetUserId
    });

    const status = await getBadgeStatusForUser(targetUserId);
    res.json(status);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid badge payload', issues: error.errors });
    }
    if (error.message && error.message.startsWith('Unknown badge')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Failed to grant badge (debug):', error);
    res.status(500).json({ message: 'Failed to grant badge' });
  }
});

router.post('/badges/revoke', async (req, res) => {
  try {
    const input = BadgeMutationSchema.parse(req.body);
    const viewer = await resolveViewerUser(req);
    const targetUserId = input.userId?.trim() || viewer?._id;
    if (!targetUserId) {
      return res.status(400).json({ message: 'Provide a userId or authenticate to revoke a badge.' });
    }

    await revokeBadge({
      userId: targetUserId,
      badgeId: input.badgeId.trim().toLowerCase()
    });

    const status = await getBadgeStatusForUser(targetUserId);
    res.json(status);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid badge payload', issues: error.errors });
    }
    if (error.message && error.message.startsWith('Unknown badge')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Failed to revoke badge (debug):', error);
    res.status(500).json({ message: 'Failed to revoke badge' });
  }
});

router.post('/badges/reset', async (req, res) => {
  try {
    const input = BadgeQuerySchema.parse(req.body);
    const viewer = await resolveViewerUser(req);
    const targetUserId = input.userId?.trim() || viewer?._id;
    if (!targetUserId) {
      return res.status(400).json({ message: 'Provide a userId or authenticate to reset badges.' });
    }

    await resetBadges(targetUserId);
    const status = await getBadgeStatusForUser(targetUserId);
    res.json(status);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid badge payload', issues: error.errors });
    }
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Failed to reset badges (debug):', error);
    res.status(500).json({ message: 'Failed to reset badges' });
  }
});

router.get('/auth/accounts', async (req, res) => {
  if (!runtime.isOffline) {
    return res.status(403).json({ message: 'Account swapping is only available in offline mode.' });
  }

  try {
    const accounts = [];
    let nextPageToken = undefined;

    do {
      // Firebase Admin paginates results; pull everything so the debug UI has the full list.
      const result = await admin.auth().listUsers(1000, nextPageToken);
      result.users.forEach((userRecord) => {
        accounts.push({
          uid: userRecord.uid,
          displayName: userRecord.displayName || null,
          email: userRecord.email || null,
          photoUrl: userRecord.photoURL || null,
          disabled: Boolean(userRecord.disabled),
          providerIds: (userRecord.providerData || []).map((provider) => provider.providerId).filter(Boolean),
          lastLoginAt: userRecord.metadata?.lastSignInTime || null,
          createdAt: userRecord.metadata?.creationTime || null
        });
      });
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    accounts.sort((a, b) => {
      const labelA = (a.displayName || a.email || a.uid).toLowerCase();
      const labelB = (b.displayName || b.email || b.uid).toLowerCase();
      return labelA.localeCompare(labelB);
    });

    res.json({ accounts });
  } catch (error) {
    console.error('Failed to list Firebase accounts for debug swap', error);
    res.status(500).json({ message: 'Failed to load Firebase accounts' });
  }
});

router.post('/auth/swap', async (req, res) => {
  if (!runtime.isOffline) {
    return res.status(403).json({ message: 'Account swapping is only available in offline mode.' });
  }

  const SwapSchema = z.object({
    uid: z.string().min(1, 'A Firebase UID is required')
  });

  let input;
  try {
    input = SwapSchema.parse(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid swap payload', issues: error.errors });
    }
    return res.status(400).json({ message: 'Invalid swap payload' });
  }

  try {
    await admin.auth().getUser(input.uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ message: 'Firebase account not found' });
    }
    console.error('Failed to verify Firebase account before issuing custom token', error);
    return res.status(500).json({ message: 'Failed to verify Firebase account' });
  }

  try {
    const token = await admin.auth().createCustomToken(input.uid);
    res.json({ token });
  } catch (error) {
    console.error('Failed to issue custom token for debug swap', error);
    res.status(500).json({ message: 'Failed to issue custom token' });
  }
});

router.post('/users', async (req, res) => {
  const CreateUserSchema = z.object({
    username: z.string().min(3),
    displayName: z.string().min(1),
    email: z.string().email().optional(),
    bio: z.string().max(500).optional(),
    accountStatus: z.enum(['active', 'inactive', 'suspended', 'deleted']).optional(),
    locationSharingEnabled: z.boolean().optional(),
    roles: z.array(z.string()).optional()
  });

  try {
    const input = CreateUserSchema.parse(req.body);
    const user = await User.create({
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      bio: input.bio,
      accountStatus: input.accountStatus || 'active',
      locationSharingEnabled: input.locationSharingEnabled ?? false,
      roles: input.roles && input.roles.length ? input.roles : undefined
    });

    const payload = mapUserToProfile(user);
    res.status(201).json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid user payload', issues: error.errors });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Failed to create user' });
  }
});

router.patch('/users/:userId', async (req, res) => {
  const UpdateUserSchema = z
    .object({
      username: z.string().min(3).optional(),
      displayName: z.string().min(1).optional(),
      email: z.union([z.string().email(), z.literal(null)]).optional(),
      bio: z.union([z.string().max(500), z.literal(null)]).optional(),
      accountStatus: z.enum(['active', 'inactive', 'suspended', 'deleted']).optional(),
      locationSharingEnabled: z.boolean().optional(),
      roles: z.array(z.string()).optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'Provide at least one field to update.'
    });

  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const input = UpdateUserSchema.parse(req.body);

    const setDoc = {};
    const unsetDoc = {};
    const applyNullable = (field, value) => {
      if (value === undefined) {
        return;
      }
      if (value === null) {
        unsetDoc[field] = '';
      } else {
        setDoc[field] = value;
      }
    };

    if (input.username !== undefined) {
      setDoc.username = input.username;
    }
    if (input.displayName !== undefined) {
      setDoc.displayName = input.displayName;
    }
    applyNullable('email', input.email);
    applyNullable('bio', input.bio);
    if (input.accountStatus !== undefined) {
      setDoc.accountStatus = input.accountStatus;
    }
    if (input.locationSharingEnabled !== undefined) {
      setDoc.locationSharingEnabled = input.locationSharingEnabled;
    }
    if (input.roles !== undefined) {
      setDoc.roles = input.roles;
    }

    const updateOps = {};
    if (Object.keys(setDoc).length > 0) {
      updateOps.$set = setDoc;
    }
    if (Object.keys(unsetDoc).length > 0) {
      updateOps.$unset = unsetDoc;
    }

    if (Object.keys(updateOps).length === 0) {
      return res.status(400).json({ message: 'No updates to apply.' });
    }

    const user = await User.findByIdAndUpdate(userId, updateOps, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const payload = mapUserToProfile(user);
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid update payload', issues: error.errors });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Failed to update user' });
  }
});

router.post('/bookmarks', async (req, res) => {
  const CreateBookmarkSchema = z.object({
    userId: ObjectIdString,
    pinId: ObjectIdString,
    collectionId: ObjectIdString.optional(),
    notes: z.string().optional(),
    reminderAt: z.string().datetime().optional(),
    tagIds: z.array(ObjectIdString).optional()
  });

  try {
    const input = CreateBookmarkSchema.parse(req.body);
    const bookmark = await Bookmark.create({
      userId: toObjectId(input.userId),
      pinId: toObjectId(input.pinId),
      collectionId: toObjectId(input.collectionId),
      notes: input.notes,
      reminderAt: input.reminderAt ? new Date(input.reminderAt) : undefined,
      tagIds: input.tagIds ? input.tagIds.map(toObjectId) : []
    });

    const populated = await bookmark.populate({ path: 'pinId', populate: { path: 'creatorId' } });
    const pinPreview = populated.pinId
      ? PinPreviewSchema.parse({
          _id: toIdString(populated.pinId._id),
          type: populated.pinId.type,
          creatorId: toIdString(populated.pinId.creatorId?._id || populated.pinId.creatorId),
          creator: populated.pinId.creatorId && populated.pinId.creatorId.username
            ? {
                _id: toIdString(populated.pinId.creatorId._id),
                username: populated.pinId.creatorId.username,
                displayName: populated.pinId.creatorId.displayName,
                avatar: populated.pinId.creatorId.avatar || undefined,
                stats: populated.pinId.creatorId.stats || undefined,
                badges: populated.pinId.creatorId.badges || [],
                primaryLocationId: toIdString(populated.pinId.creatorId.primaryLocationId),
                accountStatus: populated.pinId.creatorId.accountStatus || 'active'
              }
            : undefined,
          title: populated.pinId.title,
          coordinates: {
            type: 'Point',
            coordinates: populated.pinId.coordinates.coordinates,
            accuracy: populated.pinId.coordinates.accuracy ?? undefined
          },
          proximityRadiusMeters: populated.pinId.proximityRadiusMeters,
          linkedLocationId: toIdString(populated.pinId.linkedLocationId),
          linkedChatRoomId: toIdString(populated.pinId.linkedChatRoomId),
          startDate: populated.pinId.startDate ? populated.pinId.startDate.toISOString() : undefined,
          endDate: populated.pinId.endDate ? populated.pinId.endDate.toISOString() : undefined,
          expiresAt: populated.pinId.expiresAt ? populated.pinId.expiresAt.toISOString() : undefined
        })
      : undefined;

    res.status(201).json(mapBookmark(populated, pinPreview));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid bookmark payload', issues: error.errors });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Bookmark already exists for this user & pin' });
    }
    res.status(500).json({ message: 'Failed to create bookmark' });
  }
});

router.post('/bookmark-collections', async (req, res) => {
  const CreateCollectionSchema = z.object({
    userId: ObjectIdString,
    name: z.string().min(1),
    description: z.string().optional(),
    bookmarkIds: z.array(ObjectIdString).optional()
  });

  try {
    const input = CreateCollectionSchema.parse(req.body);
    const collection = await BookmarkCollection.create({
      userId: toObjectId(input.userId),
      name: input.name,
      description: input.description,
      bookmarkIds: input.bookmarkIds ? input.bookmarkIds.map(toObjectId) : []
    });

    const bookmarks = input.bookmarkIds && input.bookmarkIds.length
      ? await Bookmark.find({ _id: { $in: input.bookmarkIds.map(toObjectId) } }).populate({
          path: 'pinId',
          populate: { path: 'creatorId' }
        })
      : [];

    const bookmarksById = new Map(bookmarks.map((bookmark) => [bookmark._id.toString(), bookmark]));
    const mappedBookmarks = (collection.bookmarkIds || []).map((bookmarkId) => {
      const bookmark = bookmarksById.get(bookmarkId.toString());
      if (!bookmark) return undefined;
      const pinPreview = bookmark.pinId
        ? PinPreviewSchema.parse({
            _id: toIdString(bookmark.pinId._id),
            type: bookmark.pinId.type,
            creatorId: toIdString(bookmark.pinId.creatorId?._id || bookmark.pinId.creatorId),
            creator: bookmark.pinId.creatorId && bookmark.pinId.creatorId.username
              ? {
                  _id: toIdString(bookmark.pinId.creatorId._id),
                  username: bookmark.pinId.creatorId.username,
                  displayName: bookmark.pinId.creatorId.displayName,
                  avatar: bookmark.pinId.creatorId.avatar || undefined,
                  stats: bookmark.pinId.creatorId.stats || undefined,
                  badges: bookmark.pinId.creatorId.badges || [],
                  primaryLocationId: toIdString(bookmark.pinId.creatorId.primaryLocationId),
                  accountStatus: bookmark.pinId.creatorId.accountStatus || 'active'
                }
              : undefined,
            title: bookmark.pinId.title,
            coordinates: {
              type: 'Point',
              coordinates: bookmark.pinId.coordinates.coordinates,
              accuracy: bookmark.pinId.coordinates.accuracy ?? undefined
            },
            proximityRadiusMeters: bookmark.pinId.proximityRadiusMeters,
            linkedLocationId: toIdString(bookmark.pinId.linkedLocationId),
            linkedChatRoomId: toIdString(bookmark.pinId.linkedChatRoomId),
            startDate: bookmark.pinId.startDate ? bookmark.pinId.startDate.toISOString() : undefined,
            endDate: bookmark.pinId.endDate ? bookmark.pinId.endDate.toISOString() : undefined,
            expiresAt: bookmark.pinId.expiresAt ? bookmark.pinId.expiresAt.toISOString() : undefined
          })
        : undefined;
      return bookmark ? mapBookmark(bookmark, pinPreview) : undefined;
    }).filter(Boolean);

    res.status(201).json(mapCollection(collection, mappedBookmarks));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid collection payload', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to create bookmark collection' });
  }
});

router.post('/chat-rooms', async (req, res) => {
  const CreateRoomSchema = z.object({
    ownerId: ObjectIdString,
    name: z.string().min(1),
    description: z.string().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().nonnegative().optional(),
    radiusMeters: z.number().positive(),
    pinId: ObjectIdString.optional(),
    participantIds: z.array(ObjectIdString).optional(),
    moderatorIds: z.array(ObjectIdString).optional(),
    presetKey: z.string().trim().optional(),
    isGlobal: z.boolean().optional()
  });

  try {
    const input = CreateRoomSchema.parse(req.body);
    const room = await createChatRoomRecord({
      ownerId: input.ownerId,
      name: input.name,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      radiusMeters: input.radiusMeters,
      pinId: input.pinId,
      participantIds: input.participantIds,
      moderatorIds: input.moderatorIds,
      presetKey: input.presetKey,
      isGlobal: input.isGlobal
    });

    res.status(201).json(room);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid chat room payload', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to create chat room' });
  }
});

router.post('/chat-messages', async (req, res) => {
  const CreateMessageSchema = z.object({
    roomId: ObjectIdString,
    authorId: ObjectIdString,
    message: z.string().min(1),
    pinId: ObjectIdString.optional(),
    replyToMessageId: ObjectIdString.optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracy: z.number().nonnegative().optional()
  });

  try {
    const input = CreateMessageSchema.parse(req.body);
    const { messageDoc, response } = await createChatMessageRecord({
      roomId: input.roomId,
      pinId: input.pinId,
      authorId: input.authorId,
      replyToMessageId: input.replyToMessageId,
      message: input.message,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy
    });

    res.status(201).json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid chat message payload', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to create chat message' });
  }
});

router.post('/chat-presence', async (req, res) => {
  const CreatePresenceSchema = z.object({
    roomId: ObjectIdString,
    userId: ObjectIdString,
    sessionId: ObjectIdString.optional(),
    joinedAt: z.string().datetime().optional(),
    lastActiveAt: z.string().datetime().optional()
  });

  try {
    const input = CreatePresenceSchema.parse(req.body);
    const presence = await upsertChatPresenceRecord({
      roomId: input.roomId,
      userId: input.userId,
      sessionId: input.sessionId,
      joinedAt: input.joinedAt,
      lastActiveAt: input.lastActiveAt
    });

    res.status(201).json(presence);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid chat presence payload', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to create chat presence' });
  }
});

router.post('/updates', async (req, res) => {
  const CreateUpdateSchema = z.object({
    userId: ObjectIdString,
    sourceUserId: ObjectIdString.optional(),
    targetUserIds: z.array(ObjectIdString).optional(),
    payload: z.object({
      type: z.enum([
        'new-pin',
        'pin-update',
        'event-starting-soon',
        'event-reminder',
        'popular-pin',
        'bookmark-update',
        'system',
        'chat-message',
        'friend-request',
        'chat-room-transition',
        'badge-earned'
      ]),
      title: z.string().min(1),
      body: z.string().optional(),
      metadata: z.record(z.any()).optional(),
      relatedEntities: z
        .array(
          z.object({
            id: ObjectIdString,
            type: z.string().min(1),
            label: z.string().optional(),
            summary: z.string().optional()
          })
        )
        .optional(),
      pinId: ObjectIdString.optional(),
      pinPreview: z
        .object({
          _id: ObjectIdString,
          type: z.enum(['event', 'discussion']),
          creatorId: ObjectIdString,
          title: z.string().min(1),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          proximityRadiusMeters: z.number().optional(),
          startDate: z.string().datetime().optional(),
          endDate: z.string().datetime().optional(),
          expiresAt: z.string().datetime().optional()
        })
        .optional()
    })
  });

  try {
    const input = CreateUpdateSchema.parse(req.body);

    let pinPreview;
    if (input.payload.pinPreview) {
      const coordinates =
        input.payload.pinPreview.latitude !== undefined &&
        input.payload.pinPreview.longitude !== undefined
          ? {
              type: 'Point',
              coordinates: [input.payload.pinPreview.longitude, input.payload.pinPreview.latitude]
            }
          : undefined;

      pinPreview = {
        _id: toObjectId(input.payload.pinPreview._id),
        type: input.payload.pinPreview.type,
        creatorId: toObjectId(input.payload.pinPreview.creatorId),
        title: input.payload.pinPreview.title,
        coordinates,
        proximityRadiusMeters: input.payload.pinPreview.proximityRadiusMeters,
        startDate: input.payload.pinPreview.startDate ? new Date(input.payload.pinPreview.startDate) : undefined,
        endDate: input.payload.pinPreview.endDate ? new Date(input.payload.pinPreview.endDate) : undefined,
        expiresAt: input.payload.pinPreview.expiresAt ? new Date(input.payload.pinPreview.expiresAt) : undefined
      };
    } else if (input.payload.pinId) {
      const pin = await Pin.findById(input.payload.pinId);
      if (pin) {
        pinPreview = {
          _id: pin._id,
          type: pin.type,
          creatorId: pin.creatorId,
          title: pin.title,
          coordinates: {
            type: 'Point',
            coordinates: pin.coordinates.coordinates,
            accuracy: pin.coordinates.accuracy ?? undefined
          },
          proximityRadiusMeters: pin.proximityRadiusMeters,
          linkedLocationId: pin.linkedLocationId,
          linkedChatRoomId: pin.linkedChatRoomId,
          startDate: pin.startDate,
          endDate: pin.endDate,
          expiresAt: pin.expiresAt
        };
      }
    }

    const update = await Update.create({
      userId: toObjectId(input.userId),
      sourceUserId: toObjectId(input.sourceUserId),
      targetUserIds: input.targetUserIds ? input.targetUserIds.map(toObjectId) : [],
      payload: {
        type: input.payload.type,
        title: input.payload.title,
        body: input.payload.body,
        metadata: input.payload.metadata,
        relatedEntities: (input.payload.relatedEntities || []).map((entity) => ({
          id: toObjectId(entity.id),
          type: entity.type,
          label: entity.label,
          summary: entity.summary
        })),
        pin: pinPreview
      }
    });

    res.status(201).json(mapUpdate(update));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid update payload', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to create update' });
  }
});

router.post('/replies', async (req, res) => {
  const CreateReplySchema = z.object({
    pinId: ObjectIdString,
    authorId: ObjectIdString,
    message: z.string().min(1),
    parentReplyId: ObjectIdString.optional(),
    mentionedUserIds: z.array(ObjectIdString).optional()
  });

  try {
    const input = CreateReplySchema.parse(req.body);
    const reply = await Reply.create({
      pinId: toObjectId(input.pinId),
      authorId: toObjectId(input.authorId),
      message: input.message,
      parentReplyId: toObjectId(input.parentReplyId),
      mentionedUserIds: input.mentionedUserIds ? input.mentionedUserIds.map(toObjectId) : []
    });

    const populated = await reply.populate('authorId');
    res.status(201).json(mapReply(populated));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid reply payload', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to create reply' });
  }
});

module.exports = router;

