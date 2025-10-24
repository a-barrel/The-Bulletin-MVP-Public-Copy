const mongoose = require('mongoose');
const Update = require('../models/Update');
const User = require('../models/User');
const Pin = require('../models/Pin');
const { PinPreviewSchema } = require('../schemas/pin');

const toIdString = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value._id) return value._id.toString();
  return String(value);
};

const toObjectId = (value) => {
  if (!value) return undefined;
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  try {
    return new mongoose.Types.ObjectId(value);
  } catch {
    return undefined;
  }
};

const truncate = (value, length) => {
  if (!value) return undefined;
  const text = String(value);
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length - 1).trimEnd()}...`;
};

const getDisplayName = (userDoc) => {
  if (!userDoc) {
    return 'Someone';
  }
  const doc = userDoc.toObject ? userDoc.toObject() : userDoc;
  return doc.displayName || doc.username || doc.email || 'Someone';
};

const buildPinPreview = (pinDoc) => {
  const doc = pinDoc.toObject ? pinDoc.toObject({ depopulate: false }) : pinDoc;
  const creatorId = toIdString(doc.creatorId?._id ?? doc.creatorId);
  const coordinates = doc.coordinates?.coordinates || [0, 0];

  return PinPreviewSchema.parse({
    _id: toIdString(doc._id),
    type: doc.type,
    creatorId,
    creator: undefined,
    title: doc.title,
    coordinates: {
      type: 'Point',
      coordinates,
      accuracy: doc.coordinates?.accuracy ?? undefined
    },
    proximityRadiusMeters: doc.proximityRadiusMeters ?? 1609,
    linkedLocationId: toIdString(doc.linkedLocationId),
    linkedChatRoomId: toIdString(doc.linkedChatRoomId),
    startDate: doc.startDate ? new Date(doc.startDate).toISOString() : undefined,
    endDate: doc.endDate ? new Date(doc.endDate).toISOString() : undefined,
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : undefined
  });
};

const createRelatedEntity = (id, type, label, summary) => {
  const objectId = toObjectId(id);
  if (!objectId) {
    return null;
  }
  return {
    id: objectId,
    type,
    label,
    summary
  };
};

const filterRecipientsByPreference = async (recipientIds) => {
  const unique = Array.from(
    new Set(recipientIds.map((id) => toIdString(id)).filter(Boolean))
  );
  if (unique.length === 0) {
    return [];
  }

  const objectIds = unique.map((id) => new mongoose.Types.ObjectId(id));
  const users = await User.find(
    { _id: { $in: objectIds } },
    { preferences: 1 }
  ).lean();

  const allowed = new Set(
    users
      .filter(
        (user) => user?.preferences?.notifications?.updates !== false
      )
      .map((user) => user._id.toString())
  );

  return unique.filter((id) => allowed.has(id));
};

const insertUpdates = async (updates, context) => {
  if (!updates.length) {
    return;
  }
  try {
    const now = new Date();
    const payload = updates.map((update) => ({
      ...update,
      deliveredAt: update.deliveredAt ?? now,
      readAt: update.readAt ?? undefined
    }));
    await Update.insertMany(payload, { ordered: false });
  } catch (error) {
    console.error(`Failed to insert updates (${context})`, error);
  }
};

const broadcastPinCreated = async (pinDoc) => {
  try {
    const preview = buildPinPreview(pinDoc);
    const doc = pinDoc.toObject ? pinDoc.toObject({ depopulate: false }) : pinDoc;
    const creatorDoc = doc.creatorId && doc.creatorId.toObject ? doc.creatorId : doc.creatorId;
    const creatorId = toIdString(creatorDoc?._id ?? doc.creatorId);
    const creatorName = getDisplayName(creatorDoc);

    const followerIds = Array.isArray(creatorDoc?.relationships?.followerIds)
      ? creatorDoc.relationships.followerIds.map((id) => toIdString(id)).filter(Boolean)
      : [];

    const recipientIds = new Set(followerIds);
    if (creatorId) {
      recipientIds.add(creatorId);
    }

    if (recipientIds.size === 0) {
      return;
    }

    const baseBody = doc.description ? truncate(doc.description, 280) : undefined;

    const filteredRecipients = await filterRecipientsByPreference(
      Array.from(recipientIds)
    );
    if (!filteredRecipients.length) {
      return;
    }

    const updates = filteredRecipients.map((recipientId) => ({
      userId: toObjectId(recipientId),
      sourceUserId: toObjectId(creatorId),
      payload: {
        type: 'new-pin',
        title: `${creatorName} posted "${doc.title}"`,
        body: baseBody,
        metadata: {
          pinType: doc.type,
          radiusMeters: doc.proximityRadiusMeters
        },
        pin: preview,
        relatedEntities: [
          createRelatedEntity(doc._id, 'pin', doc.title),
          creatorId ? createRelatedEntity(creatorId, 'user', creatorName) : null
        ].filter(Boolean)
      }
    }));

    await insertUpdates(updates, 'pin-created');
  } catch (error) {
    console.error('Failed to fan out pin creation update', error);
  }
};

const broadcastPinReply = async ({ pin, reply, author, parentReply }) => {
  try {
    const pinDoc = pin.toObject ? pin.toObject({ depopulate: false }) : pin;
    const authorDoc = author?.toObject ? author.toObject() : author;
    const parentDoc = parentReply?.toObject ? parentReply.toObject({ depopulate: false }) : parentReply;
    const preview = buildPinPreview(pin);

    const authorId = toIdString(authorDoc?._id ?? author);
    const authorName = getDisplayName(authorDoc);

    const recipientIds = new Set();

    const pinCreatorId = toIdString(pinDoc.creatorId?._id ?? pinDoc.creatorId);
    if (pinCreatorId && pinCreatorId !== authorId) {
      recipientIds.add(pinCreatorId);
    }

    if (parentDoc?.authorId) {
      const parentAuthorId = toIdString(parentDoc.authorId?._id ?? parentDoc.authorId);
      if (parentAuthorId && parentAuthorId !== authorId) {
        recipientIds.add(parentAuthorId);
      }
    }

    if (pinDoc.type === 'event' && Array.isArray(pinDoc.attendingUserIds)) {
      pinDoc.attendingUserIds
        .map((id) => toIdString(id))
        .filter((id) => id && id !== authorId)
        .forEach((id) => recipientIds.add(id));
    }

    if (recipientIds.size === 0) {
      return;
    }

    const replyDoc = reply.toObject ? reply.toObject({ depopulate: false }) : reply;
    const replySnippet = truncate(replyDoc.message, 240);

    const filteredRecipients = await filterRecipientsByPreference(
      Array.from(recipientIds)
    );
    if (!filteredRecipients.length) {
      return;
    }

    const updates = filteredRecipients.map((recipientId) => ({
      userId: toObjectId(recipientId),
      sourceUserId: toObjectId(authorId),
      payload: {
        type: 'pin-update',
        title: `${authorName} replied to "${pinDoc.title}"`,
        body: replySnippet,
        metadata: {
          updateKind: 'reply',
          replyId: toIdString(replyDoc._id),
          parentReplyId: toIdString(replyDoc.parentReplyId)
        },
        pin: preview,
        relatedEntities: [
          createRelatedEntity(pinDoc._id, 'pin', pinDoc.title),
          createRelatedEntity(replyDoc._id, 'reply', undefined, replySnippet),
          authorId ? createRelatedEntity(authorId, 'user', authorName) : null
        ].filter(Boolean)
      }
    }));

    await insertUpdates(updates, 'pin-reply');
  } catch (error) {
    console.error('Failed to fan out pin reply update', error);
  }
};

const broadcastAttendanceChange = async ({ pin, attendee, attending }) => {
  try {
    const pinDoc = pin.toObject ? pin.toObject({ depopulate: false }) : pin;
    const preview = buildPinPreview(pin);
    const attendeeDoc = attendee?.toObject ? attendee.toObject() : attendee;

    const attendeeId = toIdString(attendeeDoc?._id ?? attendee);
    const attendeeName = getDisplayName(attendeeDoc);
    const pinCreatorId = toIdString(pinDoc.creatorId?._id ?? pinDoc.creatorId);

    const recipientIds = new Set();

    if (pinCreatorId && pinCreatorId !== attendeeId) {
      recipientIds.add(pinCreatorId);
    }

    if (recipientIds.size === 0) {
      return;
    }

    const verb = attending ? 'is attending' : 'is no longer attending';
    const title = `${attendeeName} ${verb} "${pinDoc.title}"`;

    const filteredRecipients = await filterRecipientsByPreference(
      Array.from(recipientIds)
    );
    if (!filteredRecipients.length) {
      return;
    }

    const updates = filteredRecipients.map((recipientId) => ({
      userId: toObjectId(recipientId),
      sourceUserId: toObjectId(attendeeId),
      payload: {
        type: 'pin-update',
        title,
        body: undefined,
        metadata: {
          updateKind: 'attendance',
          attending
        },
        pin: preview,
        relatedEntities: [
          createRelatedEntity(pinDoc._id, 'pin', pinDoc.title),
          attendeeId ? createRelatedEntity(attendeeId, 'user', attendeeName) : null
        ].filter(Boolean)
      }
    }));

    await insertUpdates(updates, 'pin-attendance');
  } catch (error) {
    console.error('Failed to fan out attendance update', error);
  }
};

const broadcastBookmarkCreated = async ({ pin, bookmarker }) => {
  try {
    if (!pin) {
      return;
    }

    const pinDoc = pin.toObject ? pin.toObject({ depopulate: false }) : pin;
    const preview = buildPinPreview(pin);
    const bookmarkerDoc = bookmarker?.toObject ? bookmarker.toObject() : bookmarker;

    const creatorId = toIdString(pinDoc.creatorId?._id ?? pinDoc.creatorId);
    const bookmarkerId = toIdString(bookmarkerDoc?._id ?? bookmarker);
    const creatorName = getDisplayName(pinDoc.creatorId ?? creatorId);
    const bookmarkerName = getDisplayName(bookmarkerDoc);

    if (!creatorId || !bookmarkerId || creatorId === bookmarkerId) {
      return;
    }

    const recipients = await filterRecipientsByPreference([creatorId]);
    if (!recipients.length) {
      return;
    }

    const updates = recipients.map((recipientId) => ({
      userId: toObjectId(recipientId),
      sourceUserId: toObjectId(bookmarkerId),
      payload: {
        type: 'bookmark-update',
        title: `${bookmarkerName} bookmarked "${pinDoc.title}"`,
        body: undefined,
        metadata: {
          updateKind: 'bookmark-created'
        },
        pin: preview,
        relatedEntities: [
          createRelatedEntity(pinDoc._id, 'pin', pinDoc.title),
          bookmarkerId ? createRelatedEntity(bookmarkerId, 'user', bookmarkerName) : null
        ].filter(Boolean)
      }
    }));

    await insertUpdates(updates, 'bookmark-created');
  } catch (error) {
    console.error('Failed to fan out bookmark update', error);
  }
};

const broadcastChatMessage = async ({ room, message, author }) => {
  try {
    const roomDoc = room?.toObject ? room.toObject({ depopulate: false }) : room;
    if (!roomDoc) {
      return;
    }

    const authorDoc = author?.toObject ? author.toObject() : author;
    const authorId = toIdString(authorDoc?._id ?? author);
    const authorName = getDisplayName(authorDoc);

    const recipients = new Set();
    if (Array.isArray(roomDoc.participantIds)) {
      roomDoc.participantIds
        .map((id) => toIdString(id))
        .filter((id) => id && id !== authorId)
        .forEach((id) => recipients.add(id));
    }

    if (Array.isArray(roomDoc.moderatorIds)) {
      roomDoc.moderatorIds
        .map((id) => toIdString(id))
        .filter((id) => id && id !== authorId)
        .forEach((id) => recipients.add(id));
    }

    const ownerId = toIdString(roomDoc.ownerId);
    if (ownerId && ownerId !== authorId) {
      recipients.add(ownerId);
    }

    const filteredRecipients = await filterRecipientsByPreference(Array.from(recipients));
    if (!filteredRecipients.length) {
      return;
    }

    const messageDoc = message?.toObject ? message.toObject({ depopulate: false }) : message;
    const messageSnippet = truncate(messageDoc?.message ?? '', 200);

    let pinPreview;
    if (roomDoc.pinId) {
      try {
        const pinDoc = await Pin.findById(roomDoc.pinId);
        if (pinDoc) {
          pinPreview = buildPinPreview(pinDoc);
        }
      } catch (error) {
        console.warn('Failed to load pin for chat message fan-out', error);
      }
    }

    const updates = filteredRecipients.map((recipientId) => ({
      userId: toObjectId(recipientId),
      sourceUserId: toObjectId(authorId),
      payload: {
        type: 'chat-message',
        title: `${authorName} in ${roomDoc.name}`,
        body: messageSnippet,
        metadata: {
          updateKind: 'chat-message',
          roomId: toIdString(roomDoc._id),
          messageId: toIdString(messageDoc?._id),
          pinId: toIdString(roomDoc.pinId)
        },
        pin: pinPreview,
        relatedEntities: [
          createRelatedEntity(roomDoc._id, 'chat-room', roomDoc.name),
          pinPreview ? createRelatedEntity(pinPreview._id, 'pin', pinPreview.title) : null,
          authorId ? createRelatedEntity(authorId, 'user', authorName) : null
        ].filter(Boolean)
      }
    }));

    await insertUpdates(updates, 'chat-message');
  } catch (error) {
    console.error('Failed to fan out chat message update', error);
  }
};

const broadcastBadgeEarned = async ({ userId, badge, sourceUserId }) => {
  try {
    const recipientId = toIdString(userId);
    if (!recipientId) {
      return;
    }

    const filteredRecipients = await filterRecipientsByPreference([recipientId]);
    if (!filteredRecipients.length) {
      return;
    }

    const updates = filteredRecipients.map((id) => ({
      userId: toObjectId(id),
      sourceUserId: toObjectId(sourceUserId ?? userId),
      payload: {
        type: 'badge-earned',
        title: `You earned the "${badge.label}" badge`,
        body: badge.description,
        metadata: {
          badgeId: badge.id,
          badgeImage: badge.image
        },
        relatedEntities: [
          createRelatedEntity(userId, 'user', 'You')
        ].filter(Boolean)
      }
    }));

    await insertUpdates(updates, 'badge-earned');
  } catch (error) {
    console.error('Failed to fan out badge earned update', error);
  }
};

module.exports = {
  broadcastPinCreated,
  broadcastPinReply,
  broadcastAttendanceChange,
  broadcastBookmarkCreated,
  broadcastChatMessage,
  broadcastBadgeEarned
};


