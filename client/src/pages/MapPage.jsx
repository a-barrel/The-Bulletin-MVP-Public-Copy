import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import '../pages/MapPage.css';
import { useNavigate } from 'react-router-dom';
import MapIcon from '@mui/icons-material/Map';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import MapComponent from '../components/Map';
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
import MapFilterPanel from '../components/map/MapFilterPanel';
import { MAP_FILTERS, MAP_MARKER_ICON_URLS } from '../utils/mapMarkers';
import { applyPinFilters } from '../utils/pinFilters';
import useOfflineAction from '../hooks/useOfflineAction';
import toIdString from '../utils/ids';
import { buildPinMeta } from '../utils/mapPinMeta';
import { viewerHasDeveloperAccess } from '../utils/roles';
import runtimeConfig from '../config/runtime';
import { usePinCache } from '../contexts/PinCacheContext';
import { useTranslation } from 'react-i18next';
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
  const pinCache = usePinCache();

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
        <PageNavHeader title="Map" />
        {locationGateContent}
      </MapPageLayout>
    );
  }

  return (
    <MapPageLayout>
      <PageNavHeader
        title="Map"
        rightSlot={
          <div className="map-header-actions">
            <button
              type="button"
              className="map-icon-btn map-header-create"
              onClick={handleCreatePin}
              disabled={isOffline}
              aria-label={t('mapHeader.createPin')}
              title={isOffline ? t('mapHeader.offlineCreate') : undefined}
            >
              {addIconPurple ? (
                <img src={addIconPurple} alt="" className="map-icon map-icon--create" aria-hidden="true" />
              ) : (
                <span className="map-icon map-icon--create" aria-hidden="true" />
              )}
            </button>

            <button
              className="map-icon-btn"
              type="button"
              aria-label={notificationsLabel}
              onClick={handleNotifications}
              disabled={isOffline}
              title={isOffline ? t('mapHeader.offlineNotifications') : undefined}
            >
              {updatesIcon ? (
                <img src={updatesIcon} alt="" className="map-icon" aria-hidden="true" />
              ) : (
                <span className="map-icon" aria-hidden="true" />
              )}
              {displayBadge ? (
                <span className="map-icon-badge" aria-hidden="true">
                  {displayBadge}
                </span>
              ) : null}
            </button>
          </div>
        }
      />
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
        />
        {hideFullPreferenceError ? (
          <Box className="map-hide-preference-error">
            {hideFullPreferenceError}
          </Box>
        ) : null}
      </div>
    </MapPageLayout>
  );
}

export default memo(MapPage);
