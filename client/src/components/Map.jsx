import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Circle,
  CircleMarker,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import '../styles/leaflet.css';
import './Map.css';
import { formatDistanceMiles, haversineDistanceMeters } from '../utils/geo';
import runtimeConfig from '../config/runtime';
import resolveAssetUrl from '../utils/media';
import {
  MAP_MARKER_ICON_URLS,
  MAP_MARKER_SHADOW_URL
} from '../utils/mapMarkers';
import { resolveUserAvatarUrl } from '../utils/pinFormatting';
import usePinClusters from './map/usePinClusters';
import PinPreviewCard from './PinPreviewCard';
import toIdString from '../utils/ids';
import { createPinBookmark, deletePinBookmark } from '../api';
import RecenterControl from './map/RecenterControl';
import { usePinCache } from '../contexts/PinCacheContext';

function PinCardOverlay({ position, children }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !position) return;

    const container = L.DomUtil.create("div", "pin-card-overlay");
    container.style.position = "absolute";
    container.style.transform = "translate(-50%, -100%)";

    const inner = L.DomUtil.create("div", "pin-card-overlay-inner");
    container.appendChild(inner);

    // Append React children into DOM node
    const overlay = L.popup({
      closeButton: false,
      autoPan: false,
      className: "no-default-popup"
    })
      .setLatLng(position)
      .setContent(container)
      .openOn(map);

    // cleanup
    return () => {
      map.removeLayer(overlay);
    };
  }, [map, position, children]);

  return null;
}
// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createMarkerIcon = (key, extraClassName) =>
  new L.Icon({
    iconUrl: MAP_MARKER_ICON_URLS[key] ?? MAP_MARKER_ICON_URLS.default,
    shadowUrl: MAP_MARKER_SHADOW_URL,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: ['leaflet-marker-icon', extraClassName].filter(Boolean).join(' ')
  });

const markerIconCache = new globalThis.Map();
const getMarkerIconByKey = (key, extraClassName) => {
  const cacheKey = `${key || 'default'}::${extraClassName || ''}`;
  if (!markerIconCache.has(cacheKey)) {
    markerIconCache.set(cacheKey, createMarkerIcon(key, extraClassName));
  }
  return markerIconCache.get(cacheKey);
};

const nearbyIcon = getMarkerIconByKey('nearby');

const AVATAR_FALLBACK = '/images/profile/profile-01.jpg';

const computeInitials = (value) => {
  if (!value || typeof value !== 'string') {
    return 'YOU';
  }
  const segments = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!segments.length) {
    return 'YOU';
  }
  return segments
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3);
};

