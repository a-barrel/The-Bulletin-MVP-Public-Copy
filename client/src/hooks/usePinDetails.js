import { useCallback, useEffect, useMemo, useState } from 'react';

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
} from '../api/mongoDataApi';
import runtimeConfig from '../config/runtime';
import formatDateTime from '../utils/dates';
import { routes } from '../routes';
import { playBadgeSound } from '../utils/badgeSound';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { metersToMiles, METERS_PER_MILE } from '../utils/geo';

const DEFAULT_AVATAR_PATH = '/images/profile/profile-01.jpg';
const DEFAULT_COVER_PATH = '/images/background/background-01.jpg';
const API_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
const FUTURE_SKEW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const TF2_AVATAR_MAP = {
  tf2_scout: '/images/emulation/avatars/Scoutava.jpg',
  tf2_soldier: '/images/emulation/avatars/Soldierava.jpg',
  tf2_pyro: '/images/emulation/avatars/Pyroava.jpg',
  tf2_demoman: '/images/emulation/avatars/Demomanava.jpg',
  tf2_heavy: '/images/emulation/avatars/Heavyava.jpg',
  tf2_engineer: '/images/emulation/avatars/Engineerava.jpg',
  tf2_medic: '/images/emulation/avatars/Medicava.jpg',
  tf2_sniper: '/images/emulation/avatars/Sniperava.jpg',
  tf2_spy: '/images/emulation/avatars/Spyava.jpg'
};

const resolveMediaAssetUrl = (asset, fallback) => {
  if (asset && typeof asset === 'object') {
    const source = asset.url ?? asset.thumbnailUrl ?? asset.path;
    if (typeof source === 'string' && source.trim().length > 0) {
      return resolveMediaAssetUrl(source.trim(), fallback);
    }
  }

  if (typeof asset === 'string' && asset.trim().length > 0) {
    const value = asset.trim();
    if (/^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith('data:')) {
      return value;
    }
    const normalized = value.startsWith('/') ? value : `/${value}`;
    return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
  }

  return fallback ?? null;
};

export const resolveUserAvatarUrl = (user, fallback = DEFAULT_AVATAR_PATH) => {
  const candidates = [
    user?.avatar,
    user?.avatar?.url,
    user?.avatarUrl,
    user?.profile?.avatar,
    user?.profile?.avatar?.url
  ];

  for (const candidate of candidates) {
    const resolved = resolveMediaAssetUrl(candidate);
    if (resolved) {
      if (/\/images\/profile\/profile-\d+\.jpg$/i.test(resolved ?? '') && user?.username) {
        const mapKey = String(user.username).trim().toLowerCase();
        const fallbackPath = TF2_AVATAR_MAP[mapKey];
        if (fallbackPath) {
          const mapped = resolveMediaAssetUrl(fallbackPath, fallback);
          if (mapped) {
            return mapped;
          }
        }
      }
      return resolved;
    }
  }

  if (user?.username) {
    const mapKey = String(user.username).trim().toLowerCase();
    const fallbackPath = TF2_AVATAR_MAP[mapKey];
    if (fallbackPath) {
      const mapped = resolveMediaAssetUrl(fallbackPath, fallback);
      if (mapped) {
        return mapped;
      }
    }
  }

  return resolveMediaAssetUrl(null, fallback);
};

const formatPinDateTime = (value) =>
  formatDateTime(value, {
    fallback: null,
    options: {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }
  });

const formatEventRange = (start, end) => {
  const startLabel = formatPinDateTime(start);
  const endLabel = formatPinDateTime(end);
  if (startLabel && endLabel) {
    return `${startLabel} -> ${endLabel}`;
  }
  return startLabel ?? endLabel ?? null;
};

const formatAddress = (address) => {
  if (!address) {
    return null;
  }
  const { precise, components } = address;
  const parts = [];
  if (precise) {
    parts.push(precise);
  }
  if (components) {
    const componentParts = [
      components.line1,
      components.line2,
      components.city,
      components.state,
      components.postalCode,
      components.country
    ].filter(Boolean);
    parts.push(...componentParts);
  }

  return parts.length > 0 ? parts.join(', ') : null;
};

