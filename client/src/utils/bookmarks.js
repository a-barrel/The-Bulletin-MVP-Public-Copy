/**
 * mapBookmarkToFeedItem: bookmark payloads include a nested pin preview, but PinCard expects the same
 * shape produced by mapPinToFeedItem (List). This adapter fills the gap so BookmarksPage can reuse the
 * exact card component without duplicating layout. Keep any bookmark-specific fallbacks here.
 */
import toIdString from './ids';
import resolveAssetUrl from './media';
import { mapPinToFeedItem } from './pinFeedItem';

const collectImages = (pin) => {
  const result = [];
  const pushAsset = (asset) => {
    const resolved = resolveAssetUrl(asset);
    if (resolved && !result.includes(resolved)) {
      result.push(resolved);
    }
  };

  if (pin?.coverPhoto) {
    pushAsset(pin.coverPhoto);
  }

  const collections = [pin?.photos, pin?.images, pin?.mediaAssets];
  collections.forEach((set) => {
    if (!Array.isArray(set)) {
      return;
    }
    set.forEach(pushAsset);
  });

  return result;
};

const buildFallbackBookmarkItem = (bookmark) => {
  const pin = bookmark.pin ?? {};
  const pinId = toIdString(bookmark.pinId) ?? toIdString(pin?._id) ?? null;
  const bookmarkId =
    toIdString(bookmark._id) ??
    toIdString(bookmark.id) ??
    pinId ??
    bookmark._id ??
    bookmark.id ??
    null;
  const rawType = typeof pin?.type === 'string' ? pin.type.toLowerCase() : 'event';
  const normalizedType = rawType === 'discussion' || rawType === 'chat' ? 'discussion' : 'pin';
  const creatorId =
    toIdString(pin?.creatorId) ??
    toIdString(pin?.creator?._id) ??
    toIdString(pin?.creator?._id?.$oid) ??
    null;
  const viewerId = toIdString(bookmark.userId);
  const viewerOwnsPin = Boolean(creatorId && viewerId && creatorId === viewerId);
  const title =
    typeof pin?.title === 'string' && pin.title.trim() ? pin.title.trim() : 'Untitled pin';
  const noteText =
    typeof bookmark?.notes === 'string' && bookmark.notes.trim()
      ? bookmark.notes.trim()
      : null;
  const text = noteText ?? title;
  const images = collectImages(pin);
  const comments =
    typeof pin?.stats?.replyCount === 'number' ? pin.stats.replyCount : undefined;
  const participantCount =
    typeof pin?.stats?.participantCount === 'number'
      ? pin.stats.participantCount
      : typeof pin?.participantCount === 'number'
      ? pin.participantCount
      : null;

  return {
    id: bookmarkId,
    _id: bookmarkId,
    pinId,
    type: normalizedType,
    title,
    text,
    creator: pin?.creator,
    creatorId,
    authorId: creatorId,
    comments,
    images,
    participantCount,
    attendeeIds: [],
    interested: [],
    distance: null,
    timeLabel: null,
    viewerHasBookmarked: true,
    isBookmarked: true,
    viewerOwnsPin,
    viewerIsAttending: Boolean(bookmark?.viewerIsAttending)
  };
};

export const mapBookmarkToFeedItem = (bookmark, { viewerProfileId } = {}) => {
  if (!bookmark) {
    return null;
  }
  const pin = bookmark.pin ?? null;
  const noteText =
    typeof bookmark?.notes === 'string' && bookmark.notes.trim()
      ? bookmark.notes.trim()
      : null;

  if (pin) {
    try {
      const mappedPin = mapPinToFeedItem(pin, { viewerProfileId });
      if (mappedPin) {
        const resolvedPinId =
          mappedPin.pinId ?? toIdString(bookmark.pinId) ?? mappedPin._id ?? null;
        const bookmarkId =
          toIdString(bookmark._id) ??
          toIdString(bookmark.id) ??
          mappedPin._id ??
          mappedPin.id ??
          resolvedPinId;
        return {
          ...mappedPin,
          id: bookmarkId,
          _id: bookmarkId,
          pinId: resolvedPinId,
          text: noteText ?? mappedPin.text,
          viewerHasBookmarked: true,
          isBookmarked: true,
          viewerIsAttending: Boolean(bookmark?.viewerIsAttending)
        };
      }
    } catch (error) {
      // Fallback handled below if mapPinToFeedItem throws
      console.warn('Failed to map bookmark pin to feed item:', error);
    }
  }

  return buildFallbackBookmarkItem(bookmark);
};