const createAvatarMarkerIcon = (avatarUrl, initials) =>
  L.divIcon({
    className: 'user-avatar-marker',
    html: `
      <div class="user-avatar-marker__outer">
        <div class="user-avatar-marker__ring"></div>
        <div class="user-avatar-marker__avatar">
          ${
            avatarUrl
              ? `<img src="${avatarUrl}" alt="" />`
              : `<span>${initials || 'YOU'}</span>`
          }
        </div>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 48],
    popupAnchor: [0, -44]
  });

// Component to handle map center updates
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, undefined, { animate: true });
  }, [center, map]);
  return null;
}

function ZoomWatcher({ onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    if (typeof onZoomChange !== 'function') {
      return undefined;
    }
    const handler = () => onZoomChange(map.getZoom());
    handler();
    map.on('zoomend', handler);
    return () => {
      map.off('zoomend', handler);
    };
  }, [map, onZoomChange]);
  return null;
}

function ResizeHandler({ signature }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [signature, map]);
  return null;
}

function TeleportClickHandler({ enabled, onTeleport }) {
  const map = useMapEvents({
    click(event) {
      if (enabled && typeof onTeleport === 'function') {
        onTeleport(event.latlng);
      }
    }
  });

  useEffect(() => {
    const container = map?.getContainer?.();
    if (!container) {
      return undefined;
    }
    if (enabled) {
      container.classList.add('map-teleport-active');
    } else {
      container.classList.remove('map-teleport-active');
    }
    return () => {
      container.classList.remove('map-teleport-active');
    };
  }, [enabled, map]);

  return null;
}

function ClusterLayer({ pins, enabled, renderPin }) {
  const map = useMap();
  const { clusters, setClusters, getClusters, getExpansionZoom } = usePinClusters(pins, {
    enabled
  });
  const prevClustersRef = useRef([]);

  const clustersEqual = (a, b) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const ca = a[i];
      const cb = b[i];
      if (!ca || !cb) return false;
      if (ca.id !== cb.id) return false;
      const [lonA, latA] = ca.geometry?.coordinates || [];
      const [lonB, latB] = cb.geometry?.coordinates || [];
      if (lonA !== lonB || latA !== latB) return false;
      if (ca.properties?.point_count !== cb.properties?.point_count) return false;
    }
    return true;
  };

  const updateClusters = useCallback(() => {
    if (!enabled) {
      if (clusters.length) {
        setClusters([]);
        prevClustersRef.current = [];
      }
      return;
    }
    const bounds = map.getBounds();
    if (!bounds) {
      return;
    }
    const zoom = map.getZoom();
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const next = getClusters(bbox, zoom);
    if (!clustersEqual(prevClustersRef.current, next)) {
      prevClustersRef.current = next;
      setClusters(next);
    }
  }, [clusters.length, enabled, getClusters, map, setClusters]);

  useEffect(() => {
    updateClusters();
  }, [updateClusters, pins]);

  useEffect(() => {
    const handleMove = () => updateClusters();
    map.on('moveend', handleMove);
    map.on('zoomend', handleMove);
    return () => {
      map.off('moveend', handleMove);
      map.off('zoomend', handleMove);
    };
  }, [map, updateClusters]);

  return clusters.map((cluster) => {
    const [longitude, latitude] = cluster.geometry.coordinates;
    if (cluster.properties.cluster) {
      const count = cluster.properties.point_count;
      const size =
        count < 10 ? 34 : count < 50 ? 40 : count < 200 ? 48 : 56;
      const icon = L.divIcon({
        html: `<div class="pin-cluster-marker" style="width:${size}px;height:${size}px"><span>${count}</span></div>`,
        className: 'pin-cluster-wrapper',
        iconSize: [size, size]
      });
      const handleClick = () => {
        const expansionZoom = getExpansionZoom(cluster.id ?? cluster.properties.cluster_id);
        const nextZoom =
          expansionZoom && Number.isFinite(expansionZoom)
            ? Math.min(expansionZoom, map.getMaxZoom())
            : map.getZoom() + 1;
        map.setView([latitude, longitude], nextZoom, { animate: true });
      };
      return (
        <Marker
          key={`cluster-${cluster.id ?? cluster.properties.cluster_id}-${latitude}-${longitude}`}
          position={[latitude, longitude]}
          icon={icon}
          eventHandlers={{ click: handleClick }}
        />
      );
    }
    const pin = cluster.properties?.pin;
    return renderPin ? renderPin(pin) : null;
  });
}

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatExpiration = (pin) => {
  const expirationSource = pin?.expiresAt ?? pin?.endDate;
  const expiresAt = parseDate(expirationSource);
  if (!expiresAt) {
    return null;
  }

  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) {
    return 'Expired';
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0 && hours > 0) {
    return `Expires in ${days}d ${hours}h`;
  }

  if (days > 0) {
    return `Expires in ${days}d`;
  }

  if (hours > 0) {
    return `Expires in ${hours}h`;
  }

  return 'Expires in <1h';
};

const toLatLng = (location) => {
  if (!location) {
    return null;
  }
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return [latitude, longitude];
};

const resolvePinIcon = (pin) => {
  if (pin?.isSelf || pin?.viewerIsCreator || pin?.mapMeta?.isPersonal) {
    return getMarkerIconByKey('personal', 'self-pin-icon');
  }
  const normalizedType = typeof pin?.type === 'string' ? pin.type.toLowerCase() : '';
  const colorKey =
    typeof pin?.mapColorKey === 'string' && MAP_MARKER_ICON_URLS[pin.mapColorKey]
      ? pin.mapColorKey
      : null;
  const extraClass = pin?.mapMeta?.isPopular ? 'popular-pin-icon' : undefined;
  if (colorKey) {
    return getMarkerIconByKey(colorKey, extraClass);
  }
  if (normalizedType === 'discussion') {
    return getMarkerIconByKey('discussion', extraClass);
  }
  if (normalizedType === 'event') {
    return getMarkerIconByKey('event', extraClass);
  }
  return getMarkerIconByKey('default', extraClass);
};

const ensureAbsoluteUploadsUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return url;
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  let normalized = url.trim();
  if (!normalized) {
    return url;
  }
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(1);
  }
  if (
    runtimeConfig.apiBaseUrl &&
    (normalized.startsWith('/uploads/') || normalized.startsWith('uploads/'))
  ) {
    const base = runtimeConfig.apiBaseUrl.replace(/\/$/, '');
    const trimmed = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return `${base}${trimmed}`;
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const resolveThumbnailUrl = (asset) => {
  if (!asset) {
    return null;
  }

  const directUrl = resolveAssetUrl(asset, { fallback: null, baseUrl: '' });
  if (directUrl) {
    return ensureAbsoluteUploadsUrl(directUrl);
  }

  const apiUrl = resolveAssetUrl(asset, { fallback: null });
  return ensureAbsoluteUploadsUrl(apiUrl);
};

const Map = ({
  userLocation,
  nearbyUsers = [],
  pins = [],
  onPinSelect,
  onPinView,
  onPinBookmark,
  onPinAuthorView,
  onPinFlag,
  onChatRoomView,
  selectedPinId,
  centerOverride,
  userRadiusMeters,
  clusterPins = true,
  isOffline = false,
  currentUserAvatar,
  currentUserDisplayName,
  showInteractionRadius = true,
  teleportEnabled = false,
  onTeleportRequest,
  showRecenterControl = false
  ,
  scrollWheelZoom = true
}) => {
  const tileLayerRef = useRef(null);
  const tileErrorCountRef = useRef(0);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(true);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [mapInstanceKey] = useState(() => `map-${Math.random().toString(36).slice(2)}`);
  const userAvatarUrl = useMemo(
    () => resolveThumbnailUrl(currentUserAvatar) ?? AVATAR_FALLBACK,
    [currentUserAvatar]
  );
  const userInitials = useMemo(
    () => computeInitials(currentUserDisplayName),
    [currentUserDisplayName]
  );
  const userIcon = useMemo(
    () => createAvatarMarkerIcon(userAvatarUrl, userInitials),
    [userAvatarUrl, userInitials]
  );
  const handleTileError = useCallback(() => {
    const layer = tileLayerRef.current;
    if (!layer || typeof layer.redraw !== 'function') {
      return;
    }
    tileErrorCountRef.current += 1;
    if (isOffline || tileErrorCountRef.current >= 2) {
      setTilesUnavailable(true);
      return;
    }
    // Small delay lets transient network hiccups settle before refreshing tiles.
    window.setTimeout(() => {
      try {
        layer.redraw();
      } catch (error) {
        console.warn('Failed to redraw tile layer after error:', error);
      }
    }, 500);
  }, [isOffline]);

  useEffect(() => {
    if (isOffline) {
      setTilesUnavailable(true);
    } else {
      tileErrorCountRef.current = 0;
      setTilesUnavailable(false);
      const layer = tileLayerRef.current;
      if (layer && typeof layer.redraw === 'function') {
        try {
          layer.redraw();
        } catch (error) {
          console.warn('Failed to redraw tile layer after regaining connection:', error);
        }
      }
    }
  }, [isOffline]);

  const handleRetryTiles = useCallback(() => {
    tileErrorCountRef.current = 0;
    setTilesUnavailable(false);
    const layer = tileLayerRef.current;
    if (layer && typeof layer.redraw === 'function') {
      try {
        layer.redraw();
      } catch (error) {
        console.warn('Failed to redraw tile layer during manual retry:', error);
      }
    }
  }, []);

  const resolvedCenter = useMemo(() => {
    const center = toLatLng(centerOverride) ?? toLatLng(userLocation);
    if (Array.isArray(center) && center.length === 2) {
      return [center[0], center[1]];
    }
    return [0, 0];
  }, [centerOverride, userLocation]);
  const userMarkerPosition = toLatLng(userLocation);
  const resolvedPins = useMemo(() => (Array.isArray(pins) ? pins : []), [pins]);
  const clusterablePins = useMemo(
    () =>
      resolvedPins.filter((pin) => {
        const type = typeof pin?.type === 'string' ? pin.type.toLowerCase() : '';
        return type !== 'chat-room' && type !== 'global-chat-room';
      }),
    [resolvedPins]
  );
  const chatPins = useMemo(
    () =>
      resolvedPins.filter((pin) => {
        const type = typeof pin?.type === 'string' ? pin.type.toLowerCase() : '';
        return type === 'chat-room' || type === 'global-chat-room';
      }),
    [resolvedPins]
  );
  const safeChatPins = chatPins || [];
  const safeClusterablePins = clusterablePins || [];
  const resizeSignature = `${resolvedCenter?.[0] ?? 'na'}-${resolvedCenter?.[1] ?? 'na'}-${resolvedPins.length}-${nearbyUsers.length}-${userRadiusMeters ?? 'no-radius'}`;
  const [mapZoom, setMapZoom] = useState(13);
  const [bookmarkedPinIds, setBookmarkedPinIds] = useState(() => new Set());
  const pinCache = usePinCache();

  // Clean up the Leaflet map instance on unmount to avoid reusing a dead container.
  useEffect(() => {
    return () => {
      if (mapRef.current && typeof mapRef.current.remove === 'function') {
        try {
          mapRef.current.off();
          mapRef.current.remove();
        } catch (error) {
          console.warn('Failed to clean up map instance', error);
        }
      }
      mapRef.current = null;
    };
  }, []);

  const resolvePinId = useCallback((pin) => {
    return (
      toIdString(pin?._id) ||
      toIdString(pin?.id) ||
      toIdString(pin?.pinId) ||
      (typeof pin?._id === 'object' && pin?._id?.$oid ? pin._id.$oid : null)
    );
  }, []);

  const handleToggleBookmark = useCallback(
    async (pin) => {
      const pinId = resolvePinId(pin);
      if (!pinId) return;
      const isOwner = Boolean(pin?.viewerOwnsPin || pin?.viewerIsCreator || pin?.isSelf);
      const isAttending = Boolean(pin?.viewerIsAttending);

      if (typeof onPinBookmark === 'function') {
        onPinBookmark(pin);
        return;
      }
      if (isOffline) {
        // eslint-disable-next-line no-console
        console.warn('Reconnect to manage bookmarks.');
        return;
      }
      if (isOwner || isAttending) {
        return;
      }

      const currentlyBookmarked =
        pin?.viewerHasBookmarked === true ? true : bookmarkedPinIds.has(pinId);
      const nextState = !currentlyBookmarked;

      try {
        let updatedPin = pin;
        if (nextState) {
          const response = await createPinBookmark(pinId);
          const currentCount = pin?.bookmarkCount ?? pin?.stats?.bookmarkCount ?? 0;
          const nextBookmarkCount =
            typeof response?.bookmarkCount === 'number' ? response.bookmarkCount : currentCount + 1;
          const nextViewerHasBookmarked =
            typeof response?.viewerHasBookmarked === 'boolean'
              ? response.viewerHasBookmarked
              : true;
          updatedPin = {
            ...pin,
            viewerHasBookmarked: nextViewerHasBookmarked,
            bookmarkCount: nextBookmarkCount,
            stats: pin?.stats ? { ...pin.stats, bookmarkCount: nextBookmarkCount } : pin?.stats
          };
        } else {
          const response = await deletePinBookmark(pinId);
          const currentCount = pin?.bookmarkCount ?? pin?.stats?.bookmarkCount ?? 0;
          const nextBookmarkCount =
            typeof response?.bookmarkCount === 'number'
              ? response.bookmarkCount
              : Math.max(0, currentCount - 1);
          const nextViewerHasBookmarked =
            typeof response?.viewerHasBookmarked === 'boolean'
              ? response.viewerHasBookmarked
              : false;
          updatedPin = {
            ...pin,
            viewerHasBookmarked: nextViewerHasBookmarked,
            bookmarkCount: nextBookmarkCount,
            stats: pin?.stats ? { ...pin.stats, bookmarkCount: nextBookmarkCount } : pin?.stats
          };
        }
        setBookmarkedPinIds((prev) => {
          const next = new Set(prev);
          if (nextState) {
            next.add(pinId);
          } else {
            next.delete(pinId);
          }
          return next;
        });
        if (updatedPin) {
          pinCache.upsertPin(updatedPin);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to toggle bookmark from map:', error);
      }
    },
    [bookmarkedPinIds, isOffline, onPinBookmark, pinCache, resolvePinId]
  );

  // Keep local bookmarked set in sync with incoming pins (e.g., when returning to the map).
  useEffect(() => {
    if (!Array.isArray(resolvedPins) || !resolvedPins.length) {
      return;
    }
    setBookmarkedPinIds((prev) => {
      const next = new Set(prev);
      resolvedPins.forEach((pin) => {
        const pinId = resolvePinId(pin);
        if (pinId && pin?.viewerHasBookmarked === true) {
          next.add(pinId);
        }
      });
      return next;
    });
  }, [resolvedPins, resolvePinId]);

  const handleFlagPin = useCallback(
    (pin) => {
      if (typeof onPinFlag === 'function') {
        onPinFlag(pin);
      }
    },
    [onPinFlag]
  );

  const renderPinPopup = useCallback(
    (pin, distanceLabel, expirationLabel, canViewPin, canViewChatRoom, handleViewPin) => {
      // determine the thumbnail
      const thumbnailAsset =
        pin?.coverPhoto ||
        (Array.isArray(pin?.photos) && pin.photos.length > 0
          ? pin.photos[0]
          : null);

      const thumbnailUrl = resolveThumbnailUrl(thumbnailAsset);
      const hostName = pin?.creator?.displayName || pin?.creator?.username || null;
      const hostAvatarUrl =
        pin?.creatorAvatarUrl || resolveUserAvatarUrl(pin?.creator, AVATAR_FALLBACK) || AVATAR_FALLBACK;

      return (
        <div style={{ minWidth: '208px', maxWidth: '240px' }}>
          {thumbnailUrl ? (
            <div
              style={{
                width: '100%',
                marginBottom: '0.65rem',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: '0 8px 20px rgba(12, 17, 28, 0.28)'
              }}
            >
              <img
                src={thumbnailUrl}
                alt={pin?.title ? `${pin.title} preview` : 'Pin preview'}
                style={{ display: 'block', width: '100%', height: '132px', objectFit: 'cover' }}
              />
            </div>
          ) : null}
          <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '0.35rem' }}>
            {pin.title ?? 'Untitled pin'}
          </strong>
          {pin.type ? <div>Type: {pin.type}</div> : null}
          {pin._id ? <div>ID: {pin._id}</div> : null}
          {distanceLabel ? <div>Distance: {distanceLabel} mi</div> : null}
          {expirationLabel ? <div>{expirationLabel}</div> : null}
          {hostName ? (
            <div
              style={{
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <img
                src={hostAvatarUrl}
                alt={`${hostName} avatar`}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid rgba(93,56,137,0.35)'
                }}
              />
              <div style={{ fontSize: '0.85rem', lineHeight: 1.2 }}>
                <div style={{ fontWeight: 600 }}>Host</div>
                <div>{hostName}</div>
              </div>
            </div>
          ) : null}
          {canViewPin || canViewChatRoom ? (
            <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
              <button
                type="button"
                onClick={handleViewPin}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: '#3EB8F0',
                  color: '#fff',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                View
              </button>
            </div>
          ) : null}
        </div>
      );
    },
    []
  );

  const renderRegularPin = useCallback(
  (pin) => {
    const coordinates = pin?.coordinates?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return null;
    }
    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const pinId =
      resolvePinId(pin) ?? `pin-${latitude}-${longitude}-${pin?.title ?? "pin"}`;
    const cachedPin = pinId ? pinCache.getPin(pinId) : null;
    const mergedPin = cachedPin
      ? {
          ...cachedPin,
          ...pin,
          viewerHasBookmarked:
            typeof cachedPin.viewerHasBookmarked === 'boolean'
              ? cachedPin.viewerHasBookmarked
              : pin?.viewerHasBookmarked,
          bookmarkCount:
            typeof cachedPin.bookmarkCount === 'number'
              ? cachedPin.bookmarkCount
              : pin?.bookmarkCount ??
                cachedPin?.stats?.bookmarkCount ??
                pin?.stats?.bookmarkCount
        }
      : pin;

    // ----- distance / time -----
    const providedDistance =
      typeof mergedPin.distanceMeters === "number" ? mergedPin.distanceMeters : null;
    const computedDistance =
      providedDistance ??
      haversineDistanceMeters(userMarkerPosition, [latitude, longitude]);
    const distanceLabel = formatDistanceMiles(computedDistance, { decimals: 1 });
    const expirationLabel = formatExpiration(mergedPin);

    // ----- image for the popup -----
    const thumbnailAsset =
      mergedPin?.coverPhoto ||
      (Array.isArray(mergedPin?.photos) && mergedPin.photos.length > 0
        ? mergedPin.photos[0]
        : null);
    const thumbnailUrl = resolveThumbnailUrl(thumbnailAsset);

    const canViewPin = typeof onPinView === "function";
    const isBookmarked =
      mergedPin?.viewerHasBookmarked === true
        ? true
        : pinId
        ? bookmarkedPinIds.has(pinId)
        : false;
    const markerIcon = resolvePinIcon(pin);
    const markerZIndex = pin?.isSelf
      ? 1200
      : pin._id && pin._id === selectedPinId
      ? 1100
      : 1000;

    const handleViewPin = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (canViewPin) {
        onPinView(pin);
      }
    };

    return (
      <Marker
        key={pinId}
        position={[latitude, longitude]}
        icon={markerIcon}
        zIndexOffset={markerZIndex}
        eventHandlers={
          onPinSelect
            ? {
                click: () => onPinSelect(pin),
              }
            : undefined
        }
      >
        <Popup
          className="map-pin-popup"
          offset={[0, -4]}
          keepInView
          closeOnClick={false}
          autoClose={false}
          eventHandlers={{
            popupopen: (event) => {
              const el = event?.popup?.getElement?.();
              if (el) {
                L.DomEvent.disableClickPropagation(el);
                L.DomEvent.disableScrollPropagation(el);
              }
            }
          }}
        >
          <div className="map-popup-card-wrapper">
            <PinPreviewCard
              pin={{
                ...pin,
                photos: pin?.photos || (thumbnailUrl ? [{ url: thumbnailUrl }] : undefined)
              }}
              viewerOwnsPin={Boolean(pin?.viewerOwnsPin || pin?.viewerIsCreator)}
              viewerIsAttending={Boolean(pin?.viewerIsAttending)}
              bookmarkPending={false}
              distanceMiles={pin?.distanceMiles}
              coordinateLabel={pin?.coordinateLabel}
              proximityRadiusMeters={pin?.proximityRadiusMeters}
              createdAt={pin?.createdAt}
              updatedAt={pin?.updatedAt}
              onView={handleViewPin}
              onBookmark={onPinBookmark || handleToggleBookmark}
              onFlag={handleFlagPin}
              onCreatorClick={
                typeof onPinAuthorView === 'function' ? (p) => onPinAuthorView(p) : undefined
              }
              isBookmarked={isBookmarked}
              className="pin-preview-card--map"
            />
          </div>
        </Popup>
      </Marker>
    );
  },
  [bookmarkedPinIds, handleFlagPin, handleToggleBookmark, onPinAuthorView, onPinBookmark, onPinSelect, onPinView, pinCache, resolvePinId, selectedPinId, userMarkerPosition]
);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        key={mapInstanceKey}
        center={resolvedCenter}
        zoom={13}
        scrollWheelZoom={scrollWheelZoom}
        style={{ width: '100%', height: '100%' }}
        whenCreated={(map) => {
          mapRef.current = map;
          setMapReady(true);
          window.setTimeout(() => {
            try {
              map.invalidateSize();
            } catch {
              // ignore
            }
          }, 0);
        }}
      >
        <TileLayer
          ref={tileLayerRef}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: handleTileError
          }}
        />
        {mapReady ? (
          <>
        {showRecenterControl ? (
          <RecenterControl
            onRecenter={(mapInstance) => {
              if (Array.isArray(resolvedCenter) && resolvedCenter.length === 2) {
                const [lat, lng] = resolvedCenter;
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  mapInstance.setView([lat, lng], mapInstance.getZoom(), { animate: true });
                }
              }
            }}
          />
        ) : null}
      
      {userMarkerPosition && (
        <Marker
          position={userMarkerPosition}
          icon={userIcon}
          zIndexOffset={200}
          opacity={Math.max(0.35, Math.min(1, (mapZoom - 7) / 5))}
          interactive={false}
        />
      )}
      {showInteractionRadius &&
        userMarkerPosition &&
        Number.isFinite(userRadiusMeters) &&
        userRadiusMeters > 0 && (
        <Circle
          center={userMarkerPosition}
          radius={userRadiusMeters}
          pathOptions={{ color: '#2196f3', fillColor: '#2196f3', fillOpacity: 0.15, weight: 1.5 }}
        />
      )}

      {nearbyUsers.map((user, index) => {
        const coordsArray = user?.coordinates?.coordinates || user?.location?.coordinates;
        if (!Array.isArray(coordsArray) || coordsArray.length < 2) {
          return null;
        }
        const [lon, lat] = coordsArray;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }
        return (
          <Marker key={index} position={[lat, lon]} icon={nearbyIcon}>
            <Popup>
              <h3>User {user.userId ?? index + 1}</h3>
            </Popup>
          </Marker>
        );
      })}

      {safeChatPins.map((pin, index) => {
        const coordinates = pin?.coordinates?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          return null;
        }
        const [longitude, latitude] = coordinates;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }
        const key = pin._id ?? `chat-${index}-${latitude}-${longitude}`;
        const canViewChatRoom = typeof onChatRoomView === 'function';
        const handleViewChatRoom = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (canViewChatRoom) {
            onChatRoomView(pin);
          }
        };
        const popupContent = renderPinPopup(pin, null, null, false, canViewChatRoom, handleViewChatRoom);
        let color = '#ff7043';
        if (pin.chatRoomCategory === 'mine') {
          color = '#3EB8F0';
        } else if (pin.type === 'global-chat-room') {
          color = '#ffb300';
        }
        const isSelected = pin._id && pin._id === selectedPinId;
        const radius = isSelected ? 12 : 8;

        return (
          <Fragment key={key}>
            {Number.isFinite(pin.proximityRadiusMeters) && pin.proximityRadiusMeters > 0 ? (
              <Circle
                center={[latitude, longitude]}
                radius={pin.proximityRadiusMeters}
                pathOptions={{ color, weight: isSelected ? 2 : 1.2, dashArray: '6 6', fillColor: color, fillOpacity: 0.08 }}
              />
            ) : null}
            <CircleMarker
              center={[latitude, longitude]}
              radius={radius}
              pathOptions={{
                color,
                weight: isSelected ? 3 : 2,
                fillColor: color,
                fillOpacity: 0.85
              }}
              eventHandlers={
                onPinSelect || canViewChatRoom
                  ? {
                      click: () => {
                        if (onPinSelect) {
                          onPinSelect(pin);
                        }
                        if (canViewChatRoom && !onPinSelect) {
                          onChatRoomView(pin);
                        }
                      }
                    }
                  : undefined
              }
            >
            {isSelected && (
            <PinCardOverlay position={[latitude, longitude]}>
              <div style={{ width: "300px" }}>
                <PinPreviewCard
                  pin={pin}
                  distanceMiles={pin?.distanceMiles}
                  coordinateLabel={pin?.coordinateLabel}
                  proximityRadiusMeters={pin?.proximityRadiusMeters}
                  createdAt={pin?.createdAt}
                  updatedAt={pin?.updatedAt}
                  onViewPin={() => onPinView(pin)}
                />
              </div>
            </PinCardOverlay>
            )}
            </CircleMarker>
          </Fragment>
        );
      })}

      {clusterPins ? (
        <ClusterLayer pins={safeClusterablePins} enabled={clusterPins} renderPin={renderRegularPin} />
      ) : (
        safeClusterablePins.map((pin) => renderRegularPin(pin))
      )}

      <MapUpdater center={resolvedCenter} />
      <ZoomWatcher onZoomChange={setMapZoom} />
      <ResizeHandler signature={resizeSignature} />
      {teleportEnabled && typeof onTeleportRequest === 'function' ? (
        <TeleportClickHandler enabled={teleportEnabled} onTeleport={onTeleportRequest} />
      ) : null}
          </>
        ) : null}
      </MapContainer>
      {tilesUnavailable ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(9, 13, 20, 0.85)',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '16px',
            textAlign: 'center'
          }}
        >
          <strong style={{ fontSize: '1.1rem' }}>Map tiles unavailable</strong>
          <span style={{ maxWidth: 360 }}>
            {isOffline
              ? 'You appear to be offline. Reconnect to reload the map tiles.'
              : 'We could not load map tiles right now. Check your connection or try again.'}
          </span>
          {!isOffline ? (
            <button
              type="button"
              onClick={handleRetryTiles}
              style={{
                border: 'none',
                backgroundColor: '#90caf9',
                color: '#0b0f16',
                fontWeight: 600,
                padding: '8px 18px',
                borderRadius: '999px',
                cursor: 'pointer'
              }}
            >
              Retry tiles
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default Map;
