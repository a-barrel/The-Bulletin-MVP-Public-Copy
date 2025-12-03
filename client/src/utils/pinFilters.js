export const PIN_TYPE_FILTER_KEYS = ['event', 'discussion', 'personal'];

export function applyPinFilters(meta, controls) {
  if (!meta || !controls) {
    return true;
  }

  const {
    showEvents = true,
    showDiscussions = true,
    showPersonalPins = true,
    showFriendPins = true,
    showFullEvents = true,
    showExpiringDiscussions = true,
    showEventsStartingSoon = true,
    showPopularPins = true,
    showBookmarkedPins = true,
    showOpenSpotPins = true,
    showFeaturedPins = true
  } = controls;

  const isPersonal = meta.isPersonal || meta.isSelf;

  // If bookmarked is off, still allow personal pins to show.
  if (meta.isBookmarked && !showBookmarkedPins && !isPersonal) {
    return false;
  }

  if (meta.isBookmarked && showBookmarkedPins) {
    if (meta.isFriend && !showFriendPins) return false;
    if (meta.isFull && !showFullEvents && !(meta.isFriend && showFriendPins)) return false;
    if (meta.discussionExpiresSoon && !showExpiringDiscussions) return false;
    if (meta.startsSoon && !showEventsStartingSoon) return false;
    if (meta.isPopular && !showPopularPins) return false;
    if (meta.hasOpenSpots && !showOpenSpotPins) return false;
    if (meta.isFeatured && !showFeaturedPins) return false;
    return true;
  }

  if (meta.isEvent && !showEvents) return false;
  if (meta.isDiscussion && !showDiscussions) return false;
  if (isPersonal && !showPersonalPins) return false;
  if (meta.isFriend && !showFriendPins) return false;
  if (meta.isFull && !showFullEvents && !(meta.isFriend && showFriendPins)) return false;
  if (meta.discussionExpiresSoon && !showExpiringDiscussions) return false;
  if (meta.startsSoon && !showEventsStartingSoon) return false;
  if (meta.isPopular && !showPopularPins) return false;
  if (meta.hasOpenSpots && !showOpenSpotPins) return false;
  if (meta.isFeatured && !showFeaturedPins) return false;

  return true;
}
