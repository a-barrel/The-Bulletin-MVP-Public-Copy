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
    uploadedAt: toIsoDateString(doc.uploadedAt),
    uploadedBy: toIdString(doc.uploadedBy)
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

const mapUserToPublic = (userDoc) => {
  const doc = userDoc.toObject ? userDoc.toObject() : userDoc;
  const result = PublicUserSchema.safeParse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar: mapMediaAssetResponse(doc.avatar),
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
    avatar: mapMediaAssetResponse(doc.avatar),
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
