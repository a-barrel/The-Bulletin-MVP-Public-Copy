import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchPinById,
  fetchReplies,
  fetchPinAttendees,
  updatePinAttendance,
  createPinBookmark,
  deletePinBookmark,
  createPinReply,
  fetchCurrentUserProfile,
  sharePin
} from '../api';
import { playBadgeSound } from '../utils/badgeSound';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { logClientError } from '../utils/clientLogger';
import {
  resolveMediaAssetUrl,
  resolveUserAvatarUrl,
  formatEventRange,
  formatAddress,
  formatApproximateAddress,
  buildUserProfileLink,
  formatPinDateTime,
  DEFAULT_COVER_PATH,
  formatViewerDistanceLabel
} from '../utils/pinFormatting';
import { metersToMiles } from '../utils/geo';
import { usePinCache } from '../contexts/PinCacheContext';
import { resolveExpectedSignature } from './usePinAttendees';
import { useReplyCache } from '../contexts/ReplyCacheContext';
import { useAttendeeCache } from '../contexts/AttendeeCacheContext';
import { normalizeAttendeeRecord } from '../utils/feed';

const FUTURE_SKEW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const IS_DEV = import.meta.env.DEV;

const buildPinFetchErrorState = (error, { seedFallbackActive } = {}) => {
  if (!error) {
    return null;
  }
  const status = typeof error?.status === 'number' ? error.status : null;
  const isAuthError = status === 401 || status === 403 || Boolean(error?.isAuthError);
  const normalizedMessage =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : 'Failed to load pin details.';
  const fallbackSuffix = seedFallbackActive
    ? ' Showing cached pin details from the navigation link.'
    : '';
  return {
    message: isAuthError
      ? `Session expired. Please sign in again to refresh this pin.${fallbackSuffix}`
      : `${normalizedMessage}${fallbackSuffix}`,
    status,
    isAuthError,
    seedFallbackActive
  };
};

const normaliseTimestamp = (value) => {
  if (!value) {
    return 0;
  }
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
};

const safeTimestamp = (value) => {
  const time = normaliseTimestamp(value);
  if (!time) {
    return 0;
  }
  if (time - Date.now() > FUTURE_SKEW_MS) {
    return 0;
  }
  return time;
};

const objectIdTimestamp = (value) => {
  if (typeof value !== 'string' || value.length < 8 || !/^[a-f\\d]+$/i.test(value)) {
    return 0;
  }
  const hex = value.slice(0, 8);
  const asNumber = Number.parseInt(hex, 16);
  return Number.isFinite(asNumber) ? asNumber * 1000 : 0;
};

const resolveReplySortValue = (reply) => {
  const created = safeTimestamp(reply?.createdAt);
  if (created) {
    return created;
  }
  const updated = safeTimestamp(reply?.updatedAt);
  if (updated) {
    return updated;
  }
  return objectIdTimestamp(reply?._id);
};

const sortRepliesByDateDesc = (list) =>
  [...list].sort((a, b) => resolveReplySortValue(b) - resolveReplySortValue(a));

const parseCoordinates = (coordinates) => {
  if (!coordinates) {
    return null;
  }

  // GeoJSON array [longitude, latitude]
  if (Array.isArray(coordinates)) {
    const [lon, lat] = coordinates;
    const latitude = Number.isFinite(lat) ? lat : Number.isFinite(lon) ? lon : null;
    const longitude = Number.isFinite(lon) ? lon : Number.isFinite(lat) ? lat : null;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
    return null;
  }

  // Object with latitude/longitude or lat/lng
  const latitude =
    Number.isFinite(coordinates.latitude) ? coordinates.latitude : Number.isFinite(coordinates.lat) ? coordinates.lat : null;
  const longitude =
    Number.isFinite(coordinates.longitude)
      ? coordinates.longitude
      : Number.isFinite(coordinates.lng)
      ? coordinates.lng
      : Number.isFinite(coordinates.lon)
      ? coordinates.lon
      : Number.isFinite(coordinates.long)
      ? coordinates.long
      : null;

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  // Nested GeoJSON-style coordinates field
  if (Array.isArray(coordinates.coordinates)) {
    return parseCoordinates(coordinates.coordinates);
  }

  return null;
};

const formatCoordinateLabel = (coordinates) => {
  const parsed = parseCoordinates(coordinates);
  if (!parsed) {
    return null;
  }
  return `${parsed.latitude.toFixed(6)}, ${parsed.longitude.toFixed(6)}`;
};

const formatMetersToMiles = (meters) => {
  if (!Number.isFinite(meters)) {
    return null;
  }
  const miles = metersToMiles(meters);
  if (miles === null) {
    return null;
  }
  const formatted = miles >= 10 ? miles.toFixed(0) : miles.toFixed(1);
  return `${formatted} mi`;
};

