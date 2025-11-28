import { useCallback, useEffect, useMemo, useState } from 'react';
import '../pages/MapPage.css';
import { useNavigate } from 'react-router-dom';
import MapIcon from '@mui/icons-material/Map';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import MapComponent from '../components/Map';
import Navbar from '../components/Navbar';
import updatesIcon from '../assets/UpdateIcon.svg';
import addIconPurple from '../assets/AddIconPurple.svg';
import { routes } from '../routes';
import { useLocationContext } from '../contexts/LocationContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import { useUpdates } from '../contexts/UpdatesContext';
import useMapExplorer from '../hooks/useMapExplorer';
import useViewerProfile from '../hooks/useViewerProfile';
import useHideFullEventsPreference from '../hooks/useHideFullEventsPreference';
import { DEFAULT_MAX_DISTANCE_METERS } from '../utils/mapExplorerConstants';
import MapHeader from '../components/map/MapHeader';
import MapFilterPanel from '../components/map/MapFilterPanel';
import { MAP_FILTERS, MAP_MARKER_ICON_URLS } from '../utils/mapMarkers';
import { applyPinFilters } from '../utils/pinFilters';
import useOfflineAction from '../hooks/useOfflineAction';
import toIdString from '../utils/ids';
import { buildPinMeta } from '../utils/mapPinMeta';
import { viewerHasDeveloperAccess } from '../utils/roles';
import runtimeConfig from '../config/runtime';
import { useTranslation } from 'react-i18next';


export const pageConfig = {
  id: 'map',
  label: 'Map',
  icon: MapIcon,
  path: '/map',
  order: 1,
  protected: true,
  showInNav: true
};

function MapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { unreadCount, refreshUnreadCount } = useUpdates();
  const { location: sharedLocation, setLocation: setSharedLocation } = useLocationContext();
  const offlineAction = useOfflineAction(isOffline);
  const { viewer: preferenceProfile } = useViewerProfile({ enabled: !isOffline, skip: isOffline });
  const adminOverride = useMemo(
    () =>
      viewerHasDeveloperAccess(preferenceProfile, {
        offlineOverride: runtimeConfig.isOffline || isOffline
      }),
    [isOffline, preferenceProfile]
  );
  const {
    hideFullEvents,
    setHideFullEvents,
    isSavingPreference: isSavingHideFullPreference,
    preferenceError: hideFullPreferenceError,
    clearPreferenceError
  } = useHideFullEventsPreference({
    profileValue: preferenceProfile?.preferences?.display?.hideFullEventsByDefault,
    disablePersistence: isOffline
  });

  const {
    userLocation,
    nearbyUsers,
    pins,
    chatRoomPins,
    showChatRooms,
    setShowChatRooms,
    handleMapPinSelect,
    selectedChatRoomId,
    viewerProfile,
    teleportToLocation,
    setAdminChatView,
    locationRequired,
    hasResolvedLocation,
    shareHelperText,
    handleStartSharing,
    error,
    setError,
    isSharing
  } = useMapExplorer({
    sharedLocation,
    setSharedLocation,
    isOffline,
    hideFullEvents,
    enforceLocation: !adminOverride,
    isAdminExempt: adminOverride
  });

  const FILTER_STORAGE_KEY = 'mapFilterState-v2';
const LEGACY_FILTER_STORAGE_KEY = 'mapFilterState-v1';

const extractIds = (list) => {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => toIdString(entry?._id ?? entry?.id ?? entry?.userId ?? entry))
    .filter(Boolean);
};