const formatApproximateAddress = (approximateAddress) => {
  if (!approximateAddress) {
    return null;
  }
  const parts = [
    approximateAddress.formatted,
    approximateAddress.city,
    approximateAddress.state,
    approximateAddress.country
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
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
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
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

export const resolveUserIdentifier = (user) => {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const rawIdentifier =
    user._id ??
    user.id ??
    user.uid ??
    user.userId ??
    user.username ??
    user.email ??
    user.displayName;

  if (rawIdentifier === undefined || rawIdentifier === null) {
    return null;
  }

  const identifierString =
    typeof rawIdentifier === 'string' ? rawIdentifier.trim() : String(rawIdentifier).trim();

  if (!identifierString) {
    return null;
  }

  return identifierString;
};

export const buildUserProfileLink = (user, originPath) => {
  const identifier = resolveUserIdentifier(user);
  if (!identifier) {
    return null;
  }

  const linkState = user
    ? {
        user,
        ...(originPath ? { from: originPath } : {})
      }
    : originPath
      ? { from: originPath }
      : undefined;

  return {
    pathname: routes.profile.byId(identifier),
    state: linkState
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

export default function usePinDetails({ pinId, location, isOffline }) {
  const locationState = location?.state;
  const { announceBadgeEarned } = useBadgeSound();
  const [viewerProfileId, setViewerProfileId] = useState(() =>
    extractViewerProfileIdFromState(locationState)
  );
  const [pin, setPin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [isUpdatingBookmark, setIsUpdatingBookmark] = useState(false);
  const [bookmarkError, setBookmarkError] = useState(null);
  const [attending, setAttending] = useState(false);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [replies, setReplies] = useState([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [repliesError, setRepliesError] = useState(null);
  const [attendeeOverlayOpen, setAttendeeOverlayOpen] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [attendeesError, setAttendeesError] = useState(null);
  const [replyComposerOpen, setReplyComposerOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [submitReplyError, setSubmitReplyError] = useState(null);
  const [shareStatus, setShareStatus] = useState(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (viewerProfileId) {
      return;
    }
    const candidate = extractViewerProfileIdFromState(locationState);
    if (candidate) {
      setViewerProfileId(candidate);
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
          setViewerProfileId(null);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [viewerProfileId, isOffline]);

  const previewMode = useMemo(() => {
    const params = new URLSearchParams(location?.search ?? '');
    return (params.get('preview') || '').toLowerCase();
  }, [location?.search]);

  useEffect(() => {
    if (!pinId) {
      setPin(null);
      setIsLoading(false);
      setError('Pin ID was not provided.');
      return;
    }

    let ignore = false;

    async function loadPin() {
      if (isOffline) {
        setIsLoading(false);
        setError((prev) => prev ?? 'You are offline. Connect to load the latest pin details.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const payload = await fetchPinById(pinId, { previewMode });
        if (ignore) {
          return;
        }
        setPin(payload);
        setBookmarked(Boolean(payload?.viewerHasBookmarked));
        setAttending(Boolean(payload?.viewerIsAttending));
      } catch (loadError) {
        if (ignore) {
          return;
        }
        console.error('Failed to load pin details:', loadError);
        setError(loadError?.message || 'Failed to load pin details.');
        setPin(null);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadPin();

    return () => {
      ignore = true;
    };
  }, [isOffline, pinId, previewMode]);

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

      try {
        const payload = await fetchReplies(pinId);
        if (ignore) {
          return;
        }
        setReplies(Array.isArray(payload) ? sortRepliesByDateDesc(payload) : []);
      } catch (loadError) {
        if (ignore) {
          return;
        }
        console.error('Failed to load replies:', loadError);
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

  useEffect(() => {
    if (!attendeeOverlayOpen) {
      return;
    }
    if (isOffline) {
      setIsLoadingAttendees(false);
      setAttendeesError((prev) => prev ?? 'Attendee list unavailable while offline.');
      return;
    }
    if (!pinId) {
      setAttendees([]);
      return;
    }

    let ignore = false;

    async function loadAttendees() {
      setIsLoadingAttendees(true);
      setAttendeesError(null);
      try {
        const payload = await fetchPinAttendees(pinId);
        if (ignore) {
          return;
        }
        setAttendees(Array.isArray(payload) ? payload : []);
      } catch (loadError) {
        if (ignore) {
          return;
        }
        console.error('Failed to load attendees:', loadError);
        setAttendees([]);
        setAttendeesError(loadError?.message || 'Failed to load attendees.');
      } finally {
        if (!ignore) {
          setIsLoadingAttendees(false);
        }
      }
    }

    loadAttendees();

    return () => {
      ignore = true;
    };
  }, [attendeeOverlayOpen, isOffline, pinId]);

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
  const isInteractionLocked =
    pinExpired || (distanceLockActive && !bookmarked && !isOwnPin);
  const viewerInteractionLockMessage = pin?.viewerInteractionLockMessage;

  const viewerDistanceLabel = useMemo(() => {
    if (viewerDistanceMeters === null) {
      return null;
    }
    if (viewerDistanceMeters >= METERS_PER_MILE) {
      const miles = metersToMiles(viewerDistanceMeters);
      return miles === null ? null : `${miles.toFixed(1)} miles`;
    }
    if (viewerDistanceMeters >= 10) {
      return `${Math.round(viewerDistanceMeters)} meters`;
    }
    return `${viewerDistanceMeters.toFixed(1)} meters`;
  }, [viewerDistanceMeters]);

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
    if (pin.isSelf === isOwnPin) {
      return [pin];
    }
    return [{ ...pin, isSelf: isOwnPin }];
  }, [pin, isOwnPin]);

  const coverImageUrl = useMemo(
    () => resolveMediaAssetUrl(pin?.coverPhoto, DEFAULT_COVER_PATH),
    [pin]
  );

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
    } else if (coverImageUrl) {
      pushPhoto(coverImageUrl);
    }

    if (Array.isArray(pin.photos)) {
      pin.photos.forEach((photo, index) => pushPhoto(photo, { fallbackLabel: `Photo ${index + 1}` }));
    }

    return items;
  }, [pin, coverImageUrl]);

  const coordinates = useMemo(
    () => parseCoordinates(pin?.coordinates?.coordinates),
    [pin]
  );
  const coordinateLabel = useMemo(
    () => formatCoordinateLabel(pin?.coordinates?.coordinates),
    [pin]
  );
  const proximityRadius = useMemo(
    () => formatMetersToMiles(pin?.proximityRadiusMeters),
    [pin]
  );
  const addressLabel = useMemo(() => formatAddress(pin?.address), [pin]);
  const approximateAddressLabel = useMemo(
    () => formatApproximateAddress(pin?.approximateAddress),
    [pin]
  );
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
    () => buildUserProfileLink(pin?.creator, profileReturnPath),
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

  const handleToggleBookmark = useCallback(async () => {
    if (isOffline) {
      setBookmarkError('Bookmarks are unavailable while offline.');
      return;
    }
    if (!pin || isUpdatingBookmark || isInteractionLocked) {
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
      console.error('Failed to toggle bookmark:', toggleError);
      setBookmarkError(toggleError?.message || 'Failed to toggle bookmark.');
    } finally {
      setIsUpdatingBookmark(false);
    }
  }, [
    announceBadgeEarned,
    bookmarked,
    distanceLockActive,
    isInteractionLocked,
    isOffline,
    isUpdatingBookmark,
    pin,
    pinExpired
  ]);

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

      setAttending((prev) =>
        typeof response?.viewerIsAttending === 'boolean'
          ? response.viewerIsAttending
          : !prev
      );

      if (typeof response?.viewerHasBookmarked === 'boolean') {
        setBookmarked(response.viewerHasBookmarked);
      }

      if (response?.badgeEarnedId) {
        playBadgeSound();
        announceBadgeEarned(response.badgeEarnedId);
      }
    } catch (toggleError) {
      console.error('Failed to update attendance:', toggleError);
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
    pinExpired
  ]);

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
      console.error('Failed to create reply:', submitError);
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
    replyMessage
  ]);

  const replyCount = useMemo(
    () => replies.length || pin?.replyCount || pin?.stats?.replyCount || 0,
    [pin?.replyCount, pin?.stats?.replyCount, replies.length]
  );

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
        const name = attendee?.displayName || attendee?.username || 'Unknown attendee';
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

  return {
    pin,
    isEventPin: typeof pin?.type === 'string' ? pin.type.toLowerCase() === 'event' : false,
    pinExpired,
    distanceLockActive,
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
    profileReturnPath,
    creatorProfileLink,
    creatorAvatarUrl,
    isLoading,
    error,
    bookmarked,
    isUpdatingBookmark,
    bookmarkError,
    handleToggleBookmark,
    attending,
    isUpdatingAttendance,
    attendanceError,
    handleToggleAttendance,
    replies,
    replyItems,
    replyCount,
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
    shareStatus,
    setShareStatus,
    isSharing,
    handleSharePin,
    attendees,
    attendeeOverlayOpen,
    openAttendeeOverlay,
    closeAttendeeOverlay,
    attendeeItems,
    isLoadingAttendees,
    attendeesError
  };
}
