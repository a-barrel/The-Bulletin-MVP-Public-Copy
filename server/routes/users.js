const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { z, ZodError } = require('zod');
const User = require('../models/User');
const Pin = require('../models/Pin');
const DataExportRequest = require('../models/DataExportRequest');
const ApiToken = require('../models/ApiToken');
const { PublicUserSchema, UserProfileSchema } = require('../schemas/user');
const { PinListItemSchema } = require('../schemas/pin');
const verifyToken = require('../middleware/verifyToken');
const { grantBadge } = require('../services/badgeService');
const { mapMediaAsset, mapUserAvatar } = require('../utils/media');
const { toIdString, mapIdList } = require('../utils/ids');
const { toIsoDateString } = require('../utils/dates');

const router = express.Router();

const DATA_EXPORT_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_ACTIVE_API_TOKENS = 10;

const UsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

const PinQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20)
});

const MediaAssetUpdateSchema = z.object({
  url: z.string().trim().min(1, 'Media url is required'),
  thumbnailUrl: z.string().trim().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mimeType: z.string().trim().optional(),
  description: z.string().optional(),
  uploadedAt: z.string().datetime().optional(),
  uploadedBy: z
    .string()
    .trim()
    .refine((value) => mongoose.Types.ObjectId.isValid(value), { message: 'Invalid uploadedBy id' })
    .optional()
});

const PushTokenSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
  platform: z.string().trim().max(64).optional()
});

const DataExportRequestSchema = z
  .object({
    reason: z.string().trim().max(240, 'Reason must be 240 characters or fewer').optional()
  })
  .optional();

const ApiTokenCreateSchema = z
  .object({
    label: z.string().trim().max(120, 'Label must be 120 characters or fewer').optional()
  })
  .optional();

const hasDefinedValue = (value) => {
  if (value === undefined) {
    return false;
  }
  if (value === null) {
    return true;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).some((field) => hasDefinedValue(field));
  }
  return true;
};

const NotificationPreferencesUpdateSchema = z
  .object({
    proximity: z.boolean().optional(),
    updates: z.boolean().optional(),
    marketing: z.boolean().optional(),
    chatTransitions: z.boolean().optional(),
    friendRequests: z.boolean().optional(),
    badgeUnlocks: z.boolean().optional(),
    moderationAlerts: z.boolean().optional(),
    dmMentions: z.boolean().optional(),
    emailDigests: z.boolean().optional()
  })
  .optional();

const DisplayPreferencesUpdateSchema = z
  .object({
    textScale: z.number().min(0.8).max(1.4).optional(),
    reduceMotion: z.boolean().optional(),
    highContrast: z.boolean().optional(),
    mapDensity: z.enum(['compact', 'balanced', 'detailed']).optional(),
    celebrationSounds: z.boolean().optional()
  })
  .optional();

const DataPreferencesUpdateSchema = z
  .object({
    autoExportReminders: z.boolean().optional()
  })
  .optional();

const UserPreferencesUpdateSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    radiusPreferenceMeters: z
      .number()
      .int()
      .positive()
      .max(160934, 'Radius must be under 100 miles')
      .optional(),
    statsPublic: z.boolean().optional(),
    filterCussWords: z.boolean().optional(),
    dmPermission: z.enum(['everyone', 'friends', 'nobody']).optional(),
    digestFrequency: z.enum(['immediate', 'daily', 'weekly', 'never']).optional(),
    notifications: NotificationPreferencesUpdateSchema,
    notificationsMutedUntil: z.union([z.string().datetime(), z.null()]).optional(),
    display: DisplayPreferencesUpdateSchema,
    data: DataPreferencesUpdateSchema
  })
  .refine(
    (value) => hasDefinedValue(value),
    'Provide at least one preference field to update.'
  )
  .optional();

const UserSelfUpdateSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name cannot be empty')
      .max(80, 'Display name must be 80 characters or fewer')
      .optional(),
    bio: z
      .union([z.string().trim().max(500, 'Bio must be 500 characters or fewer'), z.literal(null)])
      .optional(),
    locationSharingEnabled: z.boolean().optional(),
    avatar: z.union([MediaAssetUpdateSchema, z.literal(null)]).optional(),
    banner: z.union([MediaAssetUpdateSchema, z.literal(null)]).optional(),
    preferences: UserPreferencesUpdateSchema
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'Provide at least one field to update.'
  );

const ModifyBlockedUserSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, 'User id is required')
    .refine((value) => mongoose.Types.ObjectId.isValid(value), { message: 'Invalid user id' })
});

const parseDateOrNull = (value) => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid uploadedAt timestamp');
  }
  return parsed;
};

const normalizeMediaAssetInput = (asset) => {
  if (!asset) {
    return undefined;
  }

  const payload = {
    url: asset.url.trim(),
    thumbnailUrl: asset.thumbnailUrl ? asset.thumbnailUrl.trim() : undefined,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType ? asset.mimeType.trim() : undefined,
    description: asset.description,
    uploadedAt: parseDateOrNull(asset.uploadedAt),
    uploadedBy:
      asset.uploadedBy && mongoose.Types.ObjectId.isValid(asset.uploadedBy)
        ? new mongoose.Types.ObjectId(asset.uploadedBy)
        : undefined
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
};

const resolveViewerUser = async (req) => {
  if (!req?.user?.uid) {
    return null;
  }

  try {
    const viewer = await User.findOne({ firebaseUid: req.user.uid });
    return viewer;
  } catch (error) {
    console.error('Failed to resolve viewer user for users route:', error);
    return null;
  }
};

const mapMediaAssetResponse = (asset) => mapMediaAsset(asset, { toIdString });

const buildAvatarMedia = (userDoc) => mapUserAvatar(userDoc, { toIdString });

const mapRelationships = (relationships) => {
  if (!relationships) {
    return undefined;
  }

  return {
    followerIds: mapIdList(relationships.followerIds),
    followingIds: mapIdList(relationships.followingIds),
    friendIds: mapIdList(relationships.friendIds),
    mutedUserIds: mapIdList(relationships.mutedUserIds),
    blockedUserIds: mapIdList(relationships.blockedUserIds)
  };
};

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [];
};

const ensureUserRelationships = (userDoc) => {
  if (!userDoc) {
    return null;
  }

  if (!userDoc.relationships) {
    userDoc.relationships = {
      followerIds: [],
      followingIds: [],
      friendIds: [],
      mutedUserIds: [],
      blockedUserIds: []
    };
    return userDoc.relationships;
  }

  const relationships = userDoc.relationships;
  relationships.followerIds = ensureArray(relationships.followerIds);
  relationships.followingIds = ensureArray(relationships.followingIds);
  relationships.friendIds = ensureArray(relationships.friendIds);
  relationships.mutedUserIds = ensureArray(relationships.mutedUserIds);
  relationships.blockedUserIds = ensureArray(relationships.blockedUserIds);

  return relationships;
};

const blockRelationshipFieldsToClear = ['followerIds', 'followingIds', 'friendIds', 'mutedUserIds'];

const toObjectIdOrNull = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

const mapUserToPublic = (userDoc) => {
  const doc = userDoc.toObject ? userDoc.toObject() : userDoc;
  const result = PublicUserSchema.safeParse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar: buildAvatarMedia(doc),
    stats: doc.stats || undefined,
    badges: doc.badges || [],
    primaryLocationId: toIdString(doc.primaryLocationId),
    accountStatus: doc.accountStatus || 'active'
  });

  if (!result.success) {
    const error = result.error;
    error.userId = toIdString(doc._id);
    throw error;
  }

  return result.data;
};

