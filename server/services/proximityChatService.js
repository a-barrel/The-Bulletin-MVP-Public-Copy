const mongoose = require('mongoose');
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
  tf2_scout: '/images/emulation/avatars/Scoutava.jpg',
  tf2_soldier: '/images/emulation/avatars/Soldierava.jpg',
  tf2_pyro: '/images/emulation/avatars/Pyroava.jpg',
  tf2_demoman: '/images/emulation/avatars/Demomanava.jpg',
  tf2_heavy: '/images/emulation/avatars/Heavyava.jpg',
  tf2_engineer: '/images/emulation/avatars/Engineerava.jpg',
  tf2_medic: '/images/emulation/avatars/Medicava.jpg',
  tf2_sniper: '/images/emulation/avatars/Sniperava.jpg',
  tf2_spy: '/images/emulation/avatars/Spyava.jpg'
};

const mapMediaAsset = (asset) => {
  if (!asset) {
    return undefined;
  }

  const doc = asset.toObject ? asset.toObject() : asset;
  const url = normalizeMediaUrl(doc.url || doc.thumbnailUrl);
  if (!url || typeof url !== 'string' || !url.trim()) {
    return undefined;
  }

  const payload = {
    url,
    thumbnailUrl: normalizeMediaUrl(doc.thumbnailUrl),
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

const buildAvatarMedia = (userDoc) => {
  if (!userDoc) {
    return undefined;
  }

  const doc = userDoc.toObject ? userDoc.toObject() : userDoc;
  const avatar = mapMediaAsset(doc.avatar);
  const fallbackUrl = TF2_AVATAR_MAP[doc.username];
  const shouldUseFallback =
    fallbackUrl &&
    (!avatar?.url || /\/images\/profile\/profile-\d+\.jpg$/i.test(avatar.url));

  if (!shouldUseFallback) {
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

const mapUserToPublic = (user) => {
  if (!user) return undefined;
  const doc = user.toObject ? user.toObject() : user;
  return PublicUserSchema.parse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar: buildAvatarMedia(doc),
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
    presetKey: typeof doc.presetKey === 'string' && doc.presetKey.trim().length > 0 ? doc.presetKey.trim() : undefined,
    createdAt: roomDoc.createdAt.toISOString(),
    updatedAt: roomDoc.updatedAt.toISOString(),
    audit: doc.audit ? buildAudit(doc.audit, roomDoc.createdAt, roomDoc.updatedAt) : undefined
  });
};

const mapMessage = (messageDoc) => {
  const doc = messageDoc.toObject();
  const coordinates =
    doc.coordinates &&
    Array.isArray(doc.coordinates.coordinates) &&
    doc.coordinates.coordinates.length === 2
      ? {
          type: 'Point',
          coordinates: doc.coordinates.coordinates,
          accuracy: doc.coordinates.accuracy ?? undefined
        }
      : undefined;

  const attachments = Array.isArray(doc.attachments)
    ? doc.attachments.map(mapMediaAsset).filter(Boolean)
    : [];

  return ProximityChatMessageSchema.parse({
    _id: toIdString(doc._id),
    roomId: toIdString(doc.roomId),
    pinId: toIdString(doc.pinId),
    authorId: toIdString(doc.authorId),
    author: mapUserToPublic(doc.authorId),
    replyToMessageId: toIdString(doc.replyToMessageId),
    message: doc.message,
    coordinates,
    attachments,
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

const toObjectId = (value) => {
  if (!value) {
    return undefined;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return new mongoose.Types.ObjectId(value);
};

async function createRoom(input) {
  const participantIds = (input.participantIds || []).map(toObjectId).filter(Boolean);
  const room = await ProximityChatRoom.create({
    ownerId: toObjectId(input.ownerId),
    name: input.name,
    description: input.description,
    coordinates: {
      type: 'Point',
      coordinates: [input.longitude, input.latitude],
      accuracy: input.accuracy
    },
    radiusMeters: input.radiusMeters,
    participantIds,
    participantCount: participantIds.length,
    moderatorIds: (input.moderatorIds || []).map(toObjectId).filter(Boolean),
    pinId: toObjectId(input.pinId),
    presetKey: input.presetKey && input.presetKey.trim ? input.presetKey.trim() : undefined,
    isGlobal: Boolean(input.isGlobal)
  });

  return mapRoom(room);
}

async function createMessage(input) {
  let coordinates;
  if (input.latitude !== undefined && input.longitude !== undefined) {
    coordinates = {
      type: 'Point',
      coordinates: [input.longitude, input.latitude],
      accuracy: input.accuracy
    };
  }

  const attachments = Array.isArray(input.attachments)
    ? input.attachments.map(mapMediaAsset).filter(Boolean)
    : [];

  const message = await ProximityChatMessage.create({
    roomId: toObjectId(input.roomId),
    pinId: toObjectId(input.pinId),
    authorId: toObjectId(input.authorId),
    replyToMessageId: toObjectId(input.replyToMessageId),
    message: input.message,
    coordinates,
    attachments
  });

  const populated = await message.populate('authorId');
  return {
    messageDoc: populated,
    response: mapMessage(populated)
  };
}

async function upsertPresence(input) {
  const now = new Date();
  const presence = await ProximityChatPresence.findOneAndUpdate(
    {
      roomId: toObjectId(input.roomId),
      userId: toObjectId(input.userId)
    },
    {
      roomId: toObjectId(input.roomId),
      userId: toObjectId(input.userId),
      sessionId: toObjectId(input.sessionId),
      joinedAt: input.joinedAt ? new Date(input.joinedAt) : now,
      lastActiveAt: input.lastActiveAt ? new Date(input.lastActiveAt) : now
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return mapPresence(presence);
}

module.exports = {
  mapRoom,
  mapMessage,
  mapPresence,
  createRoom,
  createMessage,
  upsertPresence
};
