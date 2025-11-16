import toIdString from './ids';
import { mapPinToFeedItem } from './pinFeedItem';

export const EMPTY_BOOKMARK_GROUP = 'Unsorted';

export function formatBookmarkSavedDate(value) {
  if (!value) {
    return 'Unknown date';
  }
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function groupBookmarksByCollection(bookmarks, collectionsById = new Map()) {
  const groups = new Map();
  bookmarks.forEach((bookmark) => {
    const collectionId = bookmark.collectionId || null;
    const collectionName = collectionsById.get(collectionId)?.name ?? EMPTY_BOOKMARK_GROUP;
    if (!groups.has(collectionName)) {
      groups.set(collectionName, []);
    }
    groups.get(collectionName).push(bookmark);
  });
  return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
}

const FALLBACK_AUTHOR = 'Unknown creator';
const FALLBACK_TITLE = 'Saved pin unavailable';

export function mapBookmarkToFeedItem(bookmark, { viewerProfileId } = {}) {
  if (!bookmark) {
    return null;
  }

  const savedAt = bookmark.createdAt || bookmark.savedAt || null;
  const bookmarkId = bookmark._id || bookmark.id || null;
  const pinId =
    toIdString(bookmark.pinId) ?? toIdString(bookmark?.pin?._id) ?? toIdString(bookmark.pin?._id?.$oid);

  if (bookmark.pin) {
    const feedItem = mapPinToFeedItem(bookmark.pin, { viewerProfileId }) || {};
    return {
      ...feedItem,
      viewerHasBookmarked: true,
      isBookmarked: true,
      bookmarkId,
      savedAt,
      savedAtLabel: formatBookmarkSavedDate(savedAt)
    };
  }

  const creatorName =
    bookmark.creator?.displayName ||
    bookmark.creator?.username ||
    bookmark.creatorName ||
    FALLBACK_AUTHOR;
  const creatorId =
    toIdString(bookmark.creatorId) ??
    toIdString(bookmark.creator?._id) ??
    toIdString(bookmark.creator?._id?.$oid) ??
    null;

  const title =
    typeof bookmark.title === 'string' && bookmark.title.trim().length > 0
      ? bookmark.title.trim()
      : FALLBACK_TITLE;
  const type =
    bookmark.pinType === 'discussion' || bookmark.type === 'discussion' ? 'discussion' : 'pin';

  return {
    id: pinId || bookmarkId,
    _id: pinId || bookmarkId,
    pinId: pinId || bookmarkId,
    type,
    tag: type === 'discussion' ? 'Discussion' : 'Event',
    distance: null,
    timeLabel: null,
    text: title,
    title,
    images: [],
    author: creatorName,
    authorName: creatorName,
    creatorId,
    creator: bookmark.creator || null,
    comments: 0,
    interested: [],
    participantCount: null,
    attendeeIds: [],
    attendeeVersion: null,
    viewerHasBookmarked: true,
    isBookmarked: true,
    viewerOwnsPin: false,
    viewerIsAttending: false,
    bookmarkId,
    savedAt,
    savedAtLabel: formatBookmarkSavedDate(savedAt)
  };
}
