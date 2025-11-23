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
const { mapMediaAsset: mapMediaAssetResponse, mapUserAvatar } = require('../utils/media');
const { toIdString, mapIdList } = require('../utils/ids');
const { toIsoDateString } = require('../utils/dates');
const { buildPinRoomPayload } = require('../utils/chatRoomContract');

const buildAvatarMedia = (userDoc) => mapUserAvatar(userDoc, { toIdString });

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
    participantIds: mapIdList(doc.participantIds),
    moderatorIds: mapIdList(doc.moderatorIds),
    pinId: toIdString(doc.pinId),
    expiresAt: doc.expiresAt ? toIsoDateString(doc.expiresAt) : undefined,
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
    ? doc.attachments.map((attachment) => mapMediaAssetResponse(attachment, { toIdString })).filter(Boolean)
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
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
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
    ? input.attachments.map((attachment) => mapMediaAssetResponse(attachment, { toIdString })).filter(Boolean)
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

async function upsertPinRoom({
  pinId,
  pinType,
  pinTitle,
  ownerId,
  latitude,
  longitude,
  expiresAt,
  radiusMeters = 500
}) {
  if (!pinId || !ownerId) {
    throw new Error('pinId and ownerId are required to upsert a pin chat room');
  }
  const payload = buildPinRoomPayload({
    pinId: toIdString(pinId),
    pinType,
    pinTitle,
    latitude,
    longitude,
    radiusMeters
  });
  const update = {
    ownerId: toObjectId(ownerId),
    name: payload.name,
    presetKey: payload.presetKey,
    pinId: toObjectId(pinId),
    isGlobal: false,
    coordinates: {
      type: 'Point',
      coordinates: [payload.longitude ?? longitude ?? 0, payload.latitude ?? latitude ?? 0]
    },
    radiusMeters,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined
  };
  const room = await ProximityChatRoom.findOneAndUpdate(
    { pinId: toObjectId(pinId) },
    { $set: update, $setOnInsert: { participantIds: [], participantCount: 0, moderatorIds: [] } },
    { upsert: true, new: true }
  );
  return mapRoom(room);
}

async function deletePinRoomByPinId(pinId) {
  if (!pinId) {
    return { deletedCount: 0 };
  }
  return ProximityChatRoom.deleteMany({ pinId: toObjectId(pinId) });
}

module.exports = {
  mapRoom,
  mapMessage,
  mapPresence,
  createRoom,
  createMessage,
  upsertPresence,
  upsertPinRoom,
  deletePinRoomByPinId
};