const usePinBookmarkState = ({
  pin,
  setPin,
  pinId,
  pinExpired,
  distanceLockActive,
  isOwnPin,
  isOffline,
  announceBadgeEarned
}) => {
  const [bookmarked, setBookmarked] = useState(false);
  const [isUpdatingBookmark, setIsUpdatingBookmark] = useState(false);
  const [bookmarkError, setBookmarkError] = useState(null);
  const syncBookmarkFromPayload = useCallback(
    (value, { coerce = false } = {}) => {
      if (typeof value === 'boolean') {
        setBookmarked(value);
        return value;
      }
      if (coerce) {
        const normalized = Boolean(value);
        setBookmarked(normalized);
        return normalized;
      }
      return null;
    },
    []
  );

  const handleToggleBookmark = useCallback(async () => {
    if (isOffline) {
      setBookmarkError('Bookmarks are unavailable while offline.');
      return;
    }
    if (isOwnPin && bookmarked) {
      setBookmarkError('Creators keep their pins bookmarked automatically.');
      return;
    }

    const interactionLocked =
      pinExpired || (distanceLockActive && !bookmarked && !isOwnPin);
    if (!pin || isUpdatingBookmark || interactionLocked) {
      if (pinExpired) {
        setBookmarkError('Expired pins cannot be bookmarked.');
      } else if (distanceLockActive) {
        setBookmarkError('Pins outside your interaction radius cannot be bookmarked.');
      }
      return;
    }

    setIsUpdatingBookmark(true);
    setBookmarkError(null);

    try {
      if (bookmarked) {
        const response = await deletePinBookmark(pin._id);
        setPin((prev) => {
          if (!prev) {
            return prev;
          }
          const currentCount = prev.bookmarkCount ?? 0;
          const nextBookmarkCount =
            typeof response?.bookmarkCount === 'number'
              ? response.bookmarkCount
              : Math.max(0, currentCount - 1);
          const nextViewerHasBookmarked =
            typeof response?.viewerHasBookmarked === 'boolean'
              ? response.viewerHasBookmarked
              : false;
          const nextStats = prev.stats
            ? { ...prev.stats, bookmarkCount: nextBookmarkCount }
            : prev.stats;
          return {
            ...prev,
            bookmarkCount: nextBookmarkCount,
            stats: nextStats,
            viewerHasBookmarked: nextViewerHasBookmarked
          };
        });
        setBookmarked(
          typeof response?.viewerHasBookmarked === 'boolean'
            ? response.viewerHasBookmarked
            : false
        );
      } else {
        const response = await createPinBookmark(pin._id);
        setPin((prev) => {
          if (!prev) {
            return prev;
          }
          const currentCount = prev.bookmarkCount ?? 0;
          const nextBookmarkCount =
            typeof response?.bookmarkCount === 'number'
              ? response.bookmarkCount
              : currentCount + 1;
          const nextViewerHasBookmarked =
            typeof response?.viewerHasBookmarked === 'boolean'
              ? response.viewerHasBookmarked
              : true;
          const nextStats = prev.stats
            ? { ...prev.stats, bookmarkCount: nextBookmarkCount }
            : prev.stats;
          return {
            ...prev,
            bookmarkCount: nextBookmarkCount,
            stats: nextStats,
            viewerHasBookmarked: nextViewerHasBookmarked
          };
        });
        setBookmarked(
          typeof response?.viewerHasBookmarked === 'boolean'
            ? response.viewerHasBookmarked
            : true
        );
        if (response?.badgeEarnedId) {
          playBadgeSound();
          announceBadgeEarned(response.badgeEarnedId);
        }
      }
    } catch (toggleError) {
      logClientError(toggleError, {
        source: 'usePinDetails.toggleBookmark',
        pinId,
        bookmarkedTarget: !bookmarked
      });
      setBookmarkError(toggleError?.message || 'Failed to toggle bookmark.');
    } finally {
      setIsUpdatingBookmark(false);
    }
  }, [
    announceBadgeEarned,
    bookmarked,
    distanceLockActive,
    isOffline,
    isOwnPin,
    pin,
    pinExpired,
    pinId,
    isUpdatingBookmark,
    setPin
  ]);

  return {
    bookmarked,
    isUpdatingBookmark,
    bookmarkError,
    handleToggleBookmark,
    syncBookmarkFromPayload
  };
};

const usePinAttendanceState = ({
  pin,
  setPin,
  pinId,
  pinExpired,
  distanceLockActive,
  isInteractionLocked,
  isOffline,
  announceBadgeEarned,
  syncBookmarkFromPayload
}) => {
  const [attending, setAttending] = useState(false);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const syncAttendanceFromPayload = useCallback(
    (value, { coerce = false } = {}) => {
      if (typeof value === 'boolean') {
        setAttending(value);
        return value;
      }
      if (coerce) {
        const normalized = Boolean(value);
        setAttending(normalized);
        return normalized;
      }
      return null;
    },
    []
  );

  const handleToggleAttendance = useCallback(async () => {
    if (!pin || typeof pin?.type !== 'string' || pin.type.toLowerCase() !== 'event') {
      return;
    }
    if (isOffline) {
      setAttendanceError('Attendance is unavailable while offline.');
      return;
    }
    if (isUpdatingAttendance || isInteractionLocked) {
      if (pinExpired) {
        setAttendanceError('Expired events cannot be updated.');
      } else if (distanceLockActive) {
        setAttendanceError('You must move closer to attend this event.');
      }
      return;
    }

    setIsUpdatingAttendance(true);
    setAttendanceError(null);

    try {
      const response = await updatePinAttendance(pin._id, { attending: !attending });

      setPin((prev) => {
        if (!prev) {
          return prev;
        }
        const stats = prev.stats ?? {};
        const currentCount = prev.participantCount ?? stats.participantCount ?? 0;
        const delta =
          typeof response?.viewerIsAttending === 'boolean'
            ? response.viewerIsAttending
              ? 1
              : -1
            : attending
            ? -1
            : 1;
        const nextCount = Math.max(0, currentCount + delta);
        const updatedStats = {
          ...stats,
          participantCount: nextCount
        };
        return {
          ...prev,
          participantCount: nextCount,
          viewerIsAttending:
            typeof response?.viewerIsAttending === 'boolean'
              ? response.viewerIsAttending
              : !attending,
          stats: updatedStats
        };
      });

      const nextAttending =
        typeof response?.viewerIsAttending === 'boolean'
          ? response.viewerIsAttending
          : !attending;
      syncAttendanceFromPayload(nextAttending, { coerce: true });

      syncBookmarkFromPayload(response?.viewerHasBookmarked);

      if (response?.badgeEarnedId) {
        playBadgeSound();
        announceBadgeEarned(response.badgeEarnedId);
      }
    } catch (toggleError) {
      logClientError(toggleError, {
        source: 'usePinDetails.toggleAttendance',
        pinId,
        attendingTarget: !attending
      });
      setAttendanceError(toggleError?.message || 'Failed to update attendance.');
    } finally {
      setIsUpdatingAttendance(false);
    }
  }, [
    announceBadgeEarned,
    attending,
    distanceLockActive,
    isInteractionLocked,
    isOffline,
    isUpdatingAttendance,
    pin,
    pinExpired,
    pinId,
    setPin,
    syncAttendanceFromPayload,
    syncBookmarkFromPayload
  ]);

  return {
    attending,
    isUpdatingAttendance,
    attendanceError,
    handleToggleAttendance,
    syncAttendanceFromPayload
  };
};