const mapUserToProfile = (userDoc) => {
  const doc = userDoc.toObject();
  const preferences = doc.preferences ? { ...doc.preferences } : undefined;
  if (preferences?.notificationsMutedUntil) {
    const mutedDate = new Date(preferences.notificationsMutedUntil);
    preferences.notificationsMutedUntil = Number.isNaN(mutedDate.getTime())
      ? undefined
      : mutedDate.toISOString();
  }
  const createdAt = toIsoDateString(userDoc.createdAt) ?? toIsoDateString(userDoc._id?.getTimestamp?.());
  const updatedAt = toIsoDateString(userDoc.updatedAt) ?? createdAt ?? new Date().toISOString();
  const result = UserProfileSchema.safeParse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar: buildAvatarMedia(doc),
    stats: doc.stats || undefined,
    badges: doc.badges || [],
    primaryLocationId: toIdString(doc.primaryLocationId),
    accountStatus: doc.accountStatus || 'active',
    email: doc.email || undefined,
    bio: doc.bio || undefined,
    banner: mapMediaAssetResponse(doc.banner),
    preferences: preferences || undefined,
    relationships: mapRelationships(doc.relationships),
    locationSharingEnabled: Boolean(doc.locationSharingEnabled),
    pinnedPinIds: mapIdList(doc.pinnedPinIds),
    ownedPinIds: mapIdList(doc.ownedPinIds),
    bookmarkCollectionIds: mapIdList(doc.bookmarkCollectionIds),
    proximityChatRoomIds: mapIdList(doc.proximityChatRoomIds),
    recentLocationIds: mapIdList(doc.recentLocationIds),
    mutualFriendCount: 0,
    mutualFriends: [],
    createdAt: createdAt ?? new Date().toISOString(),
    updatedAt,
    audit: undefined
  });

  if (!result.success) {
    const error = result.error;
    error.userId = toIdString(doc._id);
    throw error;
  }

  return result.data;
};

