const mongoose = require('mongoose');
const Update = require('../models/Update');
const User = require('../models/User');
const Pin = require('../models/Pin');
const { Bookmark } = require('../models/Bookmark');
const Reply = require('../models/Reply');
const { PinPreviewSchema } = require('../schemas/pin');

const { toIdString } = require('../utils/ids');
const { logIntegration } = require('../utils/devLogger');

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

const normalizeDateValue = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const summarizePinChanges = (previous, updated) => {
  if (!previous || !updated) {
    return [];
  }

  const changes = new Set();
  const prevDoc = previous.toObject ? previous.toObject({ depopulate: false }) : previous;
  const nextDoc = updated.toObject ? updated.toObject({ depopulate: false }) : updated;

  const prevTitle = typeof prevDoc.title === 'string' ? prevDoc.title.trim() : '';
  const nextTitle = typeof nextDoc.title === 'string' ? nextDoc.title.trim() : '';
  if (prevTitle !== nextTitle) {
    changes.add('title');
  }

  const prevDescription = typeof prevDoc.description === 'string' ? prevDoc.description.trim() : '';
  const nextDescription = typeof nextDoc.description === 'string' ? nextDoc.description.trim() : '';
  if (prevDescription !== nextDescription) {
    changes.add('description');
  }

  if ((prevDoc.proximityRadiusMeters ?? null) !== (nextDoc.proximityRadiusMeters ?? null)) {
    changes.add('radius');
  }

  const normalizedType = typeof nextDoc.type === 'string' ? nextDoc.type.toLowerCase() : '';

  if (normalizedType === 'event') {
    const prevStart = normalizeDateValue(prevDoc.startDate);
    const nextStart = normalizeDateValue(nextDoc.startDate);
    const prevEnd = normalizeDateValue(prevDoc.endDate);
    const nextEnd = normalizeDateValue(nextDoc.endDate);
    if (prevStart !== nextStart || prevEnd !== nextEnd) {
      changes.add('schedule');
    }
  } else if (normalizedType === 'discussion') {
    const prevExpires = normalizeDateValue(prevDoc.expiresAt);
    const nextExpires = normalizeDateValue(nextDoc.expiresAt);
    if (prevExpires !== nextExpires) {
      changes.add('expiration');
    }
  }

  const prevCover = typeof prevDoc.coverPhoto?.url === 'string' ? prevDoc.coverPhoto.url : null;
  const nextCover = typeof nextDoc.coverPhoto?.url === 'string' ? nextDoc.coverPhoto.url : null;
  if (prevCover !== nextCover) {
    changes.add('cover');
  }

  const prevPhotoCount = Array.isArray(prevDoc.photos) ? prevDoc.photos.length : 0;
  const nextPhotoCount = Array.isArray(nextDoc.photos) ? nextDoc.photos.length : 0;
  if (prevPhotoCount !== nextPhotoCount) {
    changes.add('photos');
  }

  const prevLocation = JSON.stringify(prevDoc.address ?? prevDoc.approximateAddress ?? null);
  const nextLocation = JSON.stringify(nextDoc.address ?? nextDoc.approximateAddress ?? null);
  if (prevLocation !== nextLocation) {
    changes.add('location');
  }

  return Array.from(changes);
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

const filterRecipientsByPreference = async (recipientIds, options = {}) => {
  const { requireUpdates = true, requireChatTransitions = false } = options;
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
      .filter((user) => {
        const preferences = user?.preferences?.notifications || {};
        if (requireUpdates && preferences.updates === false) {
          return false;
        }
        if (requireChatTransitions && preferences.chatTransitions === false) {
          return false;
        }
        return true;
      })
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
    logIntegration(`updateFanout:insert:${context}`, error);
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
    logIntegration('updateFanout:pin-created', error);
  }
};

const broadcastPinUpdated = async ({ previous, updated, editor }) => {
  try {
    if (!updated) {
      return;
    }

    const pinDoc = updated.toObject ? updated.toObject({ depopulate: false }) : updated;
    const pinId = toIdString(pinDoc._id);
    const pinObjectId = toObjectId(pinDoc._id);
    if (!pinId || !pinObjectId) {
      return;
    }

    const changes = summarizePinChanges(previous, pinDoc);
    if (!changes.length) {
      return;
    }

    const editorDoc = editor?.toObject ? editor.toObject() : editor;
    const editorId = toIdString(editorDoc?._id);
    const editorObjectId = toObjectId(editorDoc?._id);
    const editorName = getDisplayName(editorDoc);

    const bookmarks = await Bookmark.find({ pinId: pinObjectId }, { userId: 1 }).lean();
    if (!bookmarks.length) {
      return;
    }

    const candidateRecipients = new Set(
      bookmarks
        .map((bookmark) => toIdString(bookmark.userId))
        .filter(Boolean)
    );

    if (editorId) {
      candidateRecipients.delete(editorId);
    }

    if (!candidateRecipients.size) {
      return;
    }

    const filteredRecipients = await filterRecipientsByPreference(Array.from(candidateRecipients));
    if (!filteredRecipients.length) {
      return;
    }

    const changeLabels = {
      title: 'title',
      description: 'description',
      schedule: 'schedule',
      expiration: 'expiration',
      radius: 'radius',
      cover: 'cover image',
      photos: 'photos',
      location: 'location'
    };

    const labelList = changes.map((key) => changeLabels[key] || key);
    const changeSummary = `Updated ${labelList.join(', ')}`;

    const preview = buildPinPreview(updated);
    const pinTitle = pinDoc.title || 'a pin';

    const updates = filteredRecipients.map((recipientId) => ({
      userId: toObjectId(recipientId),
      sourceUserId: editorObjectId ?? undefined,
      payload: {
        type: 'pin-update',
        title: `${editorName} updated "${pinTitle}"`,
        body: changeSummary,
        metadata: {
          updateKind: 'pin-edit',
          changedFields: changes
        },
        pin: preview,
        relatedEntities: [
          createRelatedEntity(pinDoc._id, 'pin', pinTitle),
          editorId ? createRelatedEntity(editorId, 'user', editorName) : null
        ].filter(Boolean)
      }
    }));

    await insertUpdates(updates, 'pin-updated');
  } catch (error) {
    console.error('Failed to fan out pin updated notification', error);
    logIntegration('updateFanout:pin-updated', error);
  }
};

