import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./ListPage.css";
import Navbar from "../components/Navbar";
import SortToggle from "../components/SortToggle";
import settingsIcon from "../assets/GearIcon.svg";
import addIcon from "../assets/AddIcon.svg";
import updatesIcon from "../assets/UpdateIcon.svg";
import Feed from "../components/Feed";
import GlobalNavMenu from "../components/GlobalNavMenu";
import { fetchPinsNearby, fetchPinById } from "../api/mongoDataApi";
import PlaceIcon from '@mui/icons-material/Place'; // TODO: used only for Icon on pageConfig, maybe change with a list icon?
import { useUpdates } from "../contexts/UpdatesContext";
import runtimeConfig from "../config/runtime";
import { routes } from "../routes";
import { useNetworkStatusContext } from "../contexts/NetworkStatusContext";

export const pageConfig = {
  id: "list",
  label: "List",
  icon: PlaceIcon,
  path: "/list",
  order: 4,
  showInNav: true,
  protected: true,
};

const METERS_PER_MILE = 1609.34;
const DEFAULT_RADIUS_MILES = 10;
const PIN_FETCH_LIMIT = 50;
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };
const DESCRIPTION_PREVIEW_LIMIT = 250;
const API_BASE_URL = (runtimeConfig?.apiBaseUrl ?? "").replace(/\/$/, "");

const toIdString = (value) => {
  if (!value && value !== 0) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "object") {
    if (typeof value.$oid === "string") {
      const trimmed = value.$oid.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value._id === "string") {
      const trimmed = value._id.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value.id === "string") {
      const trimmed = value.id.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value.toString === "function") {
      const stringValue = value.toString();
      if (stringValue && stringValue !== "[object Object]") {
        return stringValue;
      }
    }
  }
  return null;
};

const hasValidCoordinates = (coords) =>
  coords &&
  typeof coords === "object" &&
  Number.isFinite(coords.latitude) &&
  Number.isFinite(coords.longitude);

const toDistanceMiles = (meters) => {
  if (typeof meters !== "number" || Number.isNaN(meters)) {
    return null;
  }
  return meters / METERS_PER_MILE;
};

const formatDistanceLabel = (distanceMiles) => {
  if (!Number.isFinite(distanceMiles)) {
    return null;
  }
  if (distanceMiles < 0.1) {
    return "<0.1 mi";
  }
  if (distanceMiles < 10) {
    return `${distanceMiles.toFixed(1)} mi`;
  }
  return `${Math.round(distanceMiles)} mi`;
};

const resolveReferenceDate = (pin) => {
  if (pin?.type === "event") {
    const start = pin?.startDate ? new Date(pin.startDate) : null;
    if (start && start.getTime() > Date.now()) {
      return start;
    }
    return pin?.endDate ? new Date(pin.endDate) : start;
  }
  if (pin?.expiresAt) {
    return new Date(pin.expiresAt);
  }
  return pin?.endDate ? new Date(pin.endDate) : null;
};

const computeHoursUntil = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return (date.getTime() - Date.now()) / (1000 * 60 * 60);
};

const formatTimeLabel = (hoursUntil) => {
  if (hoursUntil === null) {
    return null;
  }
  if (hoursUntil <= 0) {
    return "Expired";
  }
  if (hoursUntil < 1) {
    return "In <1 hour";
  }
  if (hoursUntil < 24) {
    const roundedHours = Math.max(1, Math.round(hoursUntil));
    return `In ${roundedHours} hour${roundedHours === 1 ? "" : "s"}`;
  }
  const days = Math.max(1, Math.round(hoursUntil / 24));
  return `In ${days} day${days === 1 ? "" : "s"}`;
};

const resolveAuthorName = (pin) =>
  pin?.creator?.displayName || pin?.creator?.username || "Unknown";

const resolveDescription = (pin) => {
  if (typeof pin?.description === "string" && pin.description.trim().length > 0) {
    return pin.description.trim();
  }
  if (typeof pin?.text === "string" && pin.text.trim().length > 0) {
    return pin.text.trim();
  }
  return null;
};

const truncateText = (value, limit = DESCRIPTION_PREVIEW_LIMIT) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= limit) {
    return trimmed;
  }
  const truncated = trimmed.slice(0, limit - 1).trimEnd();
  return `${truncated}…`;
};

const resolveAssetUrl = (asset, fallback = null) => {
  if (!asset) {
    return fallback;
  }
  if (typeof asset === "object") {
    return (
      resolveAssetUrl(asset.thumbnailUrl, fallback) ||
      resolveAssetUrl(asset.url, fallback) ||
      resolveAssetUrl(asset.previewUrl, fallback) ||
      resolveAssetUrl(asset.path, fallback) ||
      fallback
    );
  }
  if (typeof asset === "string") {
    const trimmed = asset.trim();
    if (!trimmed) {
      return fallback;
    }
    if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
      return trimmed;
    }
    const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
  }
  return fallback;
};

