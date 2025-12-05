import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import '../pages/MapPage.css';
import { useNavigate } from 'react-router-dom';
import MapIcon from '@mui/icons-material/Map';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import MapComponent from '../components/Map';
import { routes } from '../routes';
import { useLocationContext } from '../contexts/LocationContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import { useUpdates } from '../contexts/UpdatesContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import useMapExplorer from '../hooks/useMapExplorer';
import useViewerProfile from '../hooks/useViewerProfile';
import useHideFullEventsPreference from '../hooks/useHideFullEventsPreference';
import useAutoRefreshGeolocation from '../hooks/useAutoRefreshGeolocation';
import { DEFAULT_MAX_DISTANCE_METERS, FALLBACK_LOCATION } from '../utils/mapExplorerConstants';
import { MAP_FILTERS } from '../utils/mapMarkers';
import { applyPinFilters } from '../utils/pinFilters';
import useOfflineAction from '../hooks/useOfflineAction';
import toIdString from '../utils/ids';
import { buildPinMeta } from '../utils/mapPinMeta';
import { hasValidCoordinates } from '../utils/mapLocation';
import { viewerHasDeveloperAccess } from '../utils/roles';
import { isTeleportLockedForUser, clearTeleportLockForUser } from '../utils/mapTeleportSession';
import runtimeConfig from '../config/runtime';
import { usePinCache } from '../contexts/PinCacheContext';
import { useTranslation } from 'react-i18next';
import usePinReporting from '../hooks/pin/usePinReporting';
import ReportContentDialog from '../components/ReportContentDialog';
import normalizeObjectId from '../utils/normalizeObjectId';
import {
  useMapFilters,
  extractIds,
  FILTER_STORAGE_KEY,
  LEGACY_FILTER_STORAGE_KEY
} from '../components/map/useMapFilters';
import { logMapPerf, nowIfPerf } from '../utils/mapPerfLogger';
import MapFiltersSection from '../components/map/MapFiltersSection';
import MapPageLayout from '../components/map/MapPageLayout';
import PageNavHeader from '../components/PageNavHeader';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import HeaderActionButtons from '../components/HeaderActionButtons';


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
  const [authUser] = useAuthState(auth);
  const { location: sharedLocation, setLocation: setSharedLocation } = useLocationContext();
  const offlineAction = useOfflineAction(isOffline);
  const { viewer: preferenceProfile, isLoading: isLoadingViewerProfile } = useViewerProfile({
    enabled: !isOffline,
    skip: isOffline
  });
  const adminOverride = useMemo(
    () =>
      viewerHasDeveloperAccess(preferenceProfile, {
        offlineOverride: runtimeConfig.isOffline || isOffline
      }),
    [isOffline, preferenceProfile]
  );
  const teleportLockUid = authUser?.uid || null;
  const teleportLocked = isTeleportLockedForUser(teleportLockUid);

  const lastAuthUidRef = useRef();
  useEffect(() => {
    const prevUid = lastAuthUidRef.current;

    // On auth change, clear lock for the old user.
    if (prevUid && teleportLockUid !== prevUid) {
      clearTeleportLockForUser(prevUid);
    }

    // If switching to a new user (not initial mount), clear any stale lock for the new uid.
    if (teleportLockUid && prevUid && teleportLockUid !== prevUid) {
      clearTeleportLockForUser(teleportLockUid);
    }

    lastAuthUidRef.current = teleportLockUid;
  }, [teleportLockUid]);

  const shouldAutoRefreshLocation =
    !isOffline && !isLoadingViewerProfile && !adminOverride && !teleportLocked;

  useEffect(() => {
    if (!teleportLocked || isOffline) {
      return;
    }
    if (!hasValidCoordinates(sharedLocation)) {
      return;
    }
    // Auto geo refresh is paused while teleport lock is active; still fetch fresh pins at the spoofed location.
    refreshPins(sharedLocation);
  }, [isOffline, refreshPins, sharedLocation, teleportLocked]);

  useAutoRefreshGeolocation({
    enabled: shouldAutoRefreshLocation,
    setSharedLocation,
    source: 'map-page-auto-refresh'
  });
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
    isSharing,
    refreshPins
  } = useMapExplorer({
    sharedLocation,
    setSharedLocation,
    isOffline,
    hideFullEvents,
    enforceLocation: !adminOverride,
    isAdminExempt: adminOverride
  });
  const pinCache = usePinCache();
  const {
    reportDialogOpen,
    reportTarget,
    reportReason,
    reportSelectedOffenses,
    reportError,
    isSubmittingReport,
    openReportDialog,
    closeReportDialog,
    toggleReportOffense,
    submitReport,
    setReportReason
  } = usePinReporting();

  const {
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
  } = useMapFilters();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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
    return new Set(extractIds(friends));
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

  const handleReportPinFromMap = useCallback(
    (pin) => {
      const pinId =
        normalizeObjectId(pin?._id) ||
        normalizeObjectId(pin?.id) ||
        normalizeObjectId(pin?.pinId);
      if (!pinId) {
        return;
      }
      const title =
        typeof pin?.title === 'string' && pin.title.trim()
          ? pin.title.trim()
          : 'Shared pin';
      openReportDialog({
        contentType: 'pin',
        contentId: pinId,
        summary: title,
        context: 'Map view'
      });
    },
    [openReportDialog]
  );

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
      const cached = pin?._id ? pinCache.getPin(pin._id) : null;
      const mergedPin =
        cached && typeof cached === 'object'
          ? {
              ...cached,
              ...pin,
              viewerHasBookmarked:
                typeof cached.viewerHasBookmarked === 'boolean'
                  ? cached.viewerHasBookmarked
                  : pin?.viewerHasBookmarked,
              bookmarkCount:
                typeof cached.bookmarkCount === 'number'
                  ? cached.bookmarkCount
                  : pin?.bookmarkCount ??
                    cached?.stats?.bookmarkCount ??
                    pin?.stats?.bookmarkCount ??
                    null
            }
          : pin;
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
        ...mergedPin,
        friendsGoing: friendsGoingCount,
        friendsGoingCount,
        friendsGoingPending,
        stats: {
          ...(mergedPin?.stats || {}),
          friendsGoing: friendsGoingCount,
          friendsGoingCount
        },
        mapMeta,
        mapColorKey: mapMeta.colorKey
      };
    });
    logMapPerf('annotate pins', started, { count: result.length });
    return result;
  }, [pins, friendIdsSet, viewerId]);

  const visiblePins = useMemo(() => {
    const started = nowIfPerf();
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
    logMapPerf('filter pins', started, { input: annotatedPins.length, output: filtered.length });
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
    const started = nowIfPerf();
    const merged = [...visiblePins, ...visibleChatRoomPins];
    logMapPerf('merge pins for map', started, { pins: visiblePins.length, chats: visibleChatRoomPins.length, total: merged.length });
    return merged;
  }, [visiblePins, visibleChatRoomPins]);
  useEffect(() => {
    logMapPerf('map pin counts change', null, {
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

  const handleToggleAlerts = useCallback(
    (checked) => {
      if (hideFullPreferenceError) {
        clearPreferenceError();
      }
      setHideFullEvents(!checked);
      setShowExpiringDiscussions(checked);
      setShowEventsStartingSoon(checked);
    },
    [clearPreferenceError, hideFullPreferenceError, setHideFullEvents, setShowEventsStartingSoon, setShowExpiringDiscussions]
  );

  const handleToggleBoosted = useCallback(
    (checked) => {
      setShowFeaturedPins(checked);
      setShowPopularPins(checked);
      setShowOpenSpotPins(checked);
    },
    [setShowFeaturedPins, setShowOpenSpotPins, setShowPopularPins]
  );

  const handleResetFilters = useCallback(() => {
    setShowEvents(true);
    setShowDiscussions(true);
    setShowPersonalPins(true);
    setShowFriendPins(true);
    setHideFullEvents(true);
    setShowExpiringDiscussions(true);
    setShowEventsStartingSoon(true);
    setShowPopularPins(true);
    setShowBookmarkedPins(true);
    setShowOpenSpotPins(true);
    setShowFeaturedPins(true);
    setShowMyChatRooms(false);
    setShowAllChatRoomsToggle(false);
    setTapToTeleportEnabled(false);
    setShowInteractionRadius(false);
    setClusterPins(true);
    setFiltersCollapsed(false);
    setShowAdvancedFilters(false);
  }, [
    setClusterPins,
    setFiltersCollapsed,
    setHideFullEvents,
    setShowAllChatRoomsToggle,
    setShowBookmarkedPins,
    setShowDiscussions,
    setShowEvents,
    setShowEventsStartingSoon,
    setShowExpiringDiscussions,
    setShowFeaturedPins,
    setShowFriendPins,
    setShowInteractionRadius,
    setShowMyChatRooms,
    setShowOpenSpotPins,
    setShowPersonalPins,
    setShowPopularPins,
    setTapToTeleportEnabled,
    setShowAdvancedFilters
  ]);

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

  const handleResetLocation = useCallback(() => {
    if (!canUseAdminTools) {
      return;
    }
    const applyFallback = () => {
      setSharedLocation({
        latitude: FALLBACK_LOCATION.latitude,
        longitude: FALLBACK_LOCATION.longitude,
        accuracy: FALLBACK_LOCATION.accuracy,
        source: 'developer-reset-fallback'
      });
      setError?.(null);
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      applyFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSharedLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: 'developer-reset-browser'
        });
        setError?.(null);
      },
      () => {
        applyFallback();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [canUseAdminTools, setError, setSharedLocation]);

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
  const headerActions = (
    <HeaderActionButtons
      isOffline={isOffline}
      unreadCount={unreadCount}
      onCreatePin={handleCreatePin}
      onOpenUpdates={handleNotifications}
      notificationsLabel={notificationsLabel}
      createLabel={t('mapHeader.createPin')}
    >
      {canUseAdminTools ? (
        <button
          type="button"
          className="map-icon-btn"
          aria-label="Reset location to default"
          onClick={handleResetLocation}
          title="Reset location to default debug coordinates"
        >
          <MyLocationIcon fontSize="small" />
        </button>
      ) : null}
    </HeaderActionButtons>
  );

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
        iconClassName: 'full',
        ariaLabel: showFullEvents ? 'Showing full events' : 'Hiding full events',
        checked: showFullEvents,
        onChange: handleToggleFullEventsFilter,
        disabled: isSavingHideFullPreference
      },
      {
        key: 'friend-pins',
        label: 'Friend pins',
        iconClassName: 'friend',
        ariaLabel: 'Toggle friend pins',
        checked: showFriendPins,
        onChange: () => setShowFriendPins((prev) => !prev)
      },
      {
        key: 'expiring-discussions',
        label: 'Discussions expiring soon',
        iconClassName: 'alert',
        ariaLabel: 'Toggle discussions expiring within 24 hours',
        checked: showExpiringDiscussions,
        onChange: () => setShowExpiringDiscussions((prev) => !prev)
      },
      {
        key: 'events-soon',
        label: 'Events starting soon',
        iconClassName: 'event',
        ariaLabel: 'Toggle events starting soon',
        checked: showEventsStartingSoon,
        onChange: () => setShowEventsStartingSoon((prev) => !prev)
      },
      {
        key: 'popular-pins',
        label: 'Popular pins',
        iconClassName: 'popular-filter-icon',
        ariaLabel: 'Toggle popular pins',
        checked: showPopularPins,
        onChange: () => setShowPopularPins((prev) => !prev)
      },
      {
        key: 'bookmarked-pins',
        label: 'Bookmarked pins (always visible)',
        iconClassName: 'bookmarked',
        ariaLabel: 'Toggle bookmarked pins (always visible even if types are off)',
        checked: showBookmarkedPins,
        onChange: () => setShowBookmarkedPins((prev) => !prev),
        helperText: 'When on, all bookmarks stay visible even if pin type filters are off.'
      },
      {
        key: 'open-spots',
        label: 'Open spots',
        iconClassName: 'open',
        ariaLabel: 'Toggle pins with open spots',
        checked: showOpenSpotPins,
        onChange: () => setShowOpenSpotPins((prev) => !prev)
      },
      {
        key: 'featured-pins',
        label: 'Featured pins',
        iconClassName: 'featured',
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
        iconClassName: 'cluster',
        ariaLabel: clusterPins ? 'Supercluster on' : 'Supercluster off',
        checked: clusterPins,
        onChange: () => setClusterPins((prev) => !prev)
      },
      {
        key: 'interaction-radius',
        label: 'Show interaction radius',
        iconClassName: 'radius',
        ariaLabel: 'Toggle interaction radius circle',
        checked: showInteractionRadius,
        onChange: () => setShowInteractionRadius((prev) => !prev)
      },
      {
        key: 'my-chat-rooms',
        label: 'My chat rooms',
        iconClassName: 'personal',
        ariaLabel: 'Toggle visualizing chat rooms you belong to',
        checked: showMyChatRooms,
        onChange: () => setShowMyChatRooms((prev) => !prev)
      },
      {
        key: 'all-chat-rooms',
        label: 'All chat rooms (admin)',
        iconClassName: 'discussion',
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
        iconClassName: 'teleport',
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

  const { filterGroups, hasAdvancedFilters } = useMemo(() => {
    const highlights = Array.isArray(highlightFilters) ? [...highlightFilters] : [];
    const bookmarks = highlights.filter((entry) => entry.key === 'bookmarked-pins');
    const people = highlights.filter((entry) => entry.key === 'friend-pins');
    const status = highlights.filter(
      (entry) => entry.key !== 'bookmarked-pins' && entry.key !== 'friend-pins'
    );

    const alertsEnabled = !hideFullEvents && showExpiringDiscussions && showEventsStartingSoon;
    const boostedEnabled = showFeaturedPins && showPopularPins && showOpenSpotPins;

    const quickFilters = [
      {
        key: 'alerts-toggle',
        label: 'Alerts (full / expiring / soon)',
        iconClassName: 'alert',
        checked: alertsEnabled,
        onChange: (event) => handleToggleAlerts(Boolean(event?.target?.checked))
      },
      {
        key: 'boosted-toggle',
        label: 'Boosted pins (featured / popular / open)',
        iconClassName: 'featured',
        checked: boostedEnabled,
        onChange: (event) => handleToggleBoosted(Boolean(event?.target?.checked))
      }
    ];

    const clusters = chatFilterItems.filter((entry) =>
      ['cluster-pins', 'interaction-radius'].includes(entry.key)
    );
    const adminChat = canUseAdminTools
      ? chatFilterItems.filter((entry) => !['cluster-pins', 'interaction-radius'].includes(entry.key))
      : [];

    const groups = [
      { key: 'pin-types', title: 'Pin types', filters: baseFilterItems },
      { key: 'bookmarks', title: 'Bookmarks', filters: bookmarks },
      { key: 'people', title: 'People', filters: people },
      { key: 'quick-status', title: 'Status & highlights', filters: quickFilters }
    ];

    if (showAdvancedFilters && status.length) {
      groups.push({ key: 'advanced-status', title: 'Advanced status toggles', filters: status });
    }

    if (clusters.length || adminChat.length) {
      const tools = [...clusters, ...adminChat];
      groups.push({ key: 'admin-chat', title: 'Tools', filters: tools });
    }

    return {
      filterGroups: groups.filter((group) => Array.isArray(group.filters) && group.filters.length > 0),
      hasAdvancedFilters: status.length > 0
    };
  }, [
    baseFilterItems,
    canUseAdminTools,
    chatFilterItems,
    handleToggleAlerts,
    handleToggleBoosted,
    highlightFilters,
    hideFullEvents,
    showAdvancedFilters,
    showEventsStartingSoon,
    showExpiringDiscussions,
    showFeaturedPins,
    showOpenSpotPins,
    showPopularPins
  ]);

  const handleToggleFiltersCollapsed = useCallback(() => {
    setFiltersCollapsed((prev) => !prev);
  }, []);

  const locationGateContent = locationRequired && !hasResolvedLocation && (
    <Box className="map-location-gate">
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
  );

  if (locationGateContent) {
    return (
      <MapPageLayout>
        <PageNavHeader title="Map" rightSlot={headerActions} />
        {locationGateContent}
      </MapPageLayout>
    );
  }

  return (
    <MapPageLayout>
      <PageNavHeader title="Map" rightSlot={headerActions} />
      <div className="map-frame">
        <Box className="map-canvas-wrapper">
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
            onPinFlag={handleReportPinFromMap}
            isOffline={isOffline}
            currentUserAvatar={viewerProfile?.avatar}
            currentUserDisplayName={viewerProfile?.displayName}
            teleportEnabled={tapToTeleportEnabled && canUseAdminTools}
            showInteractionRadius={showInteractionRadius}
            onTeleportRequest={handleTapTeleport}
            showRecenterControl
          />
        </Box>

        <MapFiltersSection
          collapsed={filtersCollapsed}
          onToggleCollapse={handleToggleFiltersCollapsed}
          filterGroups={filterGroups}
          onResetFilters={handleResetFilters}
          onToggleAdvanced={hasAdvancedFilters ? () => setShowAdvancedFilters((prev) => !prev) : undefined}
          advancedVisible={showAdvancedFilters}
          hasAdvancedFilters={hasAdvancedFilters}
        />
        {hideFullPreferenceError ? (
          <Box className="map-hide-preference-error">
            {hideFullPreferenceError}
          </Box>
        ) : null}
      </div>
      <ReportContentDialog
        open={reportDialogOpen}
        onClose={closeReportDialog}
        onSubmit={submitReport}
        reason={reportReason}
        onReasonChange={setReportReason}
        selectedReasons={reportSelectedOffenses}
        onToggleReason={toggleReportOffense}
        submitting={isSubmittingReport}
        error={reportError}
        contentSummary={reportTarget?.summary}
        context={reportTarget?.context}
      />
    </MapPageLayout>
  );
}

export default memo(MapPage);
