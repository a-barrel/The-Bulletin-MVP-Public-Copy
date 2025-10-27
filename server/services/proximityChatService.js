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

const mapUserToPublic = (user) => {
  if (!user) return undefined;
  const doc = user.toObject ? user.toObject() : user;
  return PublicUserSchema.parse({
    _id: toIdString(doc._id),
    username: doc.username,
    displayName: doc.displayName,
    avatar: mapMediaAsset(doc.avatar),
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

  return ProximityChatMessageSchema.parse({
    _id: toIdString(doc._id),
    roomId: toIdString(doc.roomId),
    pinId: toIdString(doc.pinId),
    authorId: toIdString(doc.authorId),
    author: mapUserToPublic(doc.authorId),
    replyToMessageId: toIdString(doc.replyToMessageId),
    message: doc.message,
    coordinates,
    attachments: doc.attachments || [],
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

  const message = await ProximityChatMessage.create({
    roomId: toObjectId(input.roomId),
    pinId: toObjectId(input.pinId),
    authorId: toObjectId(input.authorId),
    replyToMessageId: toObjectId(input.replyToMessageId),
    message: input.message,
    coordinates
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
