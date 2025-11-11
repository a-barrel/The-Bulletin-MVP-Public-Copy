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
const { mapMediaAsset, mapUserAvatar } = require('../utils/media');
const { toIdString, mapIdList } = require('../utils/ids');
const { toIsoDateString } = require('../utils/dates');
const FriendRequest = require('../models/FriendRequest');
const ModerationAction = require('../models/ModerationAction');
const DirectMessageThread = require('../models/DirectMessageThread');
const { applyModerationAction } = require('../services/moderationActionService');
const ContentReport = require('../models/ContentReport');
const AnalyticsEvent = require('../models/AnalyticsEvent');

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

const resolveDmPreference = (user) =>
  typeof user?.preferences?.dmPermission === 'string'
    ? user.preferences.dmPermission
    : 'everyone';

const canViewerMessageTarget = (viewer, target) => {
  if (!viewer || !target) {
    return false;
  }
  const preference = resolveDmPreference(target);
  if (preference === 'nobody') {
    return false;
  }
  if (preference === 'everyone') {
    return true;
  }
  const viewerId = toIdString(viewer._id);
  const targetId = toIdString(target._id);
  if (!viewerId || !targetId) {
    return false;
  }
  const targetFriendIds = new Set(mapIdList(target.relationships?.friendIds));
  if (targetFriendIds.has(viewerId)) {
    return true;
  }
  const targetFollowerIds = new Set(mapIdList(target.relationships?.followerIds));
  if (targetFollowerIds.has(viewerId)) {
    return true;
  }
  const viewerFriendIds = new Set(mapIdList(viewer.relationships?.friendIds));
  return viewerFriendIds.has(targetId);
};

