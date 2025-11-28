import { useMemo, useState } from 'react';
import toIdString from '../../utils/ids';

export const FILTER_STORAGE_KEY = 'mapFilterState-v2';
export const LEGACY_FILTER_STORAGE_KEY = 'mapFilterState-v1';

const loadStoredFilterState = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const readKey = (storageKey) => {
    if (!storageKey) {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (error) {
      console.warn(`Failed to parse saved map filters for ${storageKey}:`, error);
    }
    return null;
  };

  const current = readKey(FILTER_STORAGE_KEY);
  if (current) {
    return current;
  }
  const legacy = readKey(LEGACY_FILTER_STORAGE_KEY);
  if (legacy) {
    const { showInteractionRadius: _legacyRadius, ...rest } = legacy;
    return rest;
  }
  return null;
};

export const extractIds = (list) => {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => toIdString(entry?._id ?? entry?.id ?? entry?.userId ?? entry))
    .filter(Boolean);
};

export const useMapFilters = () => {
  const initialFilterState = loadStoredFilterState();
  const [showEvents, setShowEvents] = useState(initialFilterState?.showEvents ?? true);
  const [showDiscussions, setShowDiscussions] = useState(initialFilterState?.showDiscussions ?? true);
  const [showPersonalPins, setShowPersonalPins] = useState(initialFilterState?.showPersonalPins ?? true);
  const [showFriendPins, setShowFriendPins] = useState(initialFilterState?.showFriendPins ?? true);
  const [showExpiringDiscussions, setShowExpiringDiscussions] = useState(
    initialFilterState?.showExpiringDiscussions ?? true
  );
  const [showEventsStartingSoon, setShowEventsStartingSoon] = useState(
    initialFilterState?.showEventsStartingSoon ?? true
  );
  const [showPopularPins, setShowPopularPins] = useState(initialFilterState?.showPopularPins ?? true);
  const [showBookmarkedPins, setShowBookmarkedPins] = useState(initialFilterState?.showBookmarkedPins ?? true);
  const [showOpenSpotPins, setShowOpenSpotPins] = useState(initialFilterState?.showOpenSpotPins ?? true);
  const [showFeaturedPins, setShowFeaturedPins] = useState(initialFilterState?.showFeaturedPins ?? true);
  const [showMyChatRooms, setShowMyChatRooms] = useState(initialFilterState?.showMyChatRooms ?? false);
  const [showAllChatRoomsToggle, setShowAllChatRoomsToggle] = useState(
    initialFilterState?.showAllChatRoomsToggle ?? false
  );
  const [tapToTeleportEnabled, setTapToTeleportEnabled] = useState(
    initialFilterState?.tapToTeleportEnabled ?? false
  );
  const [showInteractionRadius, setShowInteractionRadius] = useState(
    initialFilterState?.showInteractionRadius ?? false
  );
  const [clusterPins, setClusterPins] = useState(initialFilterState?.clusterPins ?? true);
  const [filtersCollapsed, setFiltersCollapsed] = useState(initialFilterState?.filtersCollapsed ?? false);

  const filterState = useMemo(
    () => ({
      showEvents,
      setShowEvents,
      showDiscussions,
      setShowDiscussions,
      showPersonalPins,
      setShowPersonalPins,
      showFriendPins,
      setShowFriendPins,
      showExpiringDiscussions,
      setShowExpiringDiscussions,
      showEventsStartingSoon,
      setShowEventsStartingSoon,
      showPopularPins,
      setShowPopularPins,
      showBookmarkedPins,
      setShowBookmarkedPins,
      showOpenSpotPins,
      setShowOpenSpotPins,
      showFeaturedPins,
      setShowFeaturedPins,
      showMyChatRooms,
      setShowMyChatRooms,
      showAllChatRoomsToggle,
      setShowAllChatRoomsToggle,
      tapToTeleportEnabled,
      setTapToTeleportEnabled,
      showInteractionRadius,
      setShowInteractionRadius,
      clusterPins,
      setClusterPins,
      filtersCollapsed,
      setFiltersCollapsed
    }),
    [
      showEvents,
      showDiscussions,
      showPersonalPins,
      showFriendPins,
      showExpiringDiscussions,
      showEventsStartingSoon,
      showPopularPins,
      showBookmarkedPins,
      showOpenSpotPins,
      showFeaturedPins,
      showMyChatRooms,
      showAllChatRoomsToggle,
      tapToTeleportEnabled,
      showInteractionRadius,
      clusterPins,
      filtersCollapsed
    ]
  );

  return filterState;
};