const perfLogCache = new globalThis.Map();
const logPerf = (label, startedAt = null, meta = {}) => {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const duration = startedAt ? now - startedAt : 0;
  const key = `${label}|${JSON.stringify(meta)}`;
  const last = perfLogCache.get(key);
  // Deduplicate identical log payloads that occur back-to-back (e.g., Strict Mode double effects).
  if (last && now - last < 200) {
    return;
  }
  perfLogCache.set(key, now);
  // eslint-disable-next-line no-console
  console.log(`[map-perf] ${label}${startedAt ? '' : ' (instant)'}`, {
    durationMs: Number.isFinite(duration) ? duration.toFixed(1) : 'n/a',
    ...meta
  });
};
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
  const initialFilterState = loadStoredFilterState();
  const [showEvents, setShowEvents] = useState(
    initialFilterState?.showEvents ?? true
  );
  const [showDiscussions, setShowDiscussions] = useState(
    initialFilterState?.showDiscussions ?? true
  );
  const [showPersonalPins, setShowPersonalPins] = useState(
    initialFilterState?.showPersonalPins ?? true
  );
  const [showFriendPins, setShowFriendPins] = useState(
    initialFilterState?.showFriendPins ?? true
  );
  const [showExpiringDiscussions, setShowExpiringDiscussions] = useState(
    initialFilterState?.showExpiringDiscussions ?? true
  );
  const [showEventsStartingSoon, setShowEventsStartingSoon] = useState(
    initialFilterState?.showEventsStartingSoon ?? true
  );
  const [showPopularPins, setShowPopularPins] = useState(
    initialFilterState?.showPopularPins ?? true
  );
  const [showBookmarkedPins, setShowBookmarkedPins] = useState(
    initialFilterState?.showBookmarkedPins ?? true
  );
  const [showOpenSpotPins, setShowOpenSpotPins] = useState(
    initialFilterState?.showOpenSpotPins ?? true
  );
  const [showFeaturedPins, setShowFeaturedPins] = useState(
    initialFilterState?.showFeaturedPins ?? true
  );
  const [showMyChatRooms, setShowMyChatRooms] = useState(
    initialFilterState?.showMyChatRooms ?? false
  );
  const [showAllChatRoomsToggle, setShowAllChatRoomsToggle] = useState(
    initialFilterState?.showAllChatRoomsToggle ?? false
  );
  const [tapToTeleportEnabled, setTapToTeleportEnabled] = useState(
    initialFilterState?.tapToTeleportEnabled ?? false
  );
  const [showInteractionRadius, setShowInteractionRadius] = useState(
    initialFilterState?.showInteractionRadius ?? false
  );
  const [clusterPins, setClusterPins] = useState(
    initialFilterState?.clusterPins ?? true
  );
  const [filtersCollapsed, setFiltersCollapsed] = useState(
    initialFilterState?.filtersCollapsed ?? false
  );
  const showFullEvents = !hideFullEvents;

  const viewerId = useMemo(
    () => toIdString(viewerProfile?._id) ?? toIdString(viewerProfile?.id) ?? null,
    [viewerProfile]
  );

  const friendIdsReady = Array.isArray(viewerProfile?.relationships?.friendIds);

  const friendIdsSet = useMemo(() => {
    const friends = viewerProfile?.relationships?.friendIds;
    if (!Array.isArray(friends)) {
      return new Set();
    }
    return new Set(
      friends
        .map((value) => toIdString(value))
        .filter(Boolean)
    );
  }, [viewerProfile]);

  const canUseAdminTools = useMemo(
    () =>
      viewerHasDeveloperAccess(viewerProfile, {
        offlineOverride: runtimeConfig.isOffline || isOffline
      }) || adminOverride,
    [adminOverride, isOffline, viewerProfile]
  );

  useEffect(() => {
    if (!canUseAdminTools) {
      setShowAllChatRoomsToggle(false);
      setTapToTeleportEnabled(false);
    }
  }, [canUseAdminTools]);

  useEffect(() => {
    const enableChatRooms = showAllChatRoomsToggle || showMyChatRooms;
    if (typeof setShowChatRooms === 'function') {
      setShowChatRooms(enableChatRooms);
    }
    if (typeof setAdminChatView === 'function') {
      setAdminChatView(showAllChatRoomsToggle && canUseAdminTools);
    }
  }, [canUseAdminTools, setAdminChatView, setShowChatRooms, showAllChatRoomsToggle, showMyChatRooms]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const snapshot = {
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
    };
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(snapshot));
      window.localStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to persist map filters:', error);
    }
  }, [
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
  ]);

  const annotatedPins = useMemo(() => {
    const started = performance.now();
    if (!Array.isArray(pins)) {
      return [];
    }
    const result = pins.map((pin) => {
      const mapMeta = buildPinMeta(pin, { viewerId, friendIds: friendIdsSet });
      const existingFriendCount =
        typeof pin?.friendsGoing === 'number'
          ? pin.friendsGoing
          : typeof pin?.friendsGoingCount === 'number'
          ? pin.friendsGoingCount
          : typeof pin?.friendCount === 'number'
          ? pin.friendCount
          : typeof pin?.stats?.friendsGoing === 'number'
          ? pin.stats.friendsGoing
          : typeof pin?.stats?.friendsGoingCount === 'number'
          ? pin.stats.friendsGoingCount
          : typeof pin?.stats?.friendCount === 'number'
          ? pin.stats.friendCount
          : null;
      const participantIds = [
        ...extractIds(pin?.participants),
        ...extractIds(pin?.participantIds),
        ...extractIds(pin?.attendees),
        ...extractIds(pin?.attendeeIds),
        ...extractIds(pin?.attendingUserIds),
        ...extractIds(pin?.stats?.attendees),
        ...extractIds(pin?.stats?.attendeeIds),
        ...extractIds(pin?.stats?.attendingUserIds),
        ...extractIds(pin?.stats?.participants),
        ...extractIds(pin?.stats?.participantIds)
      ];
      const participantIdSet = participantIds.length ? new Set(participantIds) : null;
      const friendsFromGraph =
        friendIdsReady && participantIdSet
          ? Array.from(participantIdSet).reduce(
              (count, id) => (friendIdsSet.has(id) ? count + 1 : count),
              0
            )
          : null;
      const friendsGoingCount =
        existingFriendCount !== null
          ? existingFriendCount
          : friendsFromGraph !== null
          ? friendsFromGraph
          : null;
      const friendsGoingPending = friendsGoingCount === null;
      return {
        ...pin,
        friendsGoing: friendsGoingCount,
        friendsGoingCount,
        friendsGoingPending,
        stats: {
          ...(pin?.stats || {}),
          friendsGoing: friendsGoingCount,
          friendsGoingCount
        },
        mapMeta,
        mapColorKey: mapMeta.colorKey
      };
    });
    logPerf('annotate pins', started, { count: result.length });
    return result;
  }, [pins, friendIdsSet, viewerId]);

  const visiblePins = useMemo(() => {
    const started = performance.now();
    const filtered = annotatedPins.filter((pin) =>
      applyPinFilters(pin.mapMeta, {
        showEvents,
        showDiscussions,
        showPersonalPins,
        showFriendPins,
        showFullEvents,
        showExpiringDiscussions,
        showEventsStartingSoon,
        showPopularPins,
        showBookmarkedPins,
        showOpenSpotPins,
        showFeaturedPins
      })
    );
    logPerf('filter pins', started, { input: annotatedPins.length, output: filtered.length });
    return filtered;
  }, [
    annotatedPins,
    showDiscussions,
    showEvents,
    showPersonalPins,
    showFriendPins,
    showFullEvents,
    showExpiringDiscussions,
    showEventsStartingSoon,
    showPopularPins,
    showBookmarkedPins,
    showOpenSpotPins,
    showFeaturedPins
  ]);

  const visibleChatRoomPins = useMemo(() => {
    if (!showAllChatRoomsToggle && !showMyChatRooms) {
      return [];
    }
    const baseRooms = Array.isArray(chatRoomPins) ? chatRoomPins : [];
    if (showAllChatRoomsToggle) {
      return baseRooms.map((pin) => ({ ...pin, chatRoomCategory: 'all' }));
    }
    if (showMyChatRooms) {
      const isViewerRoom = (pin) => {
        const metadata = pin?.metadata || {};
        const ownerId = toIdString(metadata.ownerId);
        if (viewerId && ownerId && ownerId === viewerId) {
          return true;
        }
        const participantIds = Array.isArray(metadata.participantIds)
          ? metadata.participantIds
          : [];
        if (
          viewerId &&
          participantIds
            .map((value) => toIdString(value))
            .filter(Boolean)
            .includes(viewerId)
        ) {
          return true;
        }
        const radius = Number.isFinite(pin?.proximityRadiusMeters) ? pin.proximityRadiusMeters : null;
        const distance = Number.isFinite(pin?.distanceMeters) ? pin.distanceMeters : null;
        if (radius !== null && distance !== null) {
          return distance <= radius;
        }
        return false;
      };
      return baseRooms.filter(isViewerRoom).map((pin) => ({ ...pin, chatRoomCategory: 'mine' }));
    }
    return [];
  }, [chatRoomPins, showAllChatRoomsToggle, showMyChatRooms, viewerId]);

  const mapPinsForRender = useMemo(() => {
    const started = performance.now();
    const merged = [...visiblePins, ...visibleChatRoomPins];
    logPerf('merge pins for map', started, { pins: visiblePins.length, chats: visibleChatRoomPins.length, total: merged.length });
    return merged;
  }, [visiblePins, visibleChatRoomPins]);

  useEffect(() => {
    logPerf('map pin counts change', null, {
      visiblePins: visiblePins.length,
      chatPins: visibleChatRoomPins.length,
      total: mapPinsForRender.length
    });
  }, [visiblePins.length, visibleChatRoomPins.length, mapPinsForRender.length]);

  useEffect(() => {
    if (typeof refreshUnreadCount === 'function' && !isOffline) {
      refreshUnreadCount({ silent: true });
    }
  }, [isOffline, refreshUnreadCount]);

  const handleViewPinDetails = useCallback(
    (pin) => {
      if (!pin) {
        return;
      }
      const pinId = pin._id ?? pin.id ?? null;
      if (!pinId) {
        return;
      }
      navigate(routes.pin.byId(pinId), { state: { pin } });
    },
    [navigate]
  );

  const handleViewChatRoom = useCallback(() => {
    navigate(routes.chat.base, {
      state: selectedChatRoomId ? { pinId: selectedChatRoomId } : undefined
    });
  }, [navigate, selectedChatRoomId]);

  const handleToggleEvents = useCallback((event) => {
    setShowEvents(Boolean(event?.target?.checked));
  }, []);

  const handleToggleDiscussions = useCallback((event) => {
    setShowDiscussions(Boolean(event?.target?.checked));
  }, []);

  const handleTogglePersonalPins = useCallback((event) => {
    setShowPersonalPins(Boolean(event?.target?.checked));
  }, []);
  const handleToggleFullEventsFilter = useCallback(() => {
    if (hideFullPreferenceError) {
      clearPreferenceError();
    }
    setHideFullEvents(!hideFullEvents);
  }, [clearPreferenceError, hideFullPreferenceError, hideFullEvents, setHideFullEvents]);

  const handleViewProfile = useCallback(() => {
    navigate(routes.profile.me);
  }, [navigate]);

  const handleViewPinAuthor = useCallback(
    (pin) => {
      const authorId =
        toIdString(pin?.creator?._id) ||
        toIdString(pin?.creator?.id) ||
        toIdString(pin?.creatorId) ||
        toIdString(pin?.authorId);
      if (!authorId) return;
      navigate(routes.profile.byId(authorId));
    },
    [navigate]
  );

  const handleNotifications = useCallback(() => {
    offlineAction(() => navigate(routes.updates.base));
  }, [offlineAction, navigate]);

  const handleCreatePin = useCallback(() => {
    offlineAction(() => navigate(routes.createPin.base));
  }, [offlineAction, navigate]);

  const handleTapTeleport = useCallback(
    (latlng) => {
      if (!tapToTeleportEnabled || !canUseAdminTools) {
        return;
      }
      if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) {
        return;
      }
      teleportToLocation?.({
        latitude: latlng.lat,
        longitude: latlng.lng,
        accuracy: 25
      });
    },
    [canUseAdminTools, tapToTeleportEnabled, teleportToLocation]
  );

  const notificationsLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';
  const displayBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;

  const baseFilterItems = useMemo(
    () =>
      MAP_FILTERS.map((filter) => {
        if (filter.key === 'event') {
          return { ...filter, checked: showEvents, onChange: handleToggleEvents };
        }
        if (filter.key === 'discussion') {
          return { ...filter, checked: showDiscussions, onChange: handleToggleDiscussions };
        }
        if (filter.key === 'personal') {
          return { ...filter, checked: showPersonalPins, onChange: handleTogglePersonalPins };
        }
        return filter;
      }),
    [handleToggleDiscussions, handleToggleEvents, handleTogglePersonalPins, showDiscussions, showEvents, showPersonalPins]
  );

  const highlightFilters = useMemo(
    () => [
      {
        key: 'full-events',
        label: 'Full events',
        iconUrl: MAP_MARKER_ICON_URLS.full,
        ariaLabel: showFullEvents ? 'Showing full events' : 'Hiding full events',
        checked: showFullEvents,
        onChange: handleToggleFullEventsFilter,
        disabled: isSavingHideFullPreference
      },
      {
        key: 'friend-pins',
        label: 'Friend pins',
        iconUrl: MAP_MARKER_ICON_URLS.friend,
        ariaLabel: 'Toggle friend pins',
        checked: showFriendPins,
        onChange: () => setShowFriendPins((prev) => !prev)
      },
      {
        key: 'expiring-discussions',
        label: 'Discussions expiring soon',
        iconUrl: MAP_MARKER_ICON_URLS.discussionSoon,
        ariaLabel: 'Toggle discussions expiring within 24 hours',
        checked: showExpiringDiscussions,
        onChange: () => setShowExpiringDiscussions((prev) => !prev)
      },
      {
        key: 'events-soon',
        label: 'Events starting soon',
        iconUrl: MAP_MARKER_ICON_URLS.eventSoon,
        ariaLabel: 'Toggle events starting soon',
        checked: showEventsStartingSoon,
        onChange: () => setShowEventsStartingSoon((prev) => !prev)
      },
      {
        key: 'popular-pins',
        label: 'Popular pins',
        iconUrl: MAP_MARKER_ICON_URLS.popular,
        iconClassName: 'popular-filter-icon',
        ariaLabel: 'Toggle popular pins',
        checked: showPopularPins,
        onChange: () => setShowPopularPins((prev) => !prev)
      },
      {
        key: 'bookmarked-pins',
        label: 'Bookmarked pins (always visible)',
        iconUrl: MAP_MARKER_ICON_URLS.bookmarked,
        ariaLabel: 'Toggle bookmarked pins (always visible even if types are off)',
        checked: showBookmarkedPins,
        onChange: () => setShowBookmarkedPins((prev) => !prev),
        helperText: 'When on, all bookmarks stay visible even if pin type filters are off.'
      },
      {
        key: 'open-spots',
        label: 'Open spots',
        iconUrl: MAP_MARKER_ICON_URLS.open,
        ariaLabel: 'Toggle pins with open spots',
        checked: showOpenSpotPins,
        onChange: () => setShowOpenSpotPins((prev) => !prev)
      },
      {
        key: 'featured-pins',
        label: 'Featured pins',
        iconUrl: MAP_MARKER_ICON_URLS.featured,
        ariaLabel: 'Toggle featured pins',
        checked: showFeaturedPins,
        onChange: () => setShowFeaturedPins((prev) => !prev)
      }
    ],
    [
      handleToggleFullEventsFilter,
      isSavingHideFullPreference,
      showEventsStartingSoon,
      showExpiringDiscussions,
      showFeaturedPins,
      showFriendPins,
      showFullEvents,
      showBookmarkedPins,
      showOpenSpotPins,
      showPopularPins
    ]
  );

  const chatFilterItems = useMemo(
    () => [
      {
        key: 'cluster-pins',
        label: 'Supercluster',
        iconUrl: MAP_MARKER_ICON_URLS.clusterToggle,
        ariaLabel: clusterPins ? 'Supercluster on' : 'Supercluster off',
        checked: clusterPins,
        onChange: () => setClusterPins((prev) => !prev)
      },
      {
        key: 'interaction-radius',
        label: 'Show interaction radius',
        iconUrl: showInteractionRadius
          ? MAP_MARKER_ICON_URLS.interactionRadiusOn
          : MAP_MARKER_ICON_URLS.interactionRadiusOff,
        ariaLabel: 'Toggle interaction radius circle',
        checked: showInteractionRadius,
        onChange: () => setShowInteractionRadius((prev) => !prev)
      },
      {
        key: 'my-chat-rooms',
        label: 'My chat rooms',
        iconUrl: MAP_MARKER_ICON_URLS.chatMine,
        ariaLabel: 'Toggle visualizing chat rooms you belong to',
        checked: showMyChatRooms,
        onChange: () => setShowMyChatRooms((prev) => !prev)
      },
      {
        key: 'all-chat-rooms',
        label: 'All chat rooms (admin)',
        iconUrl: MAP_MARKER_ICON_URLS.chatAdmin,
        ariaLabel: 'Toggle all chat rooms',
        checked: showAllChatRoomsToggle,
        onChange: () => {
          if (!canUseAdminTools) {
            return;
          }
          setShowAllChatRoomsToggle((prev) => !prev);
        },
        disabled: !canUseAdminTools
      },
      {
        key: 'tap-teleport',
        label: 'Tap to teleport (admin)',
        iconUrl: MAP_MARKER_ICON_URLS.teleport,
        ariaLabel: tapToTeleportEnabled ? 'Disable tap to teleport' : 'Enable tap to teleport',
        checked: tapToTeleportEnabled && canUseAdminTools,
        onChange: () => {
          if (!canUseAdminTools) {
            return;
          }
          setTapToTeleportEnabled((prev) => !prev);
        },
        disabled: !canUseAdminTools
      }
    ],
    [
      clusterPins,
      canUseAdminTools,
      showAllChatRoomsToggle,
      showInteractionRadius,
      showMyChatRooms,
      tapToTeleportEnabled
    ]
  );

  const filterGroups = useMemo(() => {
    const reorderedHighlights = Array.isArray(highlightFilters) ? [...highlightFilters] : [];
    const bookmarkedIndex = reorderedHighlights.findIndex((entry) => entry.key === 'bookmarked-pins');
    if (bookmarkedIndex > 0) {
      const [bookmarked] = reorderedHighlights.splice(bookmarkedIndex, 1);
      reorderedHighlights.unshift(bookmarked);
    }
    return [
      { key: 'pin-types', title: 'Pin types', filters: baseFilterItems },
      { key: 'highlights', title: 'Highlights & alerts', filters: reorderedHighlights },
      { key: 'chat-tools', title: 'Chat overlays & tools', filters: chatFilterItems }
    ].filter((group) => Array.isArray(group.filters) && group.filters.length > 0);
  }, [baseFilterItems, chatFilterItems, highlightFilters]);

  const handleToggleFiltersCollapsed = useCallback(() => {
    setFiltersCollapsed((prev) => !prev);
  }, []);

  if (locationRequired && !hasResolvedLocation) {
    return (
      <div className="map-page">
        <Navbar />
        <Box sx={{ p: 3, display: 'grid', gap: 1 }}>
          <Typography variant="h6">{t('location.requiredTitle')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {shareHelperText || t('location.requiredBody')}
          </Typography>
          {error ? (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          ) : null}
          <Button
            variant="contained"
            onClick={() => {
              setError?.(null);
              handleStartSharing();
            }}
            disabled={isSharing}
          >
            {t('location.retryButton')}
          </Button>
        </Box>
      </div>
    );
  }

  return (
    <div className="map-page">
      <div className="map-frame">
        <MapHeader
          onNotifications={handleNotifications}
          notificationsLabel={notificationsLabel}
          notificationBadge={displayBadge}
          notificationsIcon={updatesIcon}
          isOffline={isOffline}
          onCreatePin={handleCreatePin}
          createIcon={addIconPurple}
        />

        <Box
          sx={{
            width: '100%',
            height: 'calc(100vh - var(--header-h) - 90px)',
            position: 'relative',
            flex: '1 1 auto',
            maxWidth: '100%',
            p: 0,
            m: 0,
            overflow: 'hidden',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.paper'
          }}
        >
        <MapComponent
          userLocation={userLocation}
          nearbyUsers={nearbyUsers}
          pins={mapPinsForRender}
          userRadiusMeters={DEFAULT_MAX_DISTANCE_METERS}
          clusterPins={clusterPins}
          selectedPinId={showChatRooms ? selectedChatRoomId : undefined}
          onPinSelect={showChatRooms ? handleMapPinSelect : undefined}
          onPinView={handleViewPinDetails}
          onChatRoomView={handleViewChatRoom}
          onCurrentUserView={handleViewProfile}
          onPinAuthorView={handleViewPinAuthor}
          isOffline={isOffline}
          currentUserAvatar={viewerProfile?.avatar}
          currentUserDisplayName={viewerProfile?.displayName}
          teleportEnabled={tapToTeleportEnabled && canUseAdminTools}
          showInteractionRadius={showInteractionRadius}
          onTeleportRequest={handleTapTeleport}
          showRecenterControl
        />
        </Box>

        {/* NEW: Filter FAB (mobile-only) */}
        <MapFilterPanel
          collapsed={filtersCollapsed}
          onToggleCollapse={handleToggleFiltersCollapsed}
          filterGroups={filterGroups}
        />
        {hideFullPreferenceError ? (
          <Box sx={{ color: '#b3261e', fontSize: '0.85rem', fontWeight: 600, px: 1.5, mt: 0.5 }}>
            {hideFullPreferenceError}
          </Box>
        ) : null}

        {/* Bottom Navigation */}
        <Navbar />
      </div>
    </div>
  );
}

export default MapPage;