const broadcastEventStartingSoon = async ({ pin }) => {
  try {
    if (!pin) {
      return;
    }

    const pinDoc = pin.toObject ? pin.toObject({ depopulate: false }) : pin;
    const pinObjectId = toObjectId(pinDoc._id);
    const pinId = toIdString(pinDoc._id);
    if (!pinObjectId || !pinId) {
      return;
    }

    const normalizedType = typeof pinDoc.type === 'string' ? pinDoc.type.toLowerCase() : '';
    if (normalizedType !== 'event') {
      return;
    }

    const attendeeIds = Array.isArray(pinDoc.attendingUserIds)
      ? pinDoc.attendingUserIds.map((id) => toIdString(id)).filter(Boolean)
      : [];

    const bookmarkDocs = await Bookmark.find({ pinId: pinObjectId }, { userId: 1 }).lean();
    const bookmarkIds = bookmarkDocs.map((doc) => toIdString(doc.userId)).filter(Boolean);

    const recipientIds = new Set([...attendeeIds, ...bookmarkIds]);
    if (!recipientIds.size) {
      return;
    }

    const recipientIdList = Array.from(recipientIds);
    const recipientObjectIds = recipientIdList.map((id) => toObjectId(id)).filter(Boolean);
    if (!recipientObjectIds.length) {
      return;
    }

    const existing = await Update.find(
      {
        userId: { $in: recipientObjectIds },
        'payload.type': 'event-starting-soon',
        'payload.pin._id': pinObjectId
      },
      { userId: 1 }
    ).lean();

    const alreadyNotified = new Set(existing.map((entry) => toIdString(entry.userId)).filter(Boolean));
    const pendingRecipients = recipientIdList.filter((id) => !alreadyNotified.has(id));
    if (!pendingRecipients.length) {
      return;
    }

    const filteredRecipients = await filterRecipientsByPreference(pendingRecipients);
    if (!filteredRecipients.length) {
      return;
    }

    const preview = buildPinPreview(pinDoc);
    const hostName = getDisplayName(pinDoc.creatorId);
    const startDateIso = pinDoc.startDate ? new Date(pinDoc.startDate).toISOString() : undefined;
    const title = pinDoc.title || 'Upcoming event';
    const sourceUserId = toObjectId(pinDoc.creatorId?._id ?? pinDoc.creatorId);

    const updates = filteredRecipients.map((recipientId) => ({
      userId: toObjectId(recipientId),
      sourceUserId: sourceUserId ?? undefined,
      payload: {
        type: 'event-starting-soon',
        title: `${title} starts in 2 hours`,
        body: hostName ? `${hostName} is getting ready.` : undefined,
        metadata: {
          updateKind: 'event-starting-soon',
          startDate: startDateIso
        },
        pin: preview,
        relatedEntities: [
          createRelatedEntity(pinDoc._id, 'pin', title),
          pinDoc.creatorId ? createRelatedEntity(pinDoc.creatorId._id ?? pinDoc.creatorId, 'user', hostName) : null
        ].filter(Boolean)
      }
    }));

    await insertUpdates(updates, 'event-starting-soon');
  } catch (error) {
    console.error('Failed to fan out event starting soon update', error);
    logIntegration('updateFanout:event-starting-soon', error);
  }
};