const loadBlockedUsers = async (userDoc) => {
  const relationships = ensureUserRelationships(userDoc);
  if (!relationships) {
    return [];
  }

  const blockedIdStrings = mapIdList(relationships.blockedUserIds);
  if (blockedIdStrings.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(
    new Set(
      blockedIdStrings.filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );

  if (uniqueIds.length === 0) {
    return [];
  }

  const objectIds = uniqueIds
    .map((id) => toObjectIdOrNull(id))
    .filter(Boolean);

  if (!objectIds.length) {
    return [];
  }

  const users = await User.find({ _id: { $in: objectIds } });
  const usersById = new Map(users.map((user) => [toIdString(user._id), user]));

  const blockedUsers = [];
  for (const id of blockedIdStrings) {
    const doc = usersById.get(id);
    if (!doc) {
      continue;
    }

    try {
      blockedUsers.push(mapUserToPublic(doc));
    } catch (error) {
      console.warn('Failed to map blocked user while building payload', {
        userId: id,
        error
      });
    }
  }

  return blockedUsers;
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

const mapDataExportRequest = (doc) => {
  if (!doc) {
    return null;
  }
  const payload = doc.toObject ? doc.toObject() : doc;
  return {
    id: toIdString(payload._id),
    status: payload.status,
    requestedAt: toIsoDateString(payload.requestedAt) ?? toIsoDateString(payload.createdAt),
    completedAt: toIsoDateString(payload.completedAt),
    expiresAt: toIsoDateString(payload.expiresAt),
    downloadUrl: payload.downloadUrl || undefined,
    failureReason: payload.failureReason || undefined
  };
};

const mapApiToken = (doc) => {
  if (!doc) {
    return null;
  }
  const payload = doc.toObject ? doc.toObject() : doc;
  return {
    id: toIdString(payload._id),
    label: payload.label || 'Personal access token',
    preview: payload.preview,
    createdAt: toIsoDateString(payload.createdAt) ?? new Date().toISOString(),
    lastUsedAt: toIsoDateString(payload.lastUsedAt),
    revokedAt: toIsoDateString(payload.revokedAt)
  };
};

const mapPinToListItem = (pinDoc, creator, options = {}) => {
  const doc = pinDoc.toObject();
  const viewerHasBookmarked =
    typeof options.viewerHasBookmarked === 'boolean' ? options.viewerHasBookmarked : undefined;
  const viewerIsAttending =
    typeof options.viewerIsAttending === 'boolean' ? options.viewerIsAttending : undefined;
  const viewerOwnsPin =
    typeof options.viewerOwnsPin === 'boolean' ? options.viewerOwnsPin : undefined;

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
    isBookmarked: viewerHasBookmarked,
    viewerHasBookmarked,
    viewerIsAttending,
    viewerOwnsPin,
    replyCount: doc.replyCount ?? undefined,
    stats: doc.stats || undefined,
    options: mapPinOptions(doc.options)
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

    const users = await User.find(criteria).sort({ updatedAt: -1 }).limit(query.limit);

    const payload = [];
    const skippedUsers = [];

    for (const user of users) {
      try {
        payload.push(mapUserToPublic(user));
      } catch (error) {
        if (error instanceof ZodError) {
          skippedUsers.push({
            userId: toIdString(user._id),
            issues: error.errors
          });
          continue;
        }
        throw error;
      }
    }

    if (skippedUsers.length > 0) {
      console.warn('Skipped malformed user documents', skippedUsers);
    }

    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid user query', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load users' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    try {
      const payload = mapUserToProfile(viewer);
      return res.json(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(500).json({
          message: 'User profile data is malformed',
          issues: error.errors,
          userId: toIdString(viewer._id)
        });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to load user profile' });
  }
});

router.patch('/me', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const input = UserSelfUpdateSchema.parse(req.body);
    const setDoc = {};
    const unsetDoc = {};

    if (input.displayName !== undefined) {
      const trimmedDisplayName = input.displayName.trim();
      if (!trimmedDisplayName) {
        return res.status(400).json({ message: 'Display name cannot be empty' });
      }
      setDoc.displayName = trimmedDisplayName;
    }

    if (input.bio !== undefined) {
      if (input.bio === null || input.bio === '') {
        unsetDoc.bio = '';
      } else {
        setDoc.bio = input.bio;
      }
    }

    if (input.locationSharingEnabled !== undefined) {
      setDoc.locationSharingEnabled = input.locationSharingEnabled;
    }

    if (input.avatar !== undefined) {
      if (input.avatar === null) {
        unsetDoc.avatar = '';
      } else {
        try {
          setDoc.avatar = normalizeMediaAssetInput(input.avatar);
        } catch (error) {
          return res.status(400).json({ message: error.message || 'Invalid avatar payload' });
        }
      }
    }

    if (input.banner !== undefined) {
      if (input.banner === null) {
        unsetDoc.banner = '';
      } else {
        try {
          setDoc.banner = normalizeMediaAssetInput(input.banner);
        } catch (error) {
          return res.status(400).json({ message: error.message || 'Invalid banner payload' });
        }
      }
    }

    if (input.preferences && typeof input.preferences === 'object') {
      if (input.preferences.theme !== undefined) {
        setDoc['preferences.theme'] = input.preferences.theme;
      }
      if (input.preferences.radiusPreferenceMeters !== undefined) {
        setDoc['preferences.radiusPreferenceMeters'] = input.preferences.radiusPreferenceMeters;
      }
      if (input.preferences.statsPublic !== undefined) {
        setDoc['preferences.statsPublic'] = input.preferences.statsPublic;
      }
      if (input.preferences.filterCussWords !== undefined) {
        setDoc['preferences.filterCussWords'] = input.preferences.filterCussWords;
      }
      if (input.preferences.dmPermission !== undefined) {
        setDoc['preferences.dmPermission'] = input.preferences.dmPermission;
      }
      if (input.preferences.digestFrequency !== undefined) {
        setDoc['preferences.digestFrequency'] = input.preferences.digestFrequency;
      }
      if (input.preferences.notifications && typeof input.preferences.notifications === 'object') {
        const notifications = input.preferences.notifications;
        if (notifications.proximity !== undefined) {
          setDoc['preferences.notifications.proximity'] = notifications.proximity;
        }
        if (notifications.updates !== undefined) {
          setDoc['preferences.notifications.updates'] = notifications.updates;
        }
        if (notifications.marketing !== undefined) {
          setDoc['preferences.notifications.marketing'] = notifications.marketing;
        }
        if (notifications.chatTransitions !== undefined) {
          setDoc['preferences.notifications.chatTransitions'] = notifications.chatTransitions;
        }
        if (notifications.friendRequests !== undefined) {
          setDoc['preferences.notifications.friendRequests'] = notifications.friendRequests;
        }
        if (notifications.badgeUnlocks !== undefined) {
          setDoc['preferences.notifications.badgeUnlocks'] = notifications.badgeUnlocks;
        }
        if (notifications.moderationAlerts !== undefined) {
          setDoc['preferences.notifications.moderationAlerts'] = notifications.moderationAlerts;
        }
        if (notifications.dmMentions !== undefined) {
          setDoc['preferences.notifications.dmMentions'] = notifications.dmMentions;
        }
        if (notifications.emailDigests !== undefined) {
          setDoc['preferences.notifications.emailDigests'] = notifications.emailDigests;
        }
      }
      if (input.preferences.notificationsMutedUntil !== undefined) {
        const muteValue = input.preferences.notificationsMutedUntil;
        if (muteValue === null) {
          unsetDoc['preferences.notificationsMutedUntil'] = '';
        } else {
          const muteDate = new Date(muteValue);
          if (Number.isNaN(muteDate.getTime())) {
            return res.status(400).json({ message: 'Invalid notificationsMutedUntil timestamp' });
          }
          setDoc['preferences.notificationsMutedUntil'] = muteDate;
        }
      }
      if (input.preferences.display && typeof input.preferences.display === 'object') {
        const display = input.preferences.display;
        if (display.textScale !== undefined) {
          setDoc['preferences.display.textScale'] = display.textScale;
        }
        if (display.reduceMotion !== undefined) {
          setDoc['preferences.display.reduceMotion'] = display.reduceMotion;
        }
        if (display.highContrast !== undefined) {
          setDoc['preferences.display.highContrast'] = display.highContrast;
        }
        if (display.mapDensity !== undefined) {
          setDoc['preferences.display.mapDensity'] = display.mapDensity;
        }
        if (display.celebrationSounds !== undefined) {
          setDoc['preferences.display.celebrationSounds'] = display.celebrationSounds;
        }
      }
      if (input.preferences.data && typeof input.preferences.data === 'object') {
        const dataPrefs = input.preferences.data;
        if (dataPrefs.autoExportReminders !== undefined) {
          setDoc['preferences.data.autoExportReminders'] = dataPrefs.autoExportReminders;
        }
      }
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

    const updatedUser = await User.findByIdAndUpdate(viewer._id, updateOps, {
      new: true,
      runValidators: true
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    try {
      const payload = mapUserToProfile(updatedUser);
      res.json(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(500).json({
          message: 'User profile data is malformed after update',
          issues: error.errors,
          userId: toIdString(updatedUser._id)
        });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid update payload', issues: error.errors });
    }
    console.error('Failed to update user profile:', error);
    res.status(500).json({ message: 'Failed to update user profile' });
  }
});

router.post('/me/badges/:badgeId', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { badgeId } = req.params;
    const result = await grantBadge({
      userId: viewer._id,
      badgeId: badgeId.trim().toLowerCase(),
      sourceUserId: viewer._id
    });

    res.json({
      granted: result.granted,
      badgeId: result.badge.id,
      badges: result.badges
    });
  } catch (error) {
    if (error.message && error.message.startsWith('Unknown badge')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Failed to grant badge to current user:', error);
    res.status(500).json({ message: 'Failed to grant badge' });
  }
});

router.get('/me/blocked', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    ensureUserRelationships(viewer);
    const blockedUsers = await loadBlockedUsers(viewer);
    res.json({
      blockedUsers,
      relationships: mapRelationships(viewer.relationships)
    });
  } catch (error) {
    console.error('Failed to load blocked users:', error);
    res.status(500).json({ message: 'Failed to load blocked users' });
  }
});

router.post('/me/blocked', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { userId } = ModifyBlockedUserSchema.parse(req.body ?? {});
    const viewerId = toIdString(viewer._id);
    if (viewerId === userId) {
      return res.status(400).json({ message: 'You cannot block yourself' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    const relationships = ensureUserRelationships(viewer);
    const targetIdString = toIdString(targetUser._id);
    let changed = false;

    if (!relationships.blockedUserIds.some((entry) => toIdString(entry) === targetIdString)) {
      relationships.blockedUserIds.push(targetUser._id);
      changed = true;
    }

    for (const field of blockRelationshipFieldsToClear) {
      const currentList = ensureArray(relationships[field]);
      const filtered = currentList.filter((entry) => toIdString(entry) !== targetIdString);
      if (filtered.length !== currentList.length) {
        relationships[field] = filtered;
        changed = true;
      } else {
        relationships[field] = currentList;
      }
    }

    if (changed) {
      viewer.markModified('relationships');
      await viewer.save();
    }

    const blockedUsers = await loadBlockedUsers(viewer);
    res.json({
      blockedUsers,
      updatedRelationships: mapRelationships(viewer.relationships)
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid block request', issues: error.errors });
    }
    console.error('Failed to block user:', error);
    res.status(500).json({ message: 'Failed to block user' });
  }
});

router.delete('/me/blocked/:userId', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { userId } = ModifyBlockedUserSchema.parse({ userId: req.params.userId });
    const relationships = ensureUserRelationships(viewer);

    const previousCount = relationships.blockedUserIds.length;
    relationships.blockedUserIds = relationships.blockedUserIds.filter(
      (entry) => toIdString(entry) !== userId
    );

    if (relationships.blockedUserIds.length !== previousCount) {
      viewer.markModified('relationships');
      await viewer.save();
    }

    const blockedUsers = await loadBlockedUsers(viewer);
    res.json({
      blockedUsers,
      updatedRelationships: mapRelationships(viewer.relationships)
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid unblock request', issues: error.errors });
    }
    console.error('Failed to unblock user:', error);
    res.status(500).json({ message: 'Failed to unblock user' });
  }
});

router.post('/me/push-tokens', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const input = PushTokenSchema.parse(req.body ?? {});
    const token = input.token.trim();
    if (!token) {
      return res.status(400).json({ message: 'Token must not be empty' });
    }
    const platform = input.platform?.trim() || 'web';

    if (!Array.isArray(viewer.messagingTokens)) {
      viewer.messagingTokens = [];
    }

    const now = new Date();
    const existingIndex = viewer.messagingTokens.findIndex((entry) => entry.token === token);
    if (existingIndex !== -1) {
      viewer.messagingTokens[existingIndex].platform = platform;
      viewer.messagingTokens[existingIndex].lastSeenAt = now;
    } else {
      viewer.messagingTokens.push({
        token,
        platform,
        addedAt: now,
        lastSeenAt: now
      });
    }

    if (viewer.messagingTokens.length > 15) {
      viewer.messagingTokens = viewer.messagingTokens.slice(viewer.messagingTokens.length - 15);
    }

    await viewer.save();

    res.status(existingIndex === -1 ? 201 : 200).json({
      token,
      platform,
      total: viewer.messagingTokens.length
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid push token payload', issues: error.errors });
    }
    console.error('Failed to register push token:', error);
    res.status(500).json({ message: 'Failed to register push token' });
  }
});

router.post('/me/data-export', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const input = DataExportRequestSchema.parse(req.body ?? {});
    const now = new Date();
    const cutoff = new Date(now.getTime() - DATA_EXPORT_COOLDOWN_MS);

    const existing = await DataExportRequest.findOne({
      userId: viewer._id,
      requestedAt: { $gte: cutoff },
      status: { $in: ['queued', 'processing'] }
    }).sort({ requestedAt: -1 });

    if (existing) {
      return res.status(202).json({
        request: mapDataExportRequest(existing),
        duplicate: true
      });
    }

    const requestDoc = await DataExportRequest.create({
      userId: viewer._id,
      status: 'queued',
      requestedAt: now,
      metadata: {
        reason: input?.reason || undefined,
        requestedFrom: req.headers['user-agent'] || 'settings-page'
      }
    });

    res.status(202).json({ request: mapDataExportRequest(requestDoc) });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid export payload', issues: error.errors });
    }
    console.error('Failed to request data export:', error);
    if (typeof req.logError === 'function') {
      req.logError(error, { route: 'users:data-export' });
    }
    res.status(500).json({ message: 'Failed to request data export' });
  }
});

