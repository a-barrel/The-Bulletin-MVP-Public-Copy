import { applyPinFilters } from '../../src/utils/pinFilters';

const baseMeta = {
  isEvent: false,
  isDiscussion: true,
  isPersonal: false,
  isFriend: false,
  isFull: false,
  discussionExpiresSoon: false,
  startsSoon: false,
  isPopular: false,
  isBookmarked: false,
  hasOpenSpots: false,
  isFeatured: false
};

const baseControls = {
  showEvents: true,
  showDiscussions: true,
  showPersonalPins: true,
  showFriendPins: true,
  showFullEvents: true,
  showExpiringDiscussions: true,
  showEventsStartingSoon: true,
  showPopularPins: true,
  showBookmarkedPins: true,
  showOpenSpotPins: true,
  showFeaturedPins: true
};

describe('applyPinFilters', () => {
  it('shows bookmarked pins even when discussion filter is off', () => {
    const meta = { ...baseMeta, isBookmarked: true };
    const controls = { ...baseControls, showDiscussions: false, showBookmarkedPins: true };
    expect(applyPinFilters(meta, controls)).toBe(true);
  });

  it('hides bookmarked pins when bookmarked toggle is off', () => {
    const meta = { ...baseMeta, isBookmarked: true };
    const controls = { ...baseControls, showBookmarkedPins: false };
    expect(applyPinFilters(meta, controls)).toBe(false);
  });

  it('still respects highlight toggles for bookmarked pins', () => {
    const meta = { ...baseMeta, isBookmarked: true, isPopular: true };
    const controls = { ...baseControls, showPopularPins: false, showBookmarkedPins: true };
    expect(applyPinFilters(meta, controls)).toBe(false);
  });

  it('hides non-bookmarked discussions when discussions filter is off', () => {
    const meta = { ...baseMeta, isDiscussion: true };
    const controls = { ...baseControls, showDiscussions: false };
    expect(applyPinFilters(meta, controls)).toBe(false);
  });
});