const broadcastDiscussionExpiringSoon = async ({ pin }) => {
  try {
    if (!pin) {
      return;
    }

    const pinDoc = pin.toObject ? pin.toObject({ depopulate: false }) : pin;
    const pinObjectId = toObjectId(pinDoc._id);
    const pinId = toIdString(pinDoc._id);
    if (!pinObjectId || !pinId) {
      return;
    }

    const normalizedType = typeof pinDoc.type === 'string' ? pinDoc.type.toLowerCase() : '';
    if (normalizedType !== 'discussion') {
      return;
    }

    const expiresAtTs = normalizeDateValue(pinDoc.expiresAt);
    if (!expiresAtTs) {
      return;
    }

    const replies = await Reply.find({ pinId: pinObjectId }, { authorId: 1 }).lean();
    if (!replies.length) {
      return;
    }

    const authorIds = replies.map((reply) => toIdString(reply.authorId)).filter(Boolean);
    if (!authorIds.length) {
      return;
    }

    const authorObjectIds = authorIds.map((id) => toObjectId(id)).filter(Boolean);
    if (!authorObjectIds.length) {
      return;
    }

    const existing = await Update.find(
      {
        userId: { $in: authorObjectIds },
        'payload.type': 'discussion-expiring-soon',
        'payload.pin._id': pinObjectId
      },
      { userId: 1 }
    ).lean();

    const alreadyNotified = new Set(existing.map((entry) => toIdString(entry.userId)).filter(Boolean));
    const pendingRecipients = authorIds.filter((id) => !alreadyNotified.has(id));
    if (!pendingRecipients.length) {
      return;
    }

    const filteredRecipients = await filterRecipientsByPreference(pendingRecipients);
    if (!filteredRecipients.length) {
      return;
    }

    const preview = buildPinPreview(pinDoc);
    const title = pinDoc.title || 'Discussion';
    const expiresAtIso = new Date(expiresAtTs).toISOString();
    const sourceUserId = toObjectId(pinDoc.creatorId?._id ?? pinDoc.creatorId);
    const hostName = getDisplayName(pinDoc.creatorId);

    const updates = filteredRecipients.map((recipientId) => ({
      userId: toObjectId(recipientId),
      sourceUserId: sourceUserId ?? undefined,
      payload: {
        type: 'discussion-expiring-soon',
        title: `${title} wraps up tomorrow`,
        body: 'Add your final thoughts before it closes.',
        metadata: {
          updateKind: 'discussion-expiring-soon',
          expiresAt: expiresAtIso
        },
        pin: preview,
        relatedEntities: [
          createRelatedEntity(pinDoc._id, 'pin', title),
          pinDoc.creatorId ? createRelatedEntity(pinDoc.creatorId._id ?? pinDoc.creatorId, 'user', hostName) : null
        ].filter(Boolean)
      }
    }));

    await insertUpdates(updates, 'discussion-expiring');
  } catch (error) {
    console.error('Failed to fan out discussion expiration update', error);
    logIntegration('updateFanout:discussion-expiration', error);
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
    logIntegration('updateFanout:pin-reply', error);
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
    logIntegration('updateFanout:attendance', error);
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
    logIntegration('updateFanout:bookmark', error);
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
    logIntegration('updateFanout:chat-message', error);
  }
};

const broadcastChatRoomTransition = async ({
  userId,
  fromRoom,
  toRoom,
  distanceMeters,
  coordinates
}) => {
  try {
    const recipientId = toIdString(userId);
    if (!recipientId) {
      return;
    }

    const fromRoomId = toIdString(fromRoom?._id);
    const toRoomId = toIdString(toRoom?._id);

    if (!fromRoomId && !toRoomId) {
      return;
    }

    const recipients = await filterRecipientsByPreference([recipientId], {
      requireChatTransitions: true
    });
    if (!recipients.length) {
      return;
    }

    const fromLabel = fromRoom?.name || 'Previous chat room';
    const toLabel = toRoom?.name || 'Chat room';

    let title;
    if (fromRoomId && toRoomId && fromRoomId !== toRoomId) {
      title = `You moved from ${fromLabel} to ${toLabel}`;
    } else if (toRoomId && (!fromRoomId || fromRoomId === toRoomId)) {
      title = `You entered ${toLabel}`;
    } else if (fromRoomId && !toRoomId) {
      title = `You left ${fromLabel}`;
    } else {
      return;
    }

    const metadata = {
      fromRoomId,
      toRoomId,
      distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : undefined
    };

    if (coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude)) {
      metadata.latitude = coordinates.latitude;
      metadata.longitude = coordinates.longitude;
    }

    const relatedEntities = [
      fromRoomId ? createRelatedEntity(fromRoomId, 'chat-room', fromLabel) : null,
      toRoomId ? createRelatedEntity(toRoomId, 'chat-room', toLabel) : null
    ].filter(Boolean);

    const updates = recipients.map((id) => ({
      userId: toObjectId(id),
      sourceUserId: toObjectId(userId),
      payload: {
        type: 'chat-room-transition',
        title,
        body: undefined,
        metadata,
        relatedEntities
      }
    }));

    await insertUpdates(updates, 'chat-room-transition');
  } catch (error) {
    console.error('Failed to fan out chat room transition update', error);
    logIntegration('updateFanout:chat-transition', error);
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
    logIntegration('updateFanout:badge-earned', error);
  }
};

module.exports = {
  broadcastPinCreated,
  broadcastPinUpdated,
  broadcastEventStartingSoon,
  broadcastDiscussionExpiringSoon,
  broadcastPinReply,
  broadcastAttendanceChange,
  broadcastBookmarkCreated,
  broadcastChatMessage,
  broadcastChatRoomTransition,
  broadcastBadgeEarned
};