router.get('/me/api-tokens', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const tokens = await ApiToken.find({ userId: viewer._id, revokedAt: null })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ tokens: tokens.map((token) => mapApiToken(token)) });
  } catch (error) {
    console.error('Failed to load API tokens:', error);
    if (typeof req.logError === 'function') {
      req.logError(error, { route: 'users:list-api-tokens' });
    }
    res.status(500).json({ message: 'Failed to load API tokens' });
  }
});

router.post('/me/api-tokens', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const input = ApiTokenCreateSchema.parse(req.body ?? {});
    const activeCount = await ApiToken.countDocuments({ userId: viewer._id, revokedAt: null });
    if (activeCount >= MAX_ACTIVE_API_TOKENS) {
      return res
        .status(400)
        .json({ message: `You can only keep ${MAX_ACTIVE_API_TOKENS} active tokens.` });
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const preview = secret.slice(0, 6);

    const tokenDoc = await ApiToken.create({
      userId: viewer._id,
      label: input?.label?.trim() || `Token ${activeCount + 1}`,
      hash,
      preview
    });

    res.status(201).json({
      token: mapApiToken(tokenDoc),
      secret
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid token payload', issues: error.errors });
    }
    console.error('Failed to create API token:', error);
    if (typeof req.logError === 'function') {
      req.logError(error, { route: 'users:create-api-token' });
    }
    res.status(500).json({ message: 'Failed to create API token' });
  }
});

