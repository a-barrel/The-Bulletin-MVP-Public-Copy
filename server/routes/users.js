const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const User = require('../models/User');
const Pin = require('../models/Pin');
const { PublicUserSchema, UserProfileSchema } = require('../schemas/user');
const { PinListItemSchema } = require('../schemas/pin');
const verifyToken = require('../middleware/verifyToken');
const { grantBadge } = require('../services/badgeService');

const router = express.Router();

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

const UserPreferencesUpdateSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    radiusPreferenceMeters: z.number().int().positive().max(160934, 'Radius must be under 100 miles').optional(),
    statsPublic: z.boolean().optional(),
    filterCussWords: z.boolean().optional(),
    notifications: z
      .object({
        proximity: z.boolean().optional(),
        updates: z.boolean().optional(),
        marketing: z.boolean().optional()
      })
      .optional()
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
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
    console.error('Failed to resolve viewer user for users route:', error);
    return null;
  }
};

const normalizeMediaUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const TF2_AVATAR_MAP = {
  'tf2_scout': '/images/emulation/avatars/Scoutava.jpg',
  'tf2_soldier': '/images/emulation/avatars/Soldierava.jpg',
  'tf2_pyro': '/images/emulation/avatars/Pyroava.jpg',
  'tf2_demoman': '/images/emulation/avatars/Demomanava.jpg',
  'tf2_heavy': '/images/emulation/avatars/Heavyava.jpg',
  'tf2_engineer': '/images/emulation/avatars/Engineerava.jpg',
  'tf2_medic': '/images/emulation/avatars/Medicava.jpg',
  'tf2_sniper': '/images/emulation/avatars/Sniperava.jpg',
  'tf2_spy': '/images/emulation/avatars/Spyava.jpg'
};

const mapMediaAssetResponse = (asset) => {
  if (!asset) {
    return undefined;
  }

  const doc = asset.toObject ? asset.toObject() : asset;
  const normalizedUrl = normalizeMediaUrl(doc.url);
  const normalizedThumb = normalizeMediaUrl(doc.thumbnailUrl);
  const normalizedPath = normalizeMediaUrl(doc.path);
  const primaryUrl = normalizedUrl ?? normalizedThumb ?? normalizedPath;
  const thumbnailUrl = normalizedThumb ?? (primaryUrl && primaryUrl !== normalizedThumb ? primaryUrl : undefined);
  return {
    url: primaryUrl,
    thumbnailUrl,
    width: doc.width ?? undefined,
    height: doc.height ?? undefined,
    mimeType: doc.mimeType || undefined,
    description: doc.description || undefined,
    uploadedAt: toIsoDateString(doc.uploadedAt),
    uploadedBy: toIdString(doc.uploadedBy)
  };
};

const buildAvatarMedia = (userDoc) => {
  const avatar = mapMediaAssetResponse(userDoc.avatar);
  const fallbackUrl = TF2_AVATAR_MAP[userDoc.username];
  const needsFallback =
    fallbackUrl &&
    (!avatar ||
      !avatar.url ||
      /\/images\/profile\/profile-\d+\.jpg$/i.test(avatar.url));

  if (!needsFallback) {
    return avatar;
  }

  const normalized = normalizeMediaUrl(fallbackUrl);
  return {
    url: normalized,
    thumbnailUrl: normalized,
    width: avatar?.width ?? 184,
    height: avatar?.height ?? 184,
    mimeType: 'image/jpeg'
  };
};

const mapRelationships = (relationships) => {
  if (!relationships) {
    return undefined;
  }

  return {
    followerIds: (relationships.followerIds || []).map(toIdString),
    followingIds: (relationships.followingIds || []).map(toIdString),
    friendIds: (relationships.friendIds || []).map(toIdString),
    mutedUserIds: (relationships.mutedUserIds || []).map(toIdString),
    blockedUserIds: (relationships.blockedUserIds || []).map(toIdString)
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
    preferences: doc.preferences || undefined,
    relationships: mapRelationships(doc.relationships),
    locationSharingEnabled: Boolean(doc.locationSharingEnabled),
    pinnedPinIds: (doc.pinnedPinIds || []).map(toIdString),
    ownedPinIds: (doc.ownedPinIds || []).map(toIdString),
    bookmarkCollectionIds: (doc.bookmarkCollectionIds || []).map(toIdString),
    proximityChatRoomIds: (doc.proximityChatRoomIds || []).map(toIdString),
    recentLocationIds: (doc.recentLocationIds || []).map(toIdString),
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

  const blockedIdStrings = relationships.blockedUserIds.map(toIdString).filter(Boolean);
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

    try {
      const payload = mapUserToProfile(user);
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
