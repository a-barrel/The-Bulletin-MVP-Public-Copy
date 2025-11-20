import toIdString from './ids';

const HOURS_24_MS = 24 * 60 * 60 * 1000;
const POPULAR_BOOKMARK_THRESHOLD = 10;
const POPULAR_REPLY_THRESHOLD = 15;
const OPEN_SPOT_RATIO = 0.25;

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function buildPinMeta(pin, { viewerId, friendIds } = {}) {
  const normalizedType = typeof pin?.type === 'string' ? pin.type.toLowerCase() : '';
  const isEvent = normalizedType === 'event';
  const isDiscussion = normalizedType === 'discussion';
  const participantLimit =
    typeof pin?.participantLimit === 'number' ? pin.participantLimit : undefined;
  const participantCount =
    typeof pin?.participantCount === 'number' ? pin.participantCount : undefined;
  const seatsRemaining =
    Number.isFinite(participantLimit) && Number.isFinite(participantCount)
      ? Math.max(participantLimit - participantCount, 0)
      : undefined;
  const hasCapacity =
    Number.isFinite(participantLimit) && Number.isFinite(participantCount)
      ? participantLimit > 0 && participantCount >= 0
      : false;
  const isFull =
    typeof pin?.isFull === 'boolean'
      ? pin.isFull
      : hasCapacity && participantCount >= participantLimit;
  const hasOpenSpots =
    typeof pin?.hasOpenSpots === 'boolean'
      ? pin.hasOpenSpots
      : hasCapacity && participantCount / participantLimit <= OPEN_SPOT_RATIO;

  const normalizedCreatorId =
    toIdString(pin?.creatorId) ??
    toIdString(pin?.creator?._id) ??
    toIdString(pin?.creator?._id?.$oid) ??
    null;

  const friendSet = friendIds instanceof Set ? friendIds : new Set(friendIds || []);

  const isFriendCreator =
    typeof pin?.isFriendCreator === 'boolean'
      ? pin.isFriendCreator
      : Boolean(normalizedCreatorId && friendSet.has(normalizedCreatorId));

  const startDate = normalizeDate(pin?.startDate);
  const expiresDate = normalizeDate(pin?.expiresAt || pin?.endDate);
  const now = Date.now();

  const startsSoon =
    typeof pin?.startsSoon === 'boolean'
      ? pin.startsSoon
      : Boolean(
          isEvent &&
            startDate &&
            startDate.getTime() >= now &&
            startDate.getTime() - now <= HOURS_24_MS
        );

  const discussionExpiresSoon =
    typeof pin?.discussionExpiresSoon === 'boolean'
      ? pin.discussionExpiresSoon
      : Boolean(
          isDiscussion &&
            expiresDate &&
            expiresDate.getTime() >= now &&
            expiresDate.getTime() - now <= HOURS_24_MS
        );

  const bookmarkCount =
    typeof pin?.stats?.bookmarkCount === 'number' ? pin.stats.bookmarkCount : 0;
  const replyCount =
    typeof pin?.stats?.replyCount === 'number'
      ? pin.stats.replyCount
      : typeof pin?.replyCount === 'number'
      ? pin.replyCount
      : 0;

  const isPopular =
    typeof pin?.isPopular === 'boolean'
      ? pin.isPopular
      : bookmarkCount >= POPULAR_BOOKMARK_THRESHOLD ||
        replyCount >= POPULAR_REPLY_THRESHOLD;

  const isFeatured =
    typeof pin?.isFeatured === 'boolean' ? pin.isFeatured : Boolean(pin?.options?.featured);

  const baseColor = (() => {
    if (isFull) {
      return 'full';
    }
    if (isFriendCreator) {
      return 'friend';
    }
    if (discussionExpiresSoon) {
      return 'discussionSoon';
    }
    if (startsSoon && isEvent) {
      return 'eventSoon';
    }
    if (isPopular) {
      return 'popular';
    }
    if (hasOpenSpots) {
      return 'open';
    }
    if (isFeatured) {
      return 'featured';
    }
    return isDiscussion ? 'discussion' : 'event';
  })();

  const isPersonal = Boolean(pin?.isSelf || pin?.viewerOwnsPin || pin?.viewerIsCreator);

  const colorKey = isPersonal ? 'personal' : baseColor;

  return {
    type: normalizedType,
    isEvent,
    isDiscussion,
    isFriend: isFriendCreator,
    isFull,
    hasOpenSpots,
    isPopular,
    startsSoon,
    discussionExpiresSoon,
    isFeatured,
    isPersonal,
    seatsRemaining,
    participantLimit,
    participantCount,
    viewerId,
    creatorId: normalizedCreatorId,
    colorKey
  };
}