router.delete('/me/api-tokens/:tokenId', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { tokenId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tokenId)) {
      return res.status(400).json({ message: 'Invalid token id' });
    }

    const token = await ApiToken.findOne({ _id: tokenId, userId: viewer._id });
    if (!token) {
      return res.status(404).json({ message: 'Token not found' });
    }

    if (!token.revokedAt) {
      token.revokedAt = new Date();
      await token.save();
    }

    res.json({ token: mapApiToken(token) });
  } catch (error) {
    console.error('Failed to revoke API token:', error);
    if (typeof req.logError === 'function') {
      req.logError(error, { route: 'users:revoke-api-token' });
    }
    res.status(500).json({ message: 'Failed to revoke API token' });
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

    const viewer = await resolveViewerUser(req);

    try {
      const payload = mapUserToProfile(user);

      if (viewer && user && !viewer._id.equals(user._id)) {
        const viewerFriends = new Set(mapIdList(viewer.relationships?.friendIds));
        const targetFriends = mapIdList(user.relationships?.friendIds);
        const viewerBlocked = new Set(mapIdList(viewer.relationships?.blockedUserIds));
        const targetBlocked = new Set(mapIdList(user.relationships?.blockedUserIds));
        const mutualIds = targetFriends.filter((id) => {
          if (!viewerFriends.has(id)) {
            return false;
          }
          if (viewerBlocked.has(id) || targetBlocked.has(id)) {
            return false;
          }
          return id !== toIdString(viewer._id);
        });

        if (mutualIds.length > 0) {
          const uniqueIds = Array.from(new Set(mutualIds)).filter((id) => mongoose.Types.ObjectId.isValid(id));
          const objectIds = uniqueIds.slice(0, 12).map((id) => new mongoose.Types.ObjectId(id));
          if (objectIds.length) {
            const mutualDocs = await User.find({ _id: { $in: objectIds } });
            const mutualPreviews = mutualDocs
              .map((doc) => {
                try {
                  return mapUserToPublic(doc);
                } catch (error) {
                  console.warn('Failed to map mutual friend for profile payload', {
                    userId: toIdString(doc._id),
                    error
                  });
                  return null;
                }
              })
              .filter(Boolean);
            payload.mutualFriendCount = mutualIds.length;
            payload.mutualFriends = mutualPreviews;
          } else {
            payload.mutualFriendCount = mutualIds.length;
            payload.mutualFriends = [];
          }
        }
      }

      res.json(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(500).json({
          message: 'User profile data is malformed',
          issues: error.errors,
          userId: userId
        });
      }
      throw error;
    }
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