const describeDmRestriction = (user) => {
  const preference = resolveDmPreference(user);
  if (preference === 'nobody') {
    return 'This user has DMs disabled.';
  }
  if (preference === 'friends') {
    return 'This user only accepts DMs from friends or followers.';
  }
  return 'This user is not accepting direct messages right now.';
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

const MODERATION_ROLES = new Set(['admin', 'moderator', 'super-admin', 'system-admin']);
const FRIEND_ADMIN_ROLES = new Set(['user', 'admin', 'moderator', 'community-manager', 'super-admin']);

const normalizeRoles = (roles) =>
  Array.isArray(roles)
    ? roles
        .map((role) => (typeof role === 'string' ? role.trim().toLowerCase() : ''))
        .filter(Boolean)
    : [];

const hasAllowedRole = (viewer, allowedRoles) => {
  if (!viewer) {
    return false;
  }

  const normalized = normalizeRoles(viewer.roles);
  return normalized.some((role) => allowedRoles.has(role));
};

const ensureModerationAccess = async (req, res) => {
  const viewer = await resolveViewerUser(req);
  if (runtime.isOffline) {
    return viewer;
  }

  if (!viewer || !hasAllowedRole(viewer, MODERATION_ROLES)) {
    res.status(403).json({ message: 'Moderator privileges required.' });
    return null;
  }

  return viewer;
};

const ensureFriendAdminAccess = async (req, res) => {
  const viewer = await resolveViewerUser(req);
  if (runtime.isOffline) {
    return viewer;
  }

  if (!viewer || !hasAllowedRole(viewer, FRIEND_ADMIN_ROLES)) {
    res.status(403).json({ message: 'Friend management privileges required.' });
    return null;
  }

  return viewer;
};

const RATE_LIMIT_CACHE = new Map();

const assertRateLimit = (key, windowMs) => {
  const now = Date.now();
  const last = RATE_LIMIT_CACHE.get(key) || 0;
  if (now - last < windowMs) {
    const retryAfter = Math.ceil((windowMs - (now - last)) / 1000);
    const error = new Error('Please wait before trying again.');
    error.status = 429;
    error.retryAfter = retryAfter;
    throw error;
  }
  RATE_LIMIT_CACHE.set(key, now);
};

const mapUserSummary = (userDoc) => {
  if (!userDoc) {
    return null;
  }
  const avatar = mapUserAvatar(userDoc, { toIdString });
  return {
    id: toIdString(userDoc._id),
    username: userDoc.username || null,
    displayName: userDoc.displayName || null,
    roles: normalizeRoles(userDoc.roles),
    accountStatus: userDoc.accountStatus || 'active',
    avatar,
    stats: {
      cussCount: userDoc?.stats?.cussCount ?? 0,
      followers: userDoc?.stats?.followers ?? 0,
      following: userDoc?.stats?.following ?? 0
    }
  };
};

const mapModerationAction = (actionDoc, userLookup = new Map()) => {
  const moderator = userLookup.get(toIdString(actionDoc.moderatorId)) || null;
  const subject = userLookup.get(toIdString(actionDoc.userId)) || null;

  return {
    id: toIdString(actionDoc._id),
    type: actionDoc.type,
    reason: actionDoc.reason || '',
    createdAt: actionDoc.createdAt ? actionDoc.createdAt.toISOString() : null,
    updatedAt: actionDoc.updatedAt ? actionDoc.updatedAt.toISOString() : null,
    expiresAt: actionDoc.expiresAt ? actionDoc.expiresAt.toISOString() : null,
    moderator,
    subject
  };
};

const mapContentReport = (reportDoc, userLookup = new Map()) => {
  const reporter = userLookup.get(toIdString(reportDoc.reporterId)) || null;
  const contentAuthor = userLookup.get(toIdString(reportDoc.contentAuthorId)) || null;
  const resolvedBy = reportDoc.resolvedById ? userLookup.get(toIdString(reportDoc.resolvedById)) : null;

  return {
    id: toIdString(reportDoc._id),
    contentType: reportDoc.contentType,
    contentId: reportDoc.contentId,
    status: reportDoc.status,
    reason: reportDoc.reason || '',
    context: reportDoc.context || '',
    latestSnapshot: reportDoc.latestSnapshot || null,
    reporter,
    contentAuthor,
    resolution: reportDoc.resolvedAt
      ? {
          resolvedAt: reportDoc.resolvedAt.toISOString(),
          resolvedBy,
          notes: reportDoc.resolutionNotes || ''
        }
      : null,
    createdAt: reportDoc.createdAt.toISOString(),
    updatedAt: reportDoc.updatedAt ? reportDoc.updatedAt.toISOString() : reportDoc.createdAt.toISOString()
  };
};

const toObjectIdList = (ids) =>
  Array.from(ids)
    .map((value) => toIdString(value))
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

const mapFriendRequestRecord = (requestDoc) => {
  if (!requestDoc) {
    return null;
  }

  const requester = mapUserSummary(requestDoc.requester || requestDoc.requesterId);
  const recipient = mapUserSummary(requestDoc.recipient || requestDoc.recipientId);

  return {
    id: toIdString(requestDoc._id),
    status: requestDoc.status,
    message: requestDoc.message || '',
    createdAt: requestDoc.createdAt ? requestDoc.createdAt.toISOString() : null,
    updatedAt: requestDoc.updatedAt ? requestDoc.updatedAt.toISOString() : null,
    respondedAt: requestDoc.respondedAt ? requestDoc.respondedAt.toISOString() : null,
    requester,
    recipient
  };
};

const mapDirectMessageThread = (threadDoc, userLookup = new Map(), { includeMessages = false } = {}) => {
  if (!threadDoc) {
    return null;
  }

  const participants = (threadDoc.participants || []).map((participant) => {
    const id = toIdString(participant);
    return userLookup.get(id) || { id };
  });

  const base = {
    id: toIdString(threadDoc._id),
    topic: threadDoc.topic || '',
    lastMessageAt: threadDoc.lastMessageAt
      ? threadDoc.lastMessageAt.toISOString()
      : threadDoc.updatedAt
      ? threadDoc.updatedAt.toISOString()
      : null,
    participantCount: participants.length,
    participants,
    messageCount: Array.isArray(threadDoc.messages) ? threadDoc.messages.length : 0,
    createdAt: threadDoc.createdAt ? threadDoc.createdAt.toISOString() : null,
    updatedAt: threadDoc.updatedAt ? threadDoc.updatedAt.toISOString() : null
  };

  if (!includeMessages) {
    return base;
  }

  return {
    ...base,
    messages: (threadDoc.messages || []).map((message) => {
      const senderId = toIdString(message.senderId);
      return {
        id: toIdString(message._id),
        sender: userLookup.get(senderId) || { id: senderId },
        body: message.body,
        attachments: Array.isArray(message.attachments) ? message.attachments : [],
        createdAt: message.createdAt ? message.createdAt.toISOString() : null
      };
    })
  };
};

const PRIVILEGED_ACCOUNT_SWAP_ROLES = new Set(['admin', 'super-admin', 'system-admin']);
const accountSwapAllowlist =
  runtime?.debugAuth?.accountSwapAllowlist instanceof Set
    ? runtime.debugAuth.accountSwapAllowlist
    : new Set();
const allowAccountSwapOnline = Boolean(runtime?.debugAuth?.allowAccountSwapOnline);
const toAllowlistKey = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }
  if (typeof value.toString === 'function') {
    const stringValue = value.toString();
    if (typeof stringValue === 'string') {
      const trimmed = stringValue.trim();
      return trimmed ? trimmed.toLowerCase() : null;
    }
  }
  return null;
};

const hasPrivilegedAccountSwapRole = (viewer) => {
  const roles = Array.isArray(viewer?.roles) ? viewer.roles : [];
  return roles
    .map((role) => (typeof role === 'string' ? role.trim().toLowerCase() : ''))
    .some((role) => role && PRIVILEGED_ACCOUNT_SWAP_ROLES.has(role));
};

const isAllowlistedForAccountSwap = (req, viewer) => {
  if (!(accountSwapAllowlist instanceof Set) || accountSwapAllowlist.size === 0) {
    return false;
  }

  if (accountSwapAllowlist.has('*')) {
    return true;
  }

  const candidates = [
    req?.user?.uid,
    req?.user?.email,
    viewer?.email,
    viewer?._id,
    viewer?.username
  ];

  return candidates.some((candidate) => {
    const key = toAllowlistKey(candidate);
    return key && accountSwapAllowlist.has(key);
  });
};