const normalizeMediaEntry = (asset) => {
  const resolved = resolveAssetUrl(asset, null);
  if (typeof resolved === "string") {
    const trimmed = resolved.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const resolveImageSources = (pin) => {
  const result = [];

  const coverPhoto = normalizeMediaEntry(pin?.coverPhoto);
  if (coverPhoto) {
    result.push(coverPhoto);
  }

  const candidates = [pin?.photos, pin?.images, pin?.mediaAssets];
  for (const collection of candidates) {
    if (Array.isArray(collection) && collection.length > 0) {
      for (const entry of collection) {
        const normalized = normalizeMediaEntry(entry);
        if (normalized && !result.includes(normalized)) {
          result.push(normalized);
        }
      }
    }
  }

  return result;
};

const mapPinToFeedItem = (pin) => {
  const pinId = toIdString(pin?._id) ?? toIdString(pin?.id);
  const creatorId =
    toIdString(pin?.creatorId) ??
    toIdString(pin?.creator?._id) ??
    toIdString(pin?.creator?._id?.$oid);

  const distanceMiles = toDistanceMiles(pin?.distanceMeters);
  const distanceLabel = formatDistanceLabel(distanceMiles);
  const referenceDate = resolveReferenceDate(pin);
  const hoursUntil = computeHoursUntil(referenceDate);
  const timeLabel = formatTimeLabel(hoursUntil);
  const description = resolveDescription(pin);
  const title =
    typeof pin?.title === "string" && pin.title.trim().length > 0
      ? pin.title.trim()
      : null;
  const text = truncateText(description) ?? title ?? "Untitled pin";
  const images = resolveImageSources(pin);
  const comments =
    typeof pin?.replyCount === "number"
      ? pin.replyCount
      : typeof pin?.stats?.replyCount === "number"
      ? pin.stats.replyCount
      : 0;
  const participantCount =
    typeof pin?.stats?.participantCount === "number"
      ? pin.stats.participantCount
      : Array.isArray(pin?.participants)
      ? pin.participants.length
      : typeof pin?.participantCount === "number"
      ? pin.participantCount
      : null;

  const attendeeIds = [];
  if (Array.isArray(pin?.attendingUserIds) && pin.attendingUserIds.length > 0) {
    for (const value of pin.attendingUserIds) {
      const normalized = toIdString(value);
      if (normalized && !attendeeIds.includes(normalized)) {
        attendeeIds.push(normalized);
      }
    }
  }
  const attendeeVersion = attendeeIds.length > 0 ? attendeeIds.join("|") : null;

  const type = pin?.type === "event" ? "pin" : "discussion";
  const tagSource = Array.isArray(pin?.tags) && pin.tags.length > 0 ? pin.tags[0] : null;

  return {
    id: pinId ?? pin?._id ?? pin?.id ?? null,
    _id: pinId ?? pin?._id ?? pin?.id ?? null,
    pinId,
    type,
    tag: tagSource || (type === "pin" ? "Event" : "Discussion"),
    distance: distanceLabel,
    timeLabel,
    text,
    title,
    images,
    author: resolveAuthorName(pin),
    authorName: resolveAuthorName(pin),
    creatorId,
    authorId: creatorId,
    creator: pin?.creator,
    comments,
    interested: [],
    participantCount,
    attendeeIds,
    attendeeVersion,
    distanceMiles,
    expiresInHours: hoursUntil,
  };
};

export default function ListPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const [sortByExpiration, setSortByExpiration] = useState(false);
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const useFallbackLocation = (message) => {
      if (cancelled) return;
      setIsUsingFallbackLocation(true);
      setLocationNotice(message);
      setUserLocation(FALLBACK_LOCATION);
    };

    if (!("geolocation" in navigator)) {
      useFallbackLocation("Using Long Beach area as location!!!");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const { latitude, longitude } = position.coords;
        setIsUsingFallbackLocation(false);
        setLocationNotice(null);
        setUserLocation({ latitude, longitude });
      },
      (geolocationError) => {
        let message = "We could not access your location. Showing default Long Beach area.";
        if (geolocationError) {
          switch (geolocationError.code) {
            case 1:
              message = "Location permission denied. Showing default Long Beach area.";
              break;
            case 2:
              message = "Device location unavailable. Showing default Long Beach area.";
              break;
            case 3:
              message = "Timed out retrieving location. Showing default Long Beach area.";
              break;
            default:
              break;
          }
        }
        useFallbackLocation(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasValidCoordinates(userLocation)) {
      return;
    }

    if (isOffline) {
      setLoading(false);
      setError((prev) => prev ?? "Offline mode: showing previously loaded pins.");
      return;
    }

    let cancelled = false;

    const loadPins = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await fetchPinsNearby({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          distanceMiles: DEFAULT_RADIUS_MILES,
          limit: PIN_FETCH_LIMIT,
        });
        if (cancelled) {
          return;
        }

        if (!Array.isArray(results) || results.length === 0) {
          setPins([]);
          return;
        }

        const detailResults = await Promise.all(
          results.map(async (pin) => {
            if (!pin?._id) {
              return pin;
            }
            try {
              const detail = await fetchPinById(pin._id);
              if (!detail || typeof detail !== "object") {
                return pin;
              }
              return {
                ...detail,
                distanceMeters: pin.distanceMeters ?? detail.distanceMeters,
                startDate: detail.startDate ?? pin.startDate,
                endDate: detail.endDate ?? pin.endDate,
                expiresAt: detail.expiresAt ?? pin.expiresAt,
                type: detail.type ?? pin.type,
              };
            } catch (detailError) {
              console.error("Failed to load full pin details:", detailError);
              return pin;
            }
          })
        );

        setPins(detailResults);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load nearby pins.");
          setPins([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPins();

    return () => {
      cancelled = true;
    };
  }, [isOffline, userLocation]);

  const { unreadCount, refreshUnreadCount } = useUpdates();

  useEffect(() => {
    if (typeof refreshUnreadCount === 'function' && !isOffline) {
      refreshUnreadCount({ silent: true });
    }
  }, [isOffline, refreshUnreadCount]);
  //const [sortByExpiration, setSortByExpiration] = useState(false); // false = distance, true = expiration
  const handleSortToggle = useCallback(() => {
    setSortByExpiration((prev) => !prev);
  }, []);
  const handleNotifications = useCallback(() => {
    if (isOffline) {
      return;
    }
    navigate(routes.updates.base);
  }, [isOffline, navigate]);
  const handleCreatePin = useCallback(() => {
    if (isOffline) {
      return;
    }
    navigate(routes.createPin.base);
  }, [isOffline, navigate]);
  const handleSettings = useCallback(() => {
    if (isOffline) {
      return;
    }
    navigate(routes.settings.base);
  }, [isOffline, navigate]);
  const handleFeedItemSelect = useCallback(
    (pinId) => {
      const normalized = toIdString(pinId);
      if (!normalized) {
        return;
      }
      navigate(routes.pin.byId(normalized));
    },
    [navigate]
  );
  const handleFeedAuthorSelect = useCallback(
    (creatorId) => {
      const normalized = toIdString(creatorId);
      if (!normalized) {
        return;
      }
      navigate(routes.profile.byId(normalized));
    },
    [navigate]
  );

  const feedItems = useMemo(() => pins.map((pin) => mapPinToFeedItem(pin)), [pins]);

  const filteredAndSortedFeed = useMemo(() => {
    const activeItems = feedItems.filter((item) => {
      if (item.expiresInHours === null) {
        return true;
      }
      return item.expiresInHours > 0;
    });

    const sortedItems = [...activeItems].sort((a, b) => {
      if (sortByExpiration) {
        const hoursA = Number.isFinite(a.expiresInHours) ? a.expiresInHours : Number.POSITIVE_INFINITY;
        const hoursB = Number.isFinite(b.expiresInHours) ? b.expiresInHours : Number.POSITIVE_INFINITY;
        if (hoursA !== hoursB) {
          return hoursA - hoursB;
        }
      } else {
        const distanceA = Number.isFinite(a.distanceMiles) ? a.distanceMiles : Number.POSITIVE_INFINITY;
        const distanceB = Number.isFinite(b.distanceMiles) ? b.distanceMiles : Number.POSITIVE_INFINITY;
        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }
      }

      const textA = a.text || "";
      const textB = b.text || "";
      return textA.localeCompare(textB);
    });

    return sortedItems;
  }, [feedItems, sortByExpiration]);

  const notificationsLabel =
    unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications';
  const displayBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null;

  return (
    <div className="list-page">
      <div className="list-frame">
        {/* Header */}
        <header className="header-bar">
          <GlobalNavMenu />
          <h1 className="header-title">List</h1>
          <button
            className="header-icon-btn"
            type="button"
            aria-label={notificationsLabel}
            onClick={handleNotifications}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to view updates' : undefined}
          >
            <img src={updatesIcon} alt="" className="header-icon" aria-hidden="true" />
            {displayBadge ? (
              <span className="header-icon-badge" aria-hidden="true">
                {displayBadge}
              </span>
            ) : null}
          </button>
        </header>

        {/* Topbar */}
        <div className="topbar">
          <div className="top-left">
            <button
              className="icon-btn"
              type="button"
              aria-label="Settings"
              onClick={handleSettings}
              disabled={isOffline}
              title={isOffline ? 'Settings unavailable offline' : undefined}
            >
              <img src={settingsIcon} alt="Settings" />
            </button>

            {/* Sort Toggle */}
            <SortToggle sortByExpiration={sortByExpiration} onToggle={handleSortToggle} />
          </div>

          <button
            className="add-btn"
            type="button"
            aria-label="Create pin"
            onClick={handleCreatePin}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to create a pin' : undefined}
          >
            <img src={addIcon} alt="Add" />
          </button>
        </div>

        {loading && <p>Loading...</p>}
        {locationNotice && !loading && <p>{locationNotice}</p>}
        {error && <p>Error: {error}</p>}

        {!loading && !error && (
          <Feed
            items={filteredAndSortedFeed}
            isUsingFallbackLocation={isUsingFallbackLocation}
            onSelectItem={handleFeedItemSelect}
            onSelectAuthor={handleFeedAuthorSelect}
          />
        )}

        <Navbar />
      </div>
    </div>
  );
}
