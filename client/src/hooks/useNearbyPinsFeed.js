import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchPinsNearby, fetchPinById } from '../api/mongoDataApi';
import resolveAssetUrl from '../utils/media';
import toIdString from '../utils/ids';
import { METERS_PER_MILE } from '../utils/geo';
import { resolveAuthorName } from '../utils/feed';
const DEFAULT_RADIUS_MILES = 10;
const PIN_FETCH_LIMIT = 50;
const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };
const DESCRIPTION_PREVIEW_LIMIT = 250;

const hasValidCoordinates = (coords) =>
  coords &&
  typeof coords === 'object' &&
  Number.isFinite(coords.latitude) &&
  Number.isFinite(coords.longitude);

const toDistanceMiles = (meters) => {
  if (typeof meters !== 'number' || Number.isNaN(meters)) {
    return null;
  }
  return meters / METERS_PER_MILE;
};

const formatDistanceLabel = (distanceMiles) => {
  if (!Number.isFinite(distanceMiles)) {
    return null;
  }
  if (distanceMiles < 0.1) {
    return '<0.1 mi';
  }
  if (distanceMiles < 10) {
    return `${distanceMiles.toFixed(1)} mi`;
  }
  return `${Math.round(distanceMiles)} mi`;
};

const resolveReferenceDate = (pin) => {
  if (pin?.type === 'event') {
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
    return 'Expired';
  }
  if (hoursUntil < 1) {
    return 'In <1 hour';
  }
  if (hoursUntil < 24) {
    const roundedHours = Math.max(1, Math.round(hoursUntil));
    return `In ${roundedHours} hour${roundedHours === 1 ? '' : 's'}`;
  }
  const days = Math.max(1, Math.round(hoursUntil / 24));
  return `In ${days} day${days === 1 ? '' : 's'}`;
};

const resolveDescription = (pin) => {
  if (typeof pin?.description === 'string' && pin.description.trim().length > 0) {
    return pin.description.trim();
  }
  if (typeof pin?.text === 'string' && pin.text.trim().length > 0) {
    return pin.text.trim();
  }
  return null;
};

const truncateText = (value, limit = DESCRIPTION_PREVIEW_LIMIT) => {
  if (typeof value !== 'string') {
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

const normalizeMediaEntry = (asset) => {
  const resolved = resolveAssetUrl(asset, null);
  if (typeof resolved === 'string') {
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
    typeof pin?.title === 'string' && pin.title.trim().length > 0
      ? pin.title.trim()
      : null;
  const text = truncateText(description) ?? title ?? 'Untitled pin';
  const images = resolveImageSources(pin);
  const comments =
    typeof pin?.replyCount === 'number'
      ? pin.replyCount
      : typeof pin?.stats?.replyCount === 'number'
      ? pin.stats.replyCount
      : 0;
  const participantCount =
    typeof pin?.stats?.participantCount === 'number'
      ? pin.stats.participantCount
      : Array.isArray(pin?.participants)
      ? pin.participants.length
      : typeof pin?.participantCount === 'number'
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
  const attendeeVersion = attendeeIds.length > 0 ? attendeeIds.join('|') : null;

  const type = pin?.type === 'event' ? 'pin' : 'discussion';
  const tagSource = Array.isArray(pin?.tags) && pin.tags.length > 0 ? pin.tags[0] : null;

  return {
    id: pinId ?? pin?._id ?? pin?.id ?? null,
    _id: pinId ?? pin?._id ?? pin?.id ?? null,
    pinId,
    type,
    tag: tagSource || (type === 'pin' ? 'Event' : 'Discussion'),
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
    expiresInHours: hoursUntil
  };
};

export default function useNearbyPinsFeed({
  sharedLocation,
  isOffline,
  distanceMiles = DEFAULT_RADIUS_MILES,
  limit = PIN_FETCH_LIMIT
}) {
  const sharedLatitude = sharedLocation?.latitude ?? null;
  const sharedLongitude = sharedLocation?.longitude ?? null;

  const hasSharedLocation = hasValidCoordinates(sharedLocation);
  const initialLocation = hasSharedLocation
    ? { latitude: sharedLatitude, longitude: sharedLongitude }
    : FALLBACK_LOCATION;

  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(initialLocation);
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(!hasSharedLocation);
  const [locationNotice, setLocationNotice] = useState(
    hasSharedLocation ? null : 'Showing popular pins near Long Beach until you share your location.'
  );

  useEffect(() => {
    if (hasValidCoordinates(sharedLocation)) {
      setUserLocation((previous) => {
        if (
          previous &&
          Math.abs(previous.latitude - sharedLocation.latitude) < 1e-9 &&
          Math.abs(previous.longitude - sharedLocation.longitude) < 1e-9
        ) {
          return previous;
        }
        return {
          latitude: sharedLocation.latitude,
          longitude: sharedLocation.longitude
        };
      });
      setIsUsingFallbackLocation(false);
      setLocationNotice(null);
      return;
    }

    setIsUsingFallbackLocation(true);
    setLocationNotice('Showing popular pins near Long Beach until you share your location.');
    setUserLocation((previous) => {
      if (hasValidCoordinates(previous)) {
        return previous;
      }
      return FALLBACK_LOCATION;
    });
  }, [sharedLocation]);

  const loadPins = useCallback(
    async (overrideLocation) => {
      const targetLocation = overrideLocation ?? userLocation;
      if (!hasValidCoordinates(targetLocation)) {
        return;
      }

      if (isOffline) {
        setLoading(false);
        setError((prev) => prev ?? 'Offline mode: showing previously loaded pins.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await fetchPinsNearby({
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude,
          distanceMiles,
          limit
        });

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
              if (!detail || typeof detail !== 'object') {
                return pin;
              }
              return {
                ...detail,
                distanceMeters: pin.distanceMeters ?? detail.distanceMeters,
                startDate: detail.startDate ?? pin.startDate,
                endDate: detail.endDate ?? pin.endDate,
                expiresAt: detail.expiresAt ?? pin.expiresAt,
                type: detail.type ?? pin.type
              };
            } catch (detailError) {
              console.error('Failed to load full pin details:', detailError);
              return pin;
            }
          })
        );

        setPins(detailResults);
      } catch (err) {
        setPins([]);
        setError(err?.message || 'Failed to load nearby pins.');
      } finally {
        setLoading(false);
      }
    },
    [distanceMiles, isOffline, limit, userLocation]
  );

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const feedItems = useMemo(() => pins.map((pin) => mapPinToFeedItem(pin)), [pins]);

  return {
    feedItems,
    pins,
    loading,
    error,
    locationNotice,
    isUsingFallbackLocation,
    refresh: loadPins
  };
}