const getAccountSwapGateFailureMessage = (req, viewer) => {
  if (runtime.isOffline) {
    return null;
  }

  if (hasPrivilegedAccountSwapRole(viewer)) {
    return null;
  }

  if (!allowAccountSwapOnline) {
    return 'Account swapping is disabled for this deployment.';
  }

  if (isAllowlistedForAccountSwap(req, viewer)) {
    return null;
  }

  if (!(accountSwapAllowlist instanceof Set) || accountSwapAllowlist.size === 0) {
    return 'Account swapping is disabled online because no tester allowlist is configured.';
  }

  return 'Account swapping is restricted to approved testers.';
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
    avatar: mapUserAvatar(doc, { toIdString }),
    stats: doc.stats || undefined,
    badges: doc.badges || [],
    primaryLocationId: toIdString(doc.primaryLocationId),
    accountStatus: doc.accountStatus || 'active',
    email: doc.email || undefined,
    bio: doc.bio || undefined,
    banner: mapMediaAsset(doc.banner, { toIdString }),
    preferences: doc.preferences || undefined,
    relationships: doc.relationships || undefined,
    locationSharingEnabled: Boolean(doc.locationSharingEnabled),
    pinnedPinIds: mapIdList(doc.pinnedPinIds),
    ownedPinIds: mapIdList(doc.ownedPinIds),
    bookmarkCollectionIds: mapIdList(doc.bookmarkCollectionIds),
    proximityChatRoomIds: mapIdList(doc.proximityChatRoomIds),
    recentLocationIds: mapIdList(doc.recentLocationIds),
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

const mapUpdate = (updateDoc) => {
  const doc = updateDoc.toObject();
  return UpdateSchema.parse({
    _id: toIdString(doc._id),
    userId: toIdString(doc.userId),
    sourceUserId: toIdString(doc.sourceUserId),
    targetUserIds: mapIdList(doc.targetUserIds),
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
    mentionedUserIds: mapIdList(doc.mentionedUserIds),
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
  const viewer = await resolveViewerUser(req);
  if (!viewer) {
    return res.status(403).json({
      message: 'Unable to resolve the authenticated user for account swapping.'
    });
  }

  const gateFailure = getAccountSwapGateFailureMessage(req, viewer);
  if (gateFailure) {
    return res.status(403).json({ message: gateFailure });
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
  const viewer = await resolveViewerUser(req);
  if (!viewer) {
    return res.status(403).json({
      message: 'Unable to resolve the authenticated user for account swapping.'
    });
  }

  const gateFailure = getAccountSwapGateFailureMessage(req, viewer);
  if (gateFailure) {
    return res.status(403).json({ message: gateFailure });
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

router.get('/moderation/overview', async (req, res) => {
  try {
    const viewer = await ensureModerationAccess(req, res);
    if (!viewer) {
      return;
    }

    const blockedIds = Array.isArray(viewer?.relationships?.blockedUserIds)
      ? viewer.relationships.blockedUserIds
      : [];
    const mutedIds = Array.isArray(viewer?.relationships?.mutedUserIds)
      ? viewer.relationships.mutedUserIds
      : [];

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      blockedDocs,
      mutedDocs,
      recentActions,
      flaggedAgg,
      shareEventsLast24h,
      pushSubscribers,
      activeUsers,
      pendingReportCount
    ] = await Promise.all([
      blockedIds.length
        ? User.find({ _id: { $in: blockedIds } })
            .select({
              username: 1,
              displayName: 1,
              roles: 1,
              accountStatus: 1,
              avatar: 1,
              stats: 1
            })
            .lean()
        : [],
      mutedIds.length
        ? User.find({ _id: { $in: mutedIds } })
            .select({
              username: 1,
              displayName: 1,
              roles: 1,
              accountStatus: 1,
              avatar: 1,
              stats: 1
            })
            .lean()
        : [],
      ModerationAction.find({})
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      ModerationAction.aggregate([
        {
          $match: {
            type: { $in: ['warn', 'mute', 'block', 'ban', 'report'] }
          }
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            lastActionAt: { $max: '$createdAt' }
          }
        },
        { $sort: { count: -1, lastActionAt: -1 } },
        { $limit: 10 }
      ]),
      AnalyticsEvent.countDocuments({ eventName: 'pin-share', createdAt: { $gte: twentyFourHoursAgo } }),
      User.countDocuments({ 'messagingTokens.0': { $exists: true } }),
      User.countDocuments({ accountStatus: 'active' }),
      ContentReport.countDocuments({ status: 'pending' })
    ]);

    const referencedUserIds = new Set([
      toIdString(viewer._id),
      ...blockedDocs.map((doc) => toIdString(doc._id)),
      ...mutedDocs.map((doc) => toIdString(doc._id)),
      ...recentActions.map((action) => toIdString(action.userId)),
      ...recentActions.map((action) => toIdString(action.moderatorId)),
      ...flaggedAgg.map((entry) => toIdString(entry._id))
    ]);

    const referencedUsers = await User.find({ _id: { $in: toObjectIdList(referencedUserIds) } })
      .select({
        username: 1,
        displayName: 1,
        roles: 1,
        accountStatus: 1,
        avatar: 1,
        stats: 1
      })
      .lean();

    const userLookup = new Map(referencedUsers.map((doc) => [toIdString(doc._id), mapUserSummary(doc)]));

    const response = {
      viewer: mapUserSummary(viewer),
      blockedUsers: blockedDocs.map(mapUserSummary),
      mutedUsers: mutedDocs.map(mapUserSummary),
      flaggedUsers: flaggedAgg.map((entry) => ({
        user: userLookup.get(toIdString(entry._id)) || null,
        count: entry.count,
        lastActionAt: entry.lastActionAt ? entry.lastActionAt.toISOString() : null
      })),
      recentActions: recentActions.map((action) => mapModerationAction(action, userLookup)),
      metrics: {
        shareEventsLast24h,
        pushSubscribers,
        pushOptInCount: pushSubscribers,
        activeUsers,
        pushSubscriptionRate: activeUsers > 0 ? pushSubscribers / activeUsers : 0,
        pendingReportCount
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to load moderation overview', error);
    res.status(500).json({ message: 'Failed to load moderation overview' });
  }
});

router.get('/moderation/history/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const viewer = await ensureModerationAccess(req, res);
    if (!viewer) {
      return;
    }

    const actions = await ModerationAction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const uniqueUserIds = new Set([
      toIdString(viewer._id),
      userId,
      ...actions.map((action) => toIdString(action.moderatorId))
    ]);

    const users = await User.find({
      _id: { $in: toObjectIdList(uniqueUserIds) }
    })
      .select({
        username: 1,
        displayName: 1,
        roles: 1,
        accountStatus: 1,
        avatar: 1,
        stats: 1
      })
      .lean();

    const userLookup = new Map(users.map((doc) => [toIdString(doc._id), mapUserSummary(doc)]));

    res.json({
      user: userLookup.get(userId) || null,
      history: actions.map((action) => mapModerationAction(action, userLookup))
    });
  } catch (error) {
    console.error('Failed to load moderation history', error);
    res.status(500).json({ message: 'Failed to load moderation history' });
  }
});

router.post('/moderation/actions', async (req, res) => {
  const ModerationActionInputSchema = z.object({
    userId: ObjectIdString,
    type: z.enum(['warn', 'mute', 'unmute', 'block', 'unblock', 'ban', 'unban', 'report']),
    reason: z.string().trim().max(500).optional(),
    durationMinutes: z.coerce.number().int().positive().max(1440).optional()
  });

  try {
    const input = ModerationActionInputSchema.parse(req.body);
    const viewer = await ensureModerationAccess(req, res);
    if (!viewer) {
      return;
    }

    if (toIdString(viewer._id) === input.userId) {
      return res.status(400).json({ message: 'You cannot moderate your own account.' });
    }

    const target = await User.findById(input.userId);
    if (!target) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    if (input.type === 'report') {
      try {
        assertRateLimit(`report:${viewer._id.toString()}`, 5000);
      } catch (rateError) {
        return res.status(rateError.status || 429).json({ message: rateError.message, retryAfter: rateError.retryAfter });
      }
    }

    const { action: actionDoc, target: refreshedTarget } = await applyModerationAction({
      viewer,
      target,
      type: input.type,
      reason: input.reason?.trim(),
      durationMinutes: input.durationMinutes
    });

    const userLookup = new Map([
      [toIdString(viewer._id), mapUserSummary(viewer)],
      [toIdString(target._id), mapUserSummary(refreshedTarget)]
    ]);

    res.status(201).json({
      action: mapModerationAction(actionDoc.toObject(), userLookup),
      user: mapUserSummary(refreshedTarget)
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid moderation payload', issues: error.errors });
    }
    console.error('Failed to record moderation action', error);
    res.status(500).json({ message: 'Failed to record moderation action' });
  }
});

const ModerationReportQuerySchema = z.object({
  status: z.enum(['pending', 'resolved', 'dismissed']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

const ResolveReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  resolutionNotes: z.string().trim().max(1000).optional()
});

router.get('/moderation/reports', async (req, res) => {
  try {
    const viewer = await ensureModerationAccess(req, res);
    if (!viewer) {
      return;
    }

    const query = ModerationReportQuerySchema.parse(req.query);
    const match = query.status ? { status: query.status } : {};
    const limit = query.limit ?? 100;

    const reports = await ContentReport.find(match)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const userIds = new Set();
    userIds.add(toIdString(viewer._id));
    for (const report of reports) {
      userIds.add(toIdString(report.reporterId));
      userIds.add(toIdString(report.contentAuthorId));
      if (report.resolvedById) {
        userIds.add(toIdString(report.resolvedById));
      }
    }

    const users = await User.find({ _id: { $in: toObjectIdList(userIds) } })
      .select({
        username: 1,
        displayName: 1,
        roles: 1,
        accountStatus: 1,
        avatar: 1,
        stats: 1
      })
      .lean();

    const userLookup = new Map(users.map((doc) => [toIdString(doc._id), mapUserSummary(doc)]));

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [pendingCount, resolvedTodayCount, dismissedCount] = await Promise.all([
      ContentReport.countDocuments({ status: 'pending' }),
      ContentReport.countDocuments({ status: 'resolved', resolvedAt: { $gte: startOfDay } }),
      ContentReport.countDocuments({ status: 'dismissed' })
    ]);

    res.json({
      summary: {
        pendingCount,
        resolvedTodayCount,
        dismissedCount
      },
      reports: reports.map((report) => mapContentReport(report, userLookup))
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid report query.', issues: error.errors });
    }
    console.error('Failed to load moderation reports:', error);
    res.status(500).json({ message: 'Failed to load reports.' });
  }
});

router.post('/moderation/reports/:reportId/resolve', async (req, res) => {
  try {
    const viewer = await ensureModerationAccess(req, res);
    if (!viewer) {
      return;
    }

    const reportId = ObjectIdString.parse(req.params.reportId);
    const input = ResolveReportSchema.parse(req.body);

    const report = await ContentReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    if (report.status === input.status && report.resolutionNotes === (input.resolutionNotes?.trim() || '')) {
      return res.json({ message: 'Report already reflects the requested state.' });
    }

    report.status = input.status;
    report.resolvedById = viewer._id;
    report.resolvedAt = new Date();
    report.resolutionNotes = input.resolutionNotes?.trim() || '';
    await report.save();

    const users = await User.find({
      _id: { $in: toObjectIdList([report.reporterId, report.contentAuthorId, viewer._id]) }
    })
      .select({
        username: 1,
        displayName: 1,
        roles: 1,
        accountStatus: 1,
        avatar: 1,
        stats: 1
      })
      .lean();

    const userLookup = new Map(users.map((doc) => [toIdString(doc._id), mapUserSummary(doc)]));
    res.json({
      message: 'Report updated.',
      report: mapContentReport(report.toObject(), userLookup)
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid resolution payload.', issues: error.errors });
    }
    console.error('Failed to resolve content report:', error);
    res.status(500).json({ message: 'Failed to update report.' });
  }
});

router.get('/friends/overview', async (req, res) => {
  try {
    const viewer = await ensureFriendAdminAccess(req, res);
    if (!viewer) {
      return;
    }

    const friendIds = Array.isArray(viewer?.relationships?.friendIds)
      ? viewer.relationships.friendIds
      : [];

    const [friendDocs, incomingRequests, outgoingRequests] = await Promise.all([
      friendIds.length
        ? User.find({ _id: { $in: friendIds } })
            .select({
              username: 1,
              displayName: 1,
              roles: 1,
              accountStatus: 1,
              avatar: 1,
              stats: 1
            })
            .lean()
        : [],
      FriendRequest.find({ recipientId: viewer._id, status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(25)
        .populate('requesterId', 'username displayName roles accountStatus avatar stats')
        .lean(),
      FriendRequest.find({ requesterId: viewer._id, status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(25)
        .populate('recipientId', 'username displayName roles accountStatus avatar stats')
        .lean()
    ]);

    res.json({
      viewer: mapUserSummary(viewer),
      friends: friendDocs.map(mapUserSummary),
      incomingRequests: incomingRequests.map((request) =>
        mapFriendRequestRecord({ ...request, requester: request.requesterId, recipient: viewer })
      ),
      outgoingRequests: outgoingRequests.map((request) =>
        mapFriendRequestRecord({ ...request, requester: viewer, recipient: request.recipientId })
      )
    });
  } catch (error) {
    console.error('Failed to load friend overview', error);
    res.status(500).json({ message: 'Failed to load friend overview' });
  }
});

router.post('/friends/request', async (req, res) => {
  const FriendRequestSchema = z.object({
    targetUserId: ObjectIdString,
    message: z.string().trim().max(280).optional()
  });

  try {
    const input = FriendRequestSchema.parse(req.body);
    const viewer = await ensureFriendAdminAccess(req, res);
    if (!viewer) {
      return;
    }

    if (toIdString(viewer._id) === input.targetUserId) {
      return res.status(400).json({ message: 'Cannot send a friend request to yourself.' });
    }

    try {
      assertRateLimit(`friend-request:${viewer._id.toString()}`, 5000);
    } catch (rateError) {
      return res.status(rateError.status || 429).json({ message: rateError.message, retryAfter: rateError.retryAfter });
    }

    const target = await User.findById(input.targetUserId);
    if (!target) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const viewerFriends = Array.isArray(viewer?.relationships?.friendIds)
      ? viewer.relationships.friendIds.map((id) => toIdString(id))
      : [];
    if (viewerFriends.includes(toIdString(target._id))) {
      return res.status(409).json({ message: 'You are already friends with this user.' });
    }

    const inverseRequest = await FriendRequest.findOne({
      requesterId: target._id,
      recipientId: viewer._id,
      status: 'pending'
    });

    if (inverseRequest) {
      inverseRequest.status = 'accepted';
      inverseRequest.respondedAt = new Date();
      await inverseRequest.save();

      await Promise.all([
        User.findByIdAndUpdate(viewer._id, {
          $addToSet: { 'relationships.friendIds': target._id }
        }),
        User.findByIdAndUpdate(target._id, {
          $addToSet: { 'relationships.friendIds': viewer._id }
        })
      ]);

      const populated = await inverseRequest.populate([
        { path: 'requesterId', select: 'username displayName roles accountStatus avatar stats' },
        { path: 'recipientId', select: 'username displayName roles accountStatus avatar stats' }
      ]);

      return res.status(200).json({
        autoAccepted: true,
        request: mapFriendRequestRecord({
          ...populated.toObject(),
          requester: populated.requesterId,
          recipient: populated.recipientId
        })
      });
    }

    const requestDoc = await FriendRequest.findOneAndUpdate(
      { requesterId: viewer._id, recipientId: target._id },
      {
        $set: {
          status: 'pending',
          message: input.message?.trim() || '',
          respondedAt: null
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const populated = await requestDoc.populate([
      { path: 'requesterId', select: 'username displayName roles accountStatus avatar stats' },
      { path: 'recipientId', select: 'username displayName roles accountStatus avatar stats' }
    ]);

    res.status(201).json({
      request: mapFriendRequestRecord({
        ...populated.toObject(),
        requester: populated.requesterId,
        recipient: populated.recipientId
      })
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid friend request payload', issues: error.errors });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Friend request already exists.' });
    }
    console.error('Failed to create friend request', error);
    res.status(500).json({ message: 'Failed to create friend request' });
  }
});

router.post('/friends/requests/:requestId/respond', async (req, res) => {
  const { requestId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(400).json({ message: 'Invalid request id' });
  }

  const FriendDecisionSchema = z.object({
    decision: z.enum(['accept', 'decline'])
  });

  try {
    const input = FriendDecisionSchema.parse(req.body);
    const viewer = await ensureFriendAdminAccess(req, res);
    if (!viewer) {
      return;
    }

    const requestDoc = await FriendRequest.findById(requestId);
    if (!requestDoc) {
      return res.status(404).json({ message: 'Friend request not found.' });
    }

    if (toIdString(requestDoc.recipientId) !== toIdString(viewer._id)) {
      return res.status(403).json({ message: 'You can only respond to requests sent to you.' });
    }

    if (requestDoc.status !== 'pending') {
      return res.status(409).json({ message: 'Friend request has already been resolved.' });
    }

    requestDoc.status = input.decision === 'accept' ? 'accepted' : 'declined';
    requestDoc.respondedAt = new Date();
    await requestDoc.save();

    if (input.decision === 'accept') {
      await Promise.all([
        User.findByIdAndUpdate(viewer._id, {
          $addToSet: { 'relationships.friendIds': requestDoc.requesterId }
        }),
        User.findByIdAndUpdate(requestDoc.requesterId, {
          $addToSet: { 'relationships.friendIds': viewer._id }
        })
      ]);
    }

    const populated = await requestDoc.populate([
      { path: 'requesterId', select: 'username displayName roles accountStatus avatar stats' },
      { path: 'recipientId', select: 'username displayName roles accountStatus avatar stats' }
    ]);

    res.json({
      request: mapFriendRequestRecord({
        ...populated.toObject(),
        requester: populated.requesterId,
        recipient: populated.recipientId
      })
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid decision payload', issues: error.errors });
    }
    console.error('Failed to resolve friend request', error);
    res.status(500).json({ message: 'Failed to resolve friend request' });
  }
});

router.delete('/friends/:friendId', async (req, res) => {
  const { friendId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    return res.status(400).json({ message: 'Invalid friend id' });
  }

  try {
    const viewer = await ensureFriendAdminAccess(req, res);
    if (!viewer) {
      return;
    }

    const target = await User.findById(friendId);
    if (!target) {
      return res.status(404).json({ message: 'Friend not found.' });
    }

    await Promise.all([
      User.findByIdAndUpdate(viewer._id, { $pull: { 'relationships.friendIds': target._id } }),
      User.findByIdAndUpdate(target._id, { $pull: { 'relationships.friendIds': viewer._id } })
    ]);

    res.json({
      removed: mapUserSummary(target)
    });
  } catch (error) {
    console.error('Failed to remove friend', error);
    res.status(500).json({ message: 'Failed to remove friend' });
  }
});

router.get('/direct-messages/threads', async (req, res) => {
  try {
    const viewer = await ensureFriendAdminAccess(req, res);
    if (!viewer) {
      return;
    }

    const threads = await DirectMessageThread.find({ participants: viewer._id })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const referencedIds = new Set([
      toIdString(viewer._id),
      ...threads.flatMap((thread) => (thread.participants || []).map((participant) => toIdString(participant))),
      ...threads.flatMap((thread) =>
        (thread.messages || []).map((message) => toIdString(message.senderId))
      )
    ]);

    const users = await User.find({ _id: { $in: toObjectIdList(referencedIds) } })
      .select({
        username: 1,
        displayName: 1,
        roles: 1,
        accountStatus: 1,
        avatar: 1,
        stats: 1,
        relationships: 1,
        preferences: 1
      })
      .lean();

    const viewerIdString = toIdString(viewer._id);
    const viewerBlockedSet = new Set(mapIdList(viewer?.relationships?.blockedUserIds));

    const userDocMap = new Map(users.map((doc) => [toIdString(doc._id), doc]));
    userDocMap.set(viewerIdString, viewer.toObject ? viewer.toObject() : viewer);

    const filteredThreads = threads.filter((thread) => {
      const participants = (thread.participants || []).map((participant) => toIdString(participant));
      for (const participantId of participants) {
        if (!participantId || participantId === viewerIdString) {
          continue;
        }
        if (viewerBlockedSet.has(participantId)) {
          return false;
        }
        const participantDoc = userDocMap.get(participantId);
        if (participantDoc) {
          const participantBlocked = new Set(mapIdList(participantDoc.relationships?.blockedUserIds));
          if (participantBlocked.has(viewerIdString)) {
            return false;
          }
        }
      }
      return true;
    });

    const userLookup = new Map(
      Array.from(userDocMap.entries()).map(([id, doc]) => [id, mapUserSummary(doc)])
    );

    res.json({
      viewer: mapUserSummary(viewer),
      threads: filteredThreads.map((thread) => mapDirectMessageThread(thread, userLookup))
    });
  } catch (error) {
    console.error('Failed to load direct message threads', error);
    res.status(500).json({ message: 'Failed to load direct message threads' });
  }
});

router.get('/direct-messages/threads/:threadId', async (req, res) => {
  const { threadId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    return res.status(400).json({ message: 'Invalid thread id' });
  }

  try {
    const viewer = await ensureFriendAdminAccess(req, res);
    if (!viewer) {
      return;
    }

    const thread = await DirectMessageThread.findById(threadId).lean();
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found.' });
    }

    const participantIds = (thread.participants || []).map((participant) => toIdString(participant));
    if (!participantIds.includes(toIdString(viewer._id))) {
      return res.status(403).json({ message: 'You are not a participant in this thread.' });
    }

    const referencedIds = new Set([
      ...participantIds,
      ...((thread.messages || []).map((message) => toIdString(message.senderId)))
    ]);

    const users = await User.find({ _id: { $in: toObjectIdList(referencedIds) } })
      .select({
        username: 1,
        displayName: 1,
        roles: 1,
        accountStatus: 1,
        avatar: 1,
        stats: 1,
        relationships: 1,
        preferences: 1
      })
      .lean();

    const viewerIdString = toIdString(viewer._id);
    const viewerBlockedSet = new Set(mapIdList(viewer?.relationships?.blockedUserIds));
    const userDocMap = new Map(users.map((doc) => [toIdString(doc._id), doc]));
    userDocMap.set(viewerIdString, viewer.toObject ? viewer.toObject() : viewer);

    const blockedParticipant = participantIds.some((participantId) => {
      if (!participantId || participantId === viewerIdString) {
        return false;
      }
      if (viewerBlockedSet.has(participantId)) {
        return true;
      }
      const participantDoc = userDocMap.get(participantId);
      if (!participantDoc) {
        return false;
      }
      const participantBlocked = new Set(mapIdList(participantDoc.relationships?.blockedUserIds));
      return participantBlocked.has(viewerIdString);
    });

    if (blockedParticipant) {
      return res.status(403).json({ message: 'This conversation is no longer available.' });
    }

    const userLookup = new Map(
      Array.from(userDocMap.entries()).map(([id, doc]) => [id, mapUserSummary(doc)])
    );

    res.json({
      thread: mapDirectMessageThread(thread, userLookup, { includeMessages: true })
    });
  } catch (error) {
    console.error('Failed to load direct message thread', error);
    res.status(500).json({ message: 'Failed to load direct message thread' });
  }
});

router.post('/direct-messages/threads', async (req, res) => {
  const CreateThreadSchema = z.object({
    participantIds: z.array(ObjectIdString).min(1),
    topic: z.string().trim().max(120).optional(),
    initialMessage: z.string().trim().max(2000).optional()
  });

  try {
    const input = CreateThreadSchema.parse(req.body);
    const viewer = await ensureFriendAdminAccess(req, res);
    if (!viewer) {
      return;
    }

    const participants = new Set(
      input.participantIds.map((id) => new mongoose.Types.ObjectId(id))
    );
    participants.add(viewer._id);

    const participantIds = Array.from(participants);
    if (participantIds.length < 2) {
      return res.status(400).json({ message: 'Threads require at least two participants.' });
    }

    const users = await User.find({ _id: { $in: participantIds } })
      .select({
        username: 1,
        displayName: 1,
        roles: 1,
        accountStatus: 1,
        avatar: 1,
        stats: 1,
        relationships: 1,
        preferences: 1
      })
      .lean();

    if (users.length !== participantIds.length) {
      return res.status(404).json({ message: 'One or more participants were not found.' });
    }

    const viewerIdString = toIdString(viewer._id);
    const viewerBlockedSet = new Set(mapIdList(viewer?.relationships?.blockedUserIds));

    for (const userDoc of users) {
      const participantId = toIdString(userDoc._id);
      if (!participantId || participantId === viewerIdString) {
        continue;
      }
      if (viewerBlockedSet.has(participantId)) {
        return res.status(403).json({ message: 'You have blocked one or more selected participants.' });
      }
      const participantBlocked = new Set(mapIdList(userDoc.relationships?.blockedUserIds));
      if (participantBlocked.has(viewerIdString)) {
        return res.status(403).json({ message: 'One or more participants has blocked you.' });
      }
      if (!canViewerMessageTarget(viewer, userDoc)) {
        return res.status(403).json({ message: describeDmRestriction(userDoc) });
      }
    }

    const now = new Date();
    const initialMessages = input.initialMessage
      ? [
          {
            senderId: viewer._id,
            body: input.initialMessage,
            attachments: [],
            createdAt: now
          }
        ]
      : [];

    const thread = await DirectMessageThread.create({
      participants: participantIds,
      topic: input.topic?.trim() || '',
      messages: initialMessages,
      lastMessageAt: input.initialMessage ? now : undefined
    });

    const userLookup = new Map(users.map((doc) => [toIdString(doc._id), mapUserSummary(doc)]));
    userLookup.set(toIdString(viewer._id), mapUserSummary(viewer));

    res.status(201).json({
      thread: mapDirectMessageThread(thread.toObject(), userLookup, { includeMessages: true })
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid thread payload', issues: error.errors });
    }
    console.error('Failed to create direct message thread', error);
    res.status(500).json({ message: 'Failed to create direct message thread' });
  }
});

router.post('/direct-messages/threads/:threadId/messages', async (req, res) => {
  const { threadId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    return res.status(400).json({ message: 'Invalid thread id' });
  }

  const SendMessageSchema = z.object({
    body: z.string().trim().min(1, 'Message body cannot be empty.').max(4000),
    attachments: z.array(z.any()).optional()
  });

  try {
    const input = SendMessageSchema.parse(req.body);
    const viewer = await ensureFriendAdminAccess(req, res);
    if (!viewer) {
      return;
    }

    const thread = await DirectMessageThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found.' });
    }

    const participantIds = thread.participants.map((participant) => toIdString(participant));
    if (!participantIds.includes(toIdString(viewer._id))) {
      return res.status(403).json({ message: 'You are not a participant in this thread.' });
    }

    const participants = await User.find({ _id: { $in: thread.participants } })
      .select({ relationships: 1, preferences: 1 })
      .lean();
    const viewerIdString = toIdString(viewer._id);
    const viewerBlockedSet = new Set(mapIdList(viewer?.relationships?.blockedUserIds));

    for (const participant of participants) {
      const participantId = toIdString(participant._id);
      if (!participantId || participantId === viewerIdString) {
        continue;
      }
      if (viewerBlockedSet.has(participantId)) {
        return res.status(403).json({ message: 'You have blocked one or more participants in this conversation.' });
      }
      const participantBlocked = new Set(mapIdList(participant.relationships?.blockedUserIds));
      if (participantBlocked.has(viewerIdString)) {
        return res.status(403).json({ message: 'One or more participants has blocked you.' });
      }
      if (!canViewerMessageTarget(viewer, participant)) {
        return res.status(403).json({ message: describeDmRestriction(participant) });
      }
    }

    const message = {
      senderId: viewer._id,
      body: input.body,
      attachments: Array.isArray(input.attachments) ? input.attachments : [],
      createdAt: new Date()
    };

    thread.messages.push(message);
    thread.lastMessageAt = message.createdAt;
    await thread.save();

    res.status(201).json({
      message: {
        id: toIdString(thread.messages[thread.messages.length - 1]._id),
        sender: mapUserSummary(viewer),
        body: message.body,
        attachments: message.attachments,
        createdAt: message.createdAt.toISOString()
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid message payload', issues: error.errors });
    }
    console.error('Failed to send direct message', error);
    res.status(500).json({ message: 'Failed to send direct message' });
  }
});

router.get('/bad-users', async (req, res) => {
  try {
    const users = await User.find({ 'stats.cussCount': { $gt: 0 } })
      .select({
        username: 1,
        displayName: 1,
        avatar: 1,
        stats: 1,
        accountStatus: 1,
        createdAt: 1
      })
      .sort({ 'stats.cussCount': -1, createdAt: 1 })
      .lean();

    const payload = users.map((user) => {
      const avatar = mapUserAvatar(user, { toIdString });
      return {
        id: toIdString(user._id),
        username: user.username || null,
        displayName: user.displayName || null,
        avatar,
        cussCount: user?.stats?.cussCount ?? 0,
        accountStatus: user.accountStatus || 'active',
        createdAt: user.createdAt ? user.createdAt.toISOString() : null
      };
    });

    res.json(payload);
  } catch (error) {
    console.error('Failed to load users with cuss stats', error);
    res.status(500).json({ message: 'Failed to load cuss stats' });
  }
});

router.post('/bad-users/:userId/increment', async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const result = await User.findByIdAndUpdate(
      userId,
      { $inc: { 'stats.cussCount': 1 } },
      { new: true, projection: { username: 1, displayName: 1, stats: 1 } }
    );

    if (!result) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: toIdString(result._id),
      username: result.username || null,
      displayName: result.displayName || null,
      cussCount: result?.stats?.cussCount ?? 0
    });
  } catch (error) {
    console.error('Failed to increment cuss count', error);
    res.status(500).json({ message: 'Failed to increment cuss count' });
  }
});

router.post('/bad-users/:userId/reset', async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const result = await User.findByIdAndUpdate(
      userId,
      { $set: { 'stats.cussCount': 0 } },
      { new: true, projection: { username: 1, displayName: 1, stats: 1 } }
    );

    if (!result) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: toIdString(result._id),
      username: result.username || null,
      displayName: result.displayName || null,
      cussCount: result?.stats?.cussCount ?? 0
    });
  } catch (error) {
    console.error('Failed to reset cuss count', error);
    res.status(500).json({ message: 'Failed to reset cuss count' });
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
