import toIdString from "./ids";
import resolveAssetUrl from "./media";

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

export const mapBookmarkToFeedItem = (bookmark) => {
  if (!bookmark) {
    return null;
  }
  const pin = bookmark.pin ?? {};
  const pinId = toIdString(bookmark.pinId) ?? toIdString(pin?._id) ?? null;
  const bookmarkId =
    toIdString(bookmark._id) ??
    toIdString(bookmark.id) ??
    pinId ??
    bookmark._id ??
    bookmark.id ??
    null;
  const rawType = typeof pin?.type === "string" ? pin.type.toLowerCase() : "event";
  const normalizedType = rawType === "discussion" || rawType === "chat" ? "discussion" : "pin";
  const creatorId =
    toIdString(pin?.creatorId) ??
    toIdString(pin?.creator?._id) ??
    toIdString(pin?.creator?._id?.$oid) ??
    null;
  const viewerId = toIdString(bookmark.userId);
  const viewerOwnsPin = Boolean(creatorId && viewerId && creatorId === viewerId);
  const title =
    typeof pin?.title === "string" && pin.title.trim()
      ? pin.title.trim()
      : "Untitled pin";
  const noteText =
    typeof bookmark?.notes === "string" && bookmark.notes.trim()
      ? bookmark.notes.trim()
      : null;
  const text = noteText ?? title;
  const images = collectImages(pin);
  const comments =
    typeof pin?.stats?.replyCount === "number"
      ? pin.stats.replyCount
      : undefined;
  const participantCount =
    typeof pin?.stats?.participantCount === "number"
      ? pin.stats.participantCount
      : typeof pin?.participantCount === "number"
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