const usePinRepliesState = ({
  pin,
  setPin,
  pinId,
  isOffline,
  pinExpired,
  distanceLockActive,
  isInteractionLocked,
  replyCache
}) => {
  const [replies, setReplies] = useState([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [repliesError, setRepliesError] = useState(null);
  const [replyComposerOpen, setReplyComposerOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [submitReplyError, setSubmitReplyError] = useState(null);

  // Auto-load replies whenever connectivity or the target pin changes.
  useEffect(() => {
    if (!pinId) {
      setReplies([]);
      return;
    }

    if (isOffline) {
      setIsLoadingReplies(false);
      setRepliesError((prev) => prev ?? 'Replies unavailable while offline.');
      return;
    }

    let ignore = false;

    async function loadReplies() {
      setIsLoadingReplies(true);
      setRepliesError(null);

      const cached = replyCache?.getReplies(pinId);
      const cachedReplies =
        cached && Array.isArray(cached.replies) ? sortRepliesByDateDesc(cached.replies) : null;
      if (cachedReplies) {
        setReplies(cachedReplies);
        setIsLoadingReplies(false);
        setRepliesError(null);
        return;
      }

      try {
        const payload = await fetchReplies(pinId);
        if (ignore) {
          return;
        }
        setReplies(Array.isArray(payload) ? sortRepliesByDateDesc(payload) : []);
        if (Array.isArray(payload) && replyCache) {
          replyCache.setReplies(pinId, payload);
        }
      } catch (loadError) {
        if (ignore) {
          return;
        }
        logClientError(loadError, { source: 'usePinDetails.loadReplies', pinId });
        setReplies([]);
        setRepliesError(loadError?.message || 'Failed to load replies.');
      } finally {
        if (!ignore) {
          setIsLoadingReplies(false);
        }
      }
    }

    loadReplies();

    return () => {
      ignore = true;
    };
  }, [isOffline, pinId]);
  const openReplyComposer = useCallback(() => {
    if (!pinId) {
      return;
    }
    if (isOffline) {
      setSubmitReplyError('Replies are unavailable while offline.');
      return;
    }
    if (pinExpired) {
      setSubmitReplyError('Replies are closed because this pin has expired.');
      return;
    }
    if (distanceLockActive) {
      setSubmitReplyError('Replies are disabled because you are outside this pin\'s interaction radius.');
      return;
    }
    setSubmitReplyError(null);
    setReplyComposerOpen(true);
  }, [distanceLockActive, isOffline, pinExpired, pinId]);

  const closeReplyComposer = useCallback(() => {
    if (isSubmittingReply) {
      return;
    }
    setReplyComposerOpen(false);
    setSubmitReplyError(null);
  }, [isSubmittingReply]);

  const handleSubmitReply = useCallback(async () => {
    if (isOffline) {
      setSubmitReplyError('Replies are unavailable while offline.');
      return;
    }
    if (!pinId || isSubmittingReply || isInteractionLocked) {
      if (pinExpired) {
        setSubmitReplyError('Replies are closed because this pin has expired.');
      } else if (distanceLockActive) {
        setSubmitReplyError('Replies are disabled because you are outside this pin\'s interaction radius.');
      }
      return;
    }
    const trimmedMessage = replyMessage.trim();
    if (!trimmedMessage) {
      setSubmitReplyError('Please enter a message before submitting.');
      return;
    }

    setIsSubmittingReply(true);
    setSubmitReplyError(null);

    try {
      const newReply = await createPinReply(pinId, { message: trimmedMessage });
      setReplies((prev) => sortRepliesByDateDesc([...prev, newReply]));
      setReplyMessage('');
      setReplyComposerOpen(false);
      if (replyCache) {
        replyCache.setReplies(pinId, [newReply, ...replies]);
      }
      setPin((prev) => {
        if (!prev) {
          return prev;
        }
        const nextStats = prev.stats
          ? { ...prev.stats, replyCount: (prev.stats.replyCount ?? 0) + 1 }
          : prev.stats;
        return {
          ...prev,
          replyCount: (prev.replyCount ?? 0) + 1,
          stats: nextStats
        };
      });
    } catch (submitError) {
      logClientError(submitError, {
        source: 'usePinDetails.submitReply',
        pinId
      });
      setSubmitReplyError(submitError?.message || 'Failed to create reply.');
    } finally {
      setIsSubmittingReply(false);
    }
  }, [
    distanceLockActive,
    isInteractionLocked,
    isOffline,
    isSubmittingReply,
    pinExpired,
    pinId,
    replyCache,
    replies,
    replyMessage,
    setPin
  ]);

  const replyCount = useMemo(
    () => replies.length || pin?.replyCount || pin?.stats?.replyCount || 0,
    [pin?.replyCount, pin?.stats?.replyCount, replies.length]
  );

  return {
    replies,
    isLoadingReplies,
    repliesError,
    replyComposerOpen,
    openReplyComposer,
    closeReplyComposer,
    replyMessage,
    setReplyMessage,
    isSubmittingReply,
    submitReplyError,
    handleSubmitReply,
    replyCount
  };
};

const extractViewerProfileIdFromState = (state) => {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const candidates = [
    state.viewerProfile?._id,
    state.currentProfile?._id,
    state.user?._id,
    state.profile?._id,
    state.creator?._id,
    state.viewerId,
    state.userId,
    state.currentProfileId
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

export default function usePinDetails({ pinId, location, isOffline, initialPin = null }) {
  const locationState = location?.state;
  const pinFromState = locationState?.pin ?? initialPin ?? null;
  const pinCache = usePinCache();
  const replyCache = useReplyCache();
  const attendeeCache = useAttendeeCache();
  const { announceBadgeEarned } = useBadgeSound();
  const [viewerProfileId, setViewerProfileId] = useState(() =>
    extractViewerProfileIdFromState(locationState)
  );
  const [pin, setPin] = useState(pinFromState);
  const initialHydrationSource = pinFromState ? 'seed' : 'none';
  const [isLoading, setIsLoading] = useState(!pinFromState);
  const [error, setError] = useState(null);
  const [attendeeOverlayOpen, setAttendeeOverlayOpen] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [shouldPrefetchAttendees, setShouldPrefetchAttendees] = useState(true);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [attendeesError, setAttendeesError] = useState(null);
  const [shareStatus, setShareStatus] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const isMountedRef = useRef(true);
  const pinHydrationSourceRef = useRef(initialHydrationSource);
  const reloadInFlightRef = useRef(false);
  const pinCacheRef = useRef(new Map());
  const analyticsInFlightRef = useRef(false);
  const updatePinHydrationSource = useCallback((source) => {
    pinHydrationSourceRef.current = source;
  }, []);

  // Track mount state so reloadPin can bail when unmounted.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [pinId]);

  useEffect(() => {
    if (pinFromState) {
      setPin(pinFromState);
      updatePinHydrationSource('seed');
      setIsLoading(false);
      if (IS_DEV) {
        console.debug('[usePinDetails] pinFromState applied', {
          pinFromStateId: pinFromState?._id ?? 'unknown'
        });
      }
      return;
    }
    if (pinHydrationSourceRef.current === 'seed') {
      updatePinHydrationSource('none');
    }
  }, [pinFromState, updatePinHydrationSource]);

  useEffect(() => {
    if (viewerProfileId) {
      return;
    }
    const candidate = extractViewerProfileIdFromState(locationState);
      if (candidate) {
        setViewerProfileId(candidate);
        if (IS_DEV) {
          console.debug('[usePinDetails] viewerProfileId from state', {
            viewerProfileId: candidate
          });
        }
      }
  }, [locationState, viewerProfileId]);

  useEffect(() => {
    if (viewerProfileId || isOffline) {
      return;
    }

    let ignore = false;

    (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (ignore) {
          return;
        }
        const normalized = profile?._id ? String(profile._id) : null;
        setViewerProfileId(normalized);
      } catch (loadError) {
        if (!ignore) {
          console.warn('Failed to load viewer profile for pin details:', loadError);
          logClientError(loadError, { source: 'usePinDetails.viewerProfile', pinId });
          setViewerProfileId(null);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [viewerProfileId, isOffline, pinId]);

  const previewMode = useMemo(() => {
    const params = new URLSearchParams(location?.search ?? '');
    return (params.get('preview') || '').toLowerCase();
  }, [location?.search]);

  const pinExpired = useMemo(() => {
    if (!pin) {
      return false;
    }
    const expiresSource = pin.expiresAt ?? pin.endDate;
    if (!expiresSource) {
      return false;
    }
    const expiry = new Date(expiresSource);
    if (Number.isNaN(expiry.getTime())) {
      return false;
    }
    return expiry.getTime() < Date.now();
  }, [pin]);

  const pinCreatorId = useMemo(() => {
    if (!pin) {
      return null;
    }
    if (typeof pin?.creatorId === 'string' && pin.creatorId.trim().length > 0) {
      return pin.creatorId.trim();
    }
    const nestedId = pin?.creator?._id;
    if (typeof nestedId === 'string' && nestedId.trim().length > 0) {
      return nestedId.trim();
    }
    return null;
  }, [pin]);

  const isOwnPin = useMemo(() => {
    if (!pinCreatorId || !viewerProfileId) {
      return false;
    }
    return pinCreatorId === viewerProfileId;
  }, [pinCreatorId, viewerProfileId]);

  const viewerWithinInteractionRadius =
    typeof pin?.viewerWithinInteractionRadius === 'boolean'
      ? pin.viewerWithinInteractionRadius
      : undefined;
  const viewerDistanceMeters =
    typeof pin?.viewerDistanceMeters === 'number' && Number.isFinite(pin.viewerDistanceMeters)
      ? pin.viewerDistanceMeters
      : null;
  const distanceLockActive =
    !pinExpired && (previewMode === 'far' || viewerWithinInteractionRadius === false);
  const viewerInteractionLockMessage = pin?.viewerInteractionLockMessage;

  const {
    bookmarked,
    isUpdatingBookmark,
    bookmarkError,
    handleToggleBookmark,
    syncBookmarkFromPayload
  } = usePinBookmarkState({
    pin,
    setPin,
    pinId,
    pinExpired,
    distanceLockActive,
    isOwnPin,
    isOffline,
    announceBadgeEarned
  });

  const isInteractionLocked =
    pinExpired || (distanceLockActive && !bookmarked && !isOwnPin);

  const {
    attending,
    isUpdatingAttendance,
    attendanceError,
    handleToggleAttendance,
    syncAttendanceFromPayload
  } = usePinAttendanceState({
    pin,
    setPin,
    pinId,
    pinExpired,
    distanceLockActive,
    isInteractionLocked,
    isOffline,
    announceBadgeEarned,
    syncBookmarkFromPayload
  });

  const {
    replies,
    isLoadingReplies,
    repliesError,
    replyComposerOpen,
    openReplyComposer,
    closeReplyComposer,
    replyMessage,
    setReplyMessage,
    isSubmittingReply,
    submitReplyError,
    handleSubmitReply,
    replyCount
  } = usePinRepliesState({
    pin,
    setPin,
    pinId,
    isOffline,
    pinExpired,
    distanceLockActive,
    isInteractionLocked,
    replyCache
  });
  // Fetch latest pin details from the API, respecting offline mode and seed hydration.
  const reloadPin = useCallback(
    async ({ silent } = {}) => {
      if (reloadInFlightRef.current) {
        return null;
      }
      if (IS_DEV) {
        console.debug('[usePinDetails] reload start', { pinId, silent });
      }
      if (!pinId) {
        if (isMountedRef.current) {
          setPin(null);
          setIsLoading(false);
          setError('Pin ID was not provided.');
        }
        return null;
      }

      if (isOffline) {
        if (isMountedRef.current) {
          if (!silent) {
            setIsLoading(false);
          }
          setError((prev) => prev ?? 'You are offline. Connect to load the latest pin details.');
        }
        return null;
      }

      const sharedCached = pinCache.getPin(pinId);
      if (sharedCached) {
        pinCacheRef.current.set(pinId, { pin: sharedCached, ts: Date.now() });
      }

      const cached = pinCacheRef.current.get(pinId);
      const hasDetails = (candidate) =>
        Boolean(
          candidate?.description ||
            candidate?.content ||
            candidate?.body ||
            candidate?.text ||
            candidate?.summary ||
            candidate?.details?.description ||
            candidate?.details?.content ||
            candidate?.details?.body ||
            candidate?.details?.text ||
            candidate?.details?.summary ||
            candidate?.details?.longDescription ||
            candidate?.pin?.description ||
            candidate?.pin?.content ||
            candidate?.pin?.body ||
            candidate?.pin?.text ||
            candidate?.pin?.summary
        ) &&
        Boolean(
          candidate?.address ||
            candidate?.approximateAddress ||
            candidate?.location?.address ||
            candidate?.location?.label ||
            candidate?.location?.name ||
            candidate?.location?.description ||
            candidate?.locationLabel ||
            candidate?.locationName ||
          candidate?.locationText ||
          candidate?.locationString ||
          candidate?.location?.addressString ||
          candidate?.addressString ||
          candidate?.address?.precise ||
          candidate?.address?.components ||
          candidate?.location?.addressString ||
          candidate?.addressString ||
          candidate?.street ||
          candidate?.street1 ||
          candidate?.street2 ||
          candidate?.city ||
          candidate?.state ||
          candidate?.stateCode ||
          candidate?.province ||
          candidate?.region ||
          candidate?.country ||
          candidate?.countryCode ||
          candidate?.neighborhood ||
          candidate?.place?.name ||
          candidate?.place?.address ||
          candidate?.place?.formattedAddress ||
          candidate?.place?.formatted_address ||
          candidate?.place?.label ||
            candidate?.place?.description ||
            candidate?.place?.vicinity ||
            candidate?.addressLabel ||
            candidate?.addressName ||
            candidate?.addressDescription ||
            candidate?.addressText ||
            candidate?.__hasDetails === true
        );
      const cacheFresh = cached && Date.now() - cached.ts < 60_000;
      if (cached && cacheFresh) {
        setPin(cached.pin);
        syncBookmarkFromPayload(cached.pin?.viewerHasBookmarked, { coerce: true });
        syncAttendanceFromPayload(cached.pin?.viewerIsAttending, { coerce: true });
        updatePinHydrationSource('cache');
        setIsLoading(false);
        setError(null);
        if (hasDetails(cached.pin)) {
          return cached.pin;
        }
      }

      reloadInFlightRef.current = true;

      if (isMountedRef.current && !silent) {
        setIsLoading(true);
      }
      if (isMountedRef.current) {
        setError(null);
      }

      try {
        const payload = await fetchPinById(pinId, { previewMode });
        if (!isMountedRef.current) {
          if (IS_DEV) {
            console.debug('[usePinDetails] reload ignored - unmounted', { pinId });
          }
          return payload;
        }
        setPin(payload);
        syncBookmarkFromPayload(payload?.viewerHasBookmarked, { coerce: true });
        syncAttendanceFromPayload(payload?.viewerIsAttending, { coerce: true });
        updatePinHydrationSource('api');
        const detailed = { ...payload, __hasDetails: true };
        pinCacheRef.current.set(pinId, { pin: detailed, ts: Date.now() });
        pinCache.upsertPin(detailed);
        if (IS_DEV) {
          console.debug('[usePinDetails] reload success', { pinId, title: payload?.title });
        }
        return payload;
      } catch (loadError) {
        if (!isMountedRef.current) {
          return null;
        }
        const seedFallbackActive = pinHydrationSourceRef.current === 'seed';
        logClientError(loadError, {
          source: 'usePinDetails.reloadPin',
          pinId,
          previewMode,
          seedFallbackActive
        });
        setError(buildPinFetchErrorState(loadError, { seedFallbackActive }));
        return null;
      } finally {
        if (isMountedRef.current && !silent) {
          setIsLoading(false);
        }
        reloadInFlightRef.current = false;
      }
    },
    [pinCache, pinId, isOffline, previewMode, setPin, syncAttendanceFromPayload, syncBookmarkFromPayload, updatePinHydrationSource]
  );

  // Rehydrate from the API whenever the seeded pin snapshot changes.
  useEffect(() => {
    reloadPin({ silent: pinHydrationSourceRef.current === 'seed' });
  }, [reloadPin, pinFromState]);

  const isEventPin = Boolean(pin && typeof pin.type === 'string' && pin.type.toLowerCase() === 'event');

  // Prefetch attendees for event pins so the overlay opens instantly.
  useEffect(() => {
    if (!pinId || !isEventPin) {
      setShouldPrefetchAttendees(false);
      setAttendees([]);
      return;
    }
    setShouldPrefetchAttendees(true);
  }, [pinId, isEventPin]);

  useEffect(() => {
    if (!isEventPin) {
      setAttendees([]);
      if (attendeeOverlayOpen) {
        setIsLoadingAttendees(false);
        setAttendeesError(null);
      }
      if (shouldPrefetchAttendees) {
        setShouldPrefetchAttendees(false);
      }
      return;
    }

    const shouldLoadAttendees = attendeeOverlayOpen || shouldPrefetchAttendees;
    if (!shouldLoadAttendees) {
      return;
    }
    if (isOffline) {
      if (attendeeOverlayOpen) {
        setIsLoadingAttendees(false);
        setAttendeesError((prev) => prev ?? 'Attendee list unavailable while offline.');
      }
      if (shouldPrefetchAttendees) {
        setShouldPrefetchAttendees(false);
      }
      return;
    }
    if (!pinId) {
      setAttendees([]);
      if (shouldPrefetchAttendees) {
        setShouldPrefetchAttendees(false);
      }
      return;
    }

    let ignore = false;

    async function loadAttendees() {
      if (attendeeOverlayOpen) {
        setIsLoadingAttendees(true);
        setAttendeesError(null);
      }

      const cached = attendeeCache.getAttendees(pinId);
      const isFresh = cached ? Date.now() - cached.ts < 60_000 : false;
      if (cached && isFresh) {
        setAttendees(Array.isArray(cached.items) ? cached.items : []);
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug('[attendees-cache] hit (pinDetails)', {
            pinId,
            count: cached.items?.length ?? 0,
            signature: cached.signature
          });
        }
        if (attendeeOverlayOpen) {
          setIsLoadingAttendees(false);
        }
        setAttendeesError(null);
        if (shouldPrefetchAttendees) {
          setShouldPrefetchAttendees(false);
        }
        return;
      }

      try {
        const payload = await fetchPinAttendees(pinId);
        if (ignore) {
          return;
        }
        const normalizedIds = [];
        const mapped = Array.isArray(payload)
          ? payload.map((record, idx) => {
              const normalized = normalizeAttendeeRecord(record, idx);
              if (normalized.userId && !normalizedIds.includes(normalized.userId)) {
                normalizedIds.push(normalized.userId);
              }
              return normalized;
            })
          : [];
        const signature = resolveExpectedSignature(normalizedIds, null);
        attendeeCache.setAttendees(pinId, {
          items: mapped,
          count: mapped.length,
          signature
        });
        setAttendees(mapped);
      } catch (loadError) {
        if (ignore) {
          return;
        }
        logClientError(loadError, { source: 'usePinDetails.loadAttendees', pinId });
        setAttendees([]);
        setAttendeesError(loadError?.message || 'Failed to load attendees.');
      } finally {
        if (!ignore && attendeeOverlayOpen) {
          setIsLoadingAttendees(false);
        }
        if (!ignore && shouldPrefetchAttendees) {
          setShouldPrefetchAttendees(false);
        }
      }
    }

    loadAttendees();

    return () => {
      ignore = true;
    };
  }, [
    attendeeCache,
    attendeeOverlayOpen,
    isEventPin,
    isOffline,
    pinId,
    shouldPrefetchAttendees
  ]);

  const viewerDistanceLabel = useMemo(
    () => formatViewerDistanceLabel(viewerDistanceMeters),
    [viewerDistanceMeters]
  );

  const interactionOverlay = useMemo(() => {
    if (pinExpired) {
      return {
        title: 'This pin has expired',
        message:
          'This activity is no longer available. Please head back to the home feed to explore current happenings.'
      };
    }

    if (distanceLockActive) {
      const defaultMessage = viewerDistanceLabel
        ? `This pin is approximately ${viewerDistanceLabel} away and sits outside your interaction radius. Move closer to engage with it.`
        : 'This pin is outside your interaction radius. Move closer to interact with it.';

      return {
        title: 'Outside interaction radius',
        message: viewerInteractionLockMessage || defaultMessage
      };
    }

    return null;
  }, [pinExpired, distanceLockActive, viewerInteractionLockMessage, viewerDistanceLabel]);

  const pinTypeHeading = useMemo(() => {
    if (!pin) {
      return 'Loading...';
    }
    const rawType = typeof pin.type === 'string' ? pin.type : '';
    const capitalized =
      rawType && rawType.length > 0 ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : 'Pin';
    const normalizedType = rawType.toLowerCase();
    if (isOwnPin && (normalizedType === 'event' || normalizedType === 'discussion')) {
      return `(Your) ${capitalized}`;
    }
    return capitalized || 'Pin';
  }, [pin, isOwnPin]);

  const mapPins = useMemo(() => {
    if (!pin) {
      return [];
    }
    const creatorAvatarUrl = resolveUserAvatarUrl(pin?.creator);
    if (pin.isSelf === isOwnPin) {
      return [{ ...pin, creatorAvatarUrl }];
    }
    return [{ ...pin, isSelf: isOwnPin, creatorAvatarUrl }];
  }, [pin, isOwnPin]);

  const coverImageUrl = useMemo(() => {
    if (!pin?.coverPhoto) {
      return null;
    }
    return resolveMediaAssetUrl(pin.coverPhoto, DEFAULT_COVER_PATH);
  }, [pin]);

  const photoItems = useMemo(() => {
    if (!pin) {
      return [];
    }
    const items = [];
    const seen = new Set();

    const pushPhoto = (asset, { fallbackLabel } = {}) => {
      const url = resolveMediaAssetUrl(asset);
      if (!url || seen.has(url)) {
        return;
      }
      seen.add(url);
      const label =
        (asset && typeof asset === 'object' && (asset.description || asset.label)) || fallbackLabel;
      items.push({
        url,
        label: label || null
      });
    };

    if (pin.coverPhoto) {
      pushPhoto(pin.coverPhoto);
    }

    if (Array.isArray(pin.photos)) {
      pin.photos.forEach((photo, index) => pushPhoto(photo, { fallbackLabel: `Photo ${index + 1}` }));
    }

    return items;
  }, [pin]);

  const coordinates = useMemo(
    () => parseCoordinates(pin?.coordinates ?? pin?.location?.coordinates),
    [pin]
  );
  const coordinateLabel = useMemo(
    () => formatCoordinateLabel(pin?.coordinates ?? pin?.location?.coordinates),
    [pin]
  );
  const proximityRadius = useMemo(
    () => formatMetersToMiles(pin?.proximityRadiusMeters),
    [pin]
  );
  const addressLabel = useMemo(() => {
    const candidates = [
      formatAddress(pin?.address),
      formatAddress(pin?.location?.address),
      pin?.location?.label,
      pin?.location?.name,
      pin?.location?.description,
      pin?.locationLabel,
      pin?.locationName,
      pin?.locationText,
      pin?.locationString,
      pin?.location?.addressString,
      pin?.address?.precise,
      formatAddress(pin?.address?.components),
      formatAddress(pin?.addressString),
      pin?.location?.addressString,
      pin?.addressString,
      pin?.street,
      pin?.street1,
      pin?.street2,
      pin?.city,
      pin?.state,
      pin?.stateCode,
      pin?.province,
      pin?.region,
      pin?.country,
      pin?.countryCode,
      pin?.neighborhood,
      pin?.addressLabel,
      pin?.addressName,
      pin?.addressDescription,
      pin?.addressText,
      pin?.place?.formattedAddress,
      pin?.place?.formatted_address,
      pin?.place?.label,
      pin?.place?.name,
      pin?.place?.description,
      pin?.place?.vicinity,
      pin?.place?.address
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    const approx = formatApproximateAddress(pin?.approximateAddress);
    if (approx) return approx;

    return null;
  }, [pin]);
  const approximateAddressLabel = useMemo(() => formatApproximateAddress(pin?.approximateAddress), [pin]);
  const eventDateRange = useMemo(
    () => formatEventRange(pin?.startDate, pin?.endDate),
    [pin]
  );
  const expirationLabel = useMemo(() => formatPinDateTime(pin?.expiresAt ?? pin?.endDate), [pin]);
  const createdAtLabel = useMemo(() => formatPinDateTime(pin?.createdAt), [pin]);
  const updatedAtLabel = useMemo(() => formatPinDateTime(pin?.updatedAt), [pin]);

  const profileReturnPath = useMemo(
    () => `${location?.pathname ?? ''}${location?.search ?? ''}${location?.hash ?? ''}`,
    [location?.hash, location?.pathname, location?.search]
  );
  const creatorProfileLink = useMemo(
    () => {
      const link = buildUserProfileLink(pin?.creator, profileReturnPath);
      if (!link) {
        return null;
      }
      if (typeof link === 'string') {
        return { pathname: link };
      }
      return link;
    },
    [pin, profileReturnPath]
  );
  const creatorAvatarUrl = useMemo(
    () => resolveUserAvatarUrl(pin?.creator),
    [pin]
  );

  const openAttendeeOverlay = useCallback(() => {
    if (!pin || typeof pin?.type !== 'string' || pin.type.toLowerCase() !== 'event') {
      return;
    }
    if (isOffline) {
      setAttendeesError('You are offline. Connect to view attendees.');
      return;
    }
    if (pinExpired) {
      setAttendeesError('This pin has expired.');
      return;
    }
    if (distanceLockActive) {
      setAttendeesError('You are outside this pin\'s interaction radius.');
      return;
    }
    setAttendeesError(null);
    setAttendeeOverlayOpen(true);
  }, [distanceLockActive, isOffline, pin, pinExpired]);

  const closeAttendeeOverlay = useCallback(() => {
    setAttendeeOverlayOpen(false);
  }, []);

  const handleSharePin = useCallback(
    async (options = {}) => {
      if (!pinId) {
        return;
      }

      const sharePath = `/pin/${encodeURIComponent(pinId)}`;
      const shareUrl =
        typeof window !== 'undefined' && window.location
          ? new URL(sharePath, window.location.origin).toString()
          : sharePath;

      setIsSharing(true);
      setShareStatus(null);

      let recorded = false;
      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({
            title: pin?.title || 'Check out this pin',
            text: pin?.description ? pin.description.slice(0, 120) : undefined,
            url: shareUrl
          });
          recorded = true;
          setShareStatus({ type: 'success', message: 'Share dialog opened.' });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          recorded = true;
          setShareStatus({ type: 'success', message: 'Link copied to clipboard.' });
        } else {
          recorded = true;
          setShareStatus({
            type: 'info',
            message: `Share link: ${shareUrl}`
          });
        }

        if (recorded) {
          await sharePin(pinId, {
            platform:
              options.platform || (typeof navigator !== 'undefined' && navigator.share ? 'web-share' : 'manual'),
            method: options.method || 'pin-details'
          });
        }
      } catch (error) {
        logClientError(error, {
          source: 'usePinDetails.sharePin',
          pinId
        });
        if (error?.name === 'AbortError') {
          setShareStatus({
            type: 'info',
            message: 'Share canceled.'
          });
        } else {
          setShareStatus({
            type: 'error',
            message: error?.message || 'Failed to share this pin.'
          });
        }
      } finally {
        setIsSharing(false);
      }
    },
    [pin?.description, pin?.title, pinId]
  );

  const replyItems = useMemo(
    () =>
      replies.map((reply) => ({
        ...reply,
        authorName: reply.author?.displayName || reply.author?.username || 'Anonymous user',
        avatarUrl: resolveUserAvatarUrl(reply.author),
        createdLabel: formatPinDateTime(reply.createdAt),
        profileLink: buildUserProfileLink(reply.author, profileReturnPath)
      })),
    [profileReturnPath, replies]
  );

  const attendeeItems = useMemo(
    () =>
      attendees.map((attendee) => {
        const name =
          attendee?.displayName ||
          attendee?.username ||
          attendee?.name ||
          attendee?.email ||
          'Unknown attendee';
        const avatar = resolveUserAvatarUrl(attendee);
        return {
          ...attendee,
          name,
          avatar,
          link: buildUserProfileLink(attendee, profileReturnPath),
          key:
            attendee?._id ||
            attendee?.id ||
            attendee?.uid ||
            attendee?.username ||
            attendee?.email ||
            name
        };
      }),
    [attendees, profileReturnPath]
  );

  const viewState = useMemo(
    () => ({
      isEventPin,
      isOwnPin,
      isInteractionLocked,
      pinTypeHeading,
      interactionOverlay,
      viewerDistanceLabel,
      mapPins,
      coordinates,
      coordinateLabel,
      coverImageUrl,
      photoItems,
      proximityRadius,
      addressLabel,
      approximateAddressLabel,
      eventDateRange,
      expirationLabel,
      createdAtLabel,
      updatedAtLabel,
      creatorProfileLink,
      creatorAvatarUrl
    }),
    [
      addressLabel,
      approximateAddressLabel,
      coordinates,
      coordinateLabel,
      coverImageUrl,
      creatorAvatarUrl,
      creatorProfileLink,
      eventDateRange,
      expirationLabel,
      interactionOverlay,
      isEventPin,
      isInteractionLocked,
      isOwnPin,
      mapPins,
      photoItems,
      pinTypeHeading,
      proximityRadius,
      updatedAtLabel,
      createdAtLabel,
      viewerDistanceLabel
    ]
  );

  const bookmarkState = useMemo(
    () => ({
      bookmarked,
      isUpdating: isUpdatingBookmark,
      error: bookmarkError,
      toggle: handleToggleBookmark
    }),
    [bookmarked, bookmarkError, handleToggleBookmark, isUpdatingBookmark]
  );

  const attendanceState = useMemo(
    () => ({
      attending,
      isUpdating: isUpdatingAttendance,
      error: attendanceError,
      toggle: handleToggleAttendance
    }),
    [attending, attendanceError, handleToggleAttendance, isUpdatingAttendance]
  );

  const replyState = useMemo(
    () => ({
      list: replies,
      items: replyItems,
      count: replyCount,
      composerOpen: replyComposerOpen,
      openComposer: openReplyComposer,
      closeComposer: closeReplyComposer,
      message: replyMessage,
      setMessage: setReplyMessage,
      isSubmitting: isSubmittingReply,
      submitError: submitReplyError,
      submit: handleSubmitReply,
      isLoading: isLoadingReplies,
      error: repliesError
    }),
    [
      closeReplyComposer,
      handleSubmitReply,
      isLoadingReplies,
      isSubmittingReply,
      openReplyComposer,
      replies,
      repliesError,
      replyCount,
      replyItems,
      replyComposerOpen,
      replyMessage,
      setReplyMessage,
      submitReplyError
    ]
  );

  const attendeeState = useMemo(
    () => ({
      list: attendees,
      items: attendeeItems,
      overlayOpen: attendeeOverlayOpen,
      openOverlay: openAttendeeOverlay,
      closeOverlay: closeAttendeeOverlay,
      isLoading: isLoadingAttendees,
      error: attendeesError
    }),
    [
      attendeeItems,
      attendeeOverlayOpen,
      attendees,
      attendeesError,
      isLoadingAttendees,
      openAttendeeOverlay,
      closeAttendeeOverlay
    ]
  );

  const shareState = useMemo(
    () => ({
      status: shareStatus,
      setStatus: setShareStatus,
      isSharing,
      share: handleSharePin
    }),
    [handleSharePin, isSharing, setShareStatus, shareStatus]
  );

  const statusState = useMemo(
    () => ({
      isLoading,
      error
    }),
    [error, isLoading]
  );

  return {
    pin,
    viewState,
    bookmarkState,
    attendanceState,
    replyState,
    attendeeState,
    shareState,
    status: statusState,
    reloadPin
  };
}
