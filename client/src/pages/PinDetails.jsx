import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import './PinDetails.css';
import PlaceIcon from '@mui/icons-material/Place'; // used only for pageConfig
import LeafletMap from '../components/Map';
import runtimeConfig from '../config/runtime';
import {
  fetchPinById,
  fetchReplies,
  fetchPinAttendees,
  updatePinAttendance,
  createPinBookmark,
  deletePinBookmark,
  createPinReply
} from '../api/mongoDataApi';
import { playBadgeSound } from '../utils/badgeSound';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { routes } from '../routes';

const EXPIRED_PIN_ID = '68e061721329566a22d47fff';
const SAMPLE_PIN_IDS = [
  '68e061721329566a22d474aa',
  '68e061721329566a22d474ab',
  '68e061721329566a22d474ac'
];
const FAR_PIN_ID = SAMPLE_PIN_IDS[0] ?? '68e061721329566a22d474aa';

export const pageConfig = {
  id: 'pin-details',
  label: 'Pin Details',
  icon: PlaceIcon,
  path: '/pin/:pinId',
  order: 3,
  showInNav: true,
  resolveNavTarget: ({ currentPath } = {}) => {
    const input = window.prompt(
      'Enter a pin ID to view (type "expired" for an expired preview, type "far" to preview a pin outside your interaction radius, leave blank for a random sample, cancel to stay put):'
    );
    if (input === null) {
      return currentPath ?? null;
    }
    const trimmed = input.trim();
    if (trimmed.toLowerCase() === 'expired') {
      return routes.pin.byId(EXPIRED_PIN_ID);
    }
    if (trimmed.toLowerCase() === 'far') {
      const farId = FAR_PIN_ID;
      return `${routes.pin.byId(farId)}?preview=far`;
    }
    if (!trimmed) {
      const randomId =
        SAMPLE_PIN_IDS[Math.floor(Math.random() * SAMPLE_PIN_IDS.length)] ?? '68e061721329566a22d474aa';
      return routes.pin.byId(randomId);
    }
    return routes.pin.byId(trimmed);
  }
};

const DEFAULT_AVATAR_PATH = '/images/profile/profile-01.jpg';
const DEFAULT_COVER_PATH = '/images/background/background-01.jpg';
const API_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');

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

const formatDateTime = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });
};

const formatEventRange = (start, end) => {
  const startLabel = formatDateTime(start);
  const endLabel = formatDateTime(end);
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

const FUTURE_SKEW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
  if (typeof value !== 'string' || value.length < 8 || !/^[a-f\d]+$/i.test(value)) {
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
  const miles = meters / 1609.34;
  const formatted = miles >= 10 ? miles.toFixed(0) : miles.toFixed(1);
  return `${formatted} mi`;
};

const resolveUserIdentifier = (user) => {
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

const buildUserProfileLink = (user, originPath) => {
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

function PinDetails() {
  const { pinId } = useParams();
  const location = useLocation();
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
  const { announceBadgeEarned } = useBadgeSound();
  const isEventPin = useMemo(
    () => (typeof pin?.type === 'string' ? pin.type.toLowerCase() === 'event' : false),
    [pin?.type]
  );

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

  const previewMode = useMemo(() => {
    const params = new URLSearchParams(location.search ?? '');
    return (params.get('preview') || '').toLowerCase();
  }, [location.search]);

  const simulatedFarPreview = previewMode === 'far';
  const viewerWithinInteractionRadius =
    typeof pin?.viewerWithinInteractionRadius === 'boolean' ? pin.viewerWithinInteractionRadius : undefined;
  const viewerDistanceMeters =
    typeof pin?.viewerDistanceMeters === 'number' && Number.isFinite(pin.viewerDistanceMeters)
      ? pin.viewerDistanceMeters
      : null;
  const distanceLockActive = !pinExpired && (simulatedFarPreview || viewerWithinInteractionRadius === false);
  const isInteractionLocked = pinExpired || distanceLockActive;
  const viewerInteractionLockMessage = pin?.viewerInteractionLockMessage;

  const viewerDistanceLabel = useMemo(() => {
    if (viewerDistanceMeters === null) {
      return null;
    }
    if (viewerDistanceMeters >= 1609.34) {
      const miles = viewerDistanceMeters / 1609.34;
      return `${miles.toFixed(1)} miles`;
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

  useEffect(() => {
    setBookmarked(false);
    setIsUpdatingBookmark(false);
    setBookmarkError(null);
    setAttending(false);
    setIsUpdatingAttendance(false);
    setAttendanceError(null);
    setAttendeeOverlayOpen(false);
    setAttendees([]);
    setIsLoadingAttendees(false);
    setAttendeesError(null);
    setReplyComposerOpen(false);
    setReplyMessage('');
    setIsSubmittingReply(false);
    setSubmitReplyError(null);
  }, [pinId, isInteractionLocked]);

  useEffect(() => {
    if (!pin) {
      return;
    }
    setBookmarked(Boolean(pin.viewerHasBookmarked));
  }, [pin?.viewerHasBookmarked]);
  useEffect(() => {
    if (!isEventPin) {
      setAttending(false);
      setAttendanceError(null);
      setAttendeeOverlayOpen(false);
      setAttendees([]);
      setIsLoadingAttendees(false);
      setAttendeesError(null);
      setReplyComposerOpen(false);
      setReplyMessage('');
      setSubmitReplyError(null);
      return;
    }
    setAttending(Boolean(pin.viewerIsAttending));
  }, [pin?.viewerIsAttending, isEventPin]);

  useEffect(() => {
    let ignore = false;

    async function loadPin() {
      if (!pinId) {
        setPin(null);
        setError('Missing pin id in URL.');
        setIsLoading(false);
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
        setBookmarked(Boolean(payload.viewerHasBookmarked));
        setBookmarkError(null);
        setIsUpdatingBookmark(false);
      } catch (error) {
        if (ignore) {
          return;
        }
        console.error('Failed to fetch pin:', error);
        setError(error?.message || 'Failed to load pin details.');
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
  }, [pinId, previewMode]);

  useEffect(() => {
    if (!pinId) {
      setReplies([]);
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
      } catch (error) {
        if (ignore) {
          return;
        }
        console.error('Failed to load replies:', error);
        setRepliesError(error?.message || 'Failed to load replies.');
        setReplies([]);
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
  }, [pinId]);

  useEffect(() => {
    if (!attendeeOverlayOpen) {
      return;
    }
    if (!pinId || !isEventPin) {
      setAttendees([]);
      setIsLoadingAttendees(false);
      setAttendeesError(null);
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
      } catch (error) {
        if (ignore) {
          return;
        }
        console.error('Failed to load attendees:', error);
        setAttendeesError(error?.message || 'Failed to load attendees.');
        setAttendees([]);
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
  }, [attendeeOverlayOpen, pinId, isEventPin]);

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

  const creatorAvatarUrl = useMemo(
    () => resolveMediaAssetUrl(pin?.creator?.avatar, DEFAULT_AVATAR_PATH),
    [pin]
  );
  const profileReturnPath = useMemo(
    () => `${location.pathname}${location.search || ''}${location.hash || ''}`,
    [location.pathname, location.search, location.hash]
  );
  const creatorProfileLink = useMemo(
    () => buildUserProfileLink(pin?.creator, profileReturnPath),
    [pin, profileReturnPath]
  );

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

  const openAttendeeOverlay = useCallback(() => {
    if (!isEventPin) {
      return;
    }
    if (pinExpired) {
      return;
    }
    if (distanceLockActive) {
      setAttendeesError('You are outside this pin\'s interaction radius.');
      return;
    }
    setAttendeesError(null);
    setAttendeeOverlayOpen(true);
  }, [isEventPin, pinExpired, distanceLockActive]);

  const closeAttendeeOverlay = useCallback(() => {
    setAttendeeOverlayOpen(false);
  }, []);

  const openReplyComposer = useCallback(() => {
    if (!pinId) {
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
  }, [pinId, pinExpired, distanceLockActive]);

  const closeReplyComposer = useCallback(() => {
    if (isSubmittingReply) {
      return;
    }
    setReplyComposerOpen(false);
    setSubmitReplyError(null);
  }, [isSubmittingReply]);

  const handleToggleBookmark = useCallback(async () => {
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
      setBookmarkError(toggleError?.message || 'Failed to update bookmark.');
    } finally {
      setIsUpdatingBookmark(false);
    }
  }, [announceBadgeEarned, bookmarked, distanceLockActive, isInteractionLocked, isUpdatingBookmark, pin, pinExpired]);

  const handleToggleAttendance = useCallback(async () => {
    if (!pin || !isEventPin || isUpdatingAttendance || isInteractionLocked) {
      if (pinExpired) {
        setAttendanceError('This event has ended.');
      } else if (distanceLockActive) {
        setAttendanceError('You are outside this pin\'s interaction radius.');
      }
      return;
    }

    const nextAttending = !attending;
    const previousBookmarked = bookmarked;

    if (
      nextAttending &&
      pin.participantLimit &&
      (pin.participantCount ?? 0) >= pin.participantLimit &&
      !pin.viewerIsAttending
    ) {
      setAttendanceError('Participant limit reached.');
      return;
    }

    setAttendanceError(null);
    setIsUpdatingAttendance(true);
    setAttending(nextAttending);
    if (nextAttending) {
      setBookmarked(true);
    }

    setPin((prev) => {
      if (
        !prev ||
        typeof prev.type !== 'string' ||
        prev.type.toLowerCase() !== 'event'
      ) {
        return prev;
      }
      const currentCount = prev.participantCount ?? 0;
      const delta = nextAttending ? 1 : -1;
      const nextCount = Math.max(0, currentCount + delta);
      return {
        ...prev,
        participantCount: nextCount,
        viewerIsAttending: nextAttending,
        viewerHasBookmarked: nextAttending ? true : prev.viewerHasBookmarked
      };
    });

    try {
      const updatedPin = await updatePinAttendance(pin._id, nextAttending);
      setPin(updatedPin);
      setAttending(Boolean(updatedPin.viewerIsAttending));
      setBookmarked(Boolean(updatedPin.viewerHasBookmarked));
      if (updatedPin?._badgeEarnedId) {
        playBadgeSound();
        announceBadgeEarned(updatedPin._badgeEarnedId);
      }
    } catch (updateError) {
      console.error('Failed to update attendance:', updateError);
      setAttendanceError(updateError?.message || 'Failed to update attendance.');
      setPin((prev) => {
        if (
          !prev ||
          typeof prev.type !== 'string' ||
          prev.type.toLowerCase() !== 'event'
        ) {
          return prev;
        }
        const currentCount = prev.participantCount ?? 0;
        const delta = nextAttending ? -1 : 1;
        const nextCount = Math.max(0, currentCount + delta);
        return {
          ...prev,
          participantCount: nextCount,
          viewerIsAttending: !nextAttending
        };
      });
      setAttending(!nextAttending);
      setBookmarked(previousBookmarked);
    } finally {
      setIsUpdatingAttendance(false);
    }
  }, [announceBadgeEarned, attending, bookmarked, distanceLockActive, isEventPin, isInteractionLocked, isUpdatingAttendance, pin, pinExpired]);

  const handleSubmitReply = useCallback(async () => {
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
    } catch (error) {
      console.error('Failed to create reply:', error);
      setSubmitReplyError(error?.message || 'Failed to create reply.');
    } finally {
      setIsSubmittingReply(false);
    }
  }, [pinId, replyMessage, isSubmittingReply, isInteractionLocked, pinExpired, distanceLockActive]);

  const expirationLabel = useMemo(() => formatDateTime(pin?.expiresAt ?? pin?.endDate), [pin]);
  const createdAtLabel = useMemo(() => formatDateTime(pin?.createdAt), [pin]);
  const updatedAtLabel = useMemo(() => formatDateTime(pin?.updatedAt), [pin]);

  return (
    <div className='pin-details'>
      {interactionOverlay ? (
        <div className='pin-expired-overlay' role='dialog' aria-modal='true'>
          <div className='pin-expired-modal'>
            <h3>{interactionOverlay.title}</h3>
            <p>{interactionOverlay.message}</p>
            <div className='expired-actions'>
              <Link to={routes.list.base} className='expired-return-button'>
                Return to List
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      {/* Header */}
      <header className='header'>
        <Link to={routes.list.base} className="back-button">
          <img
            src='https://www.svgrepo.com/show/326886/arrow-back-sharp.svg'
            className='back-arrow'
          />
        </Link>

        <h2>{pin ? pin.type.charAt(0).toUpperCase() + pin.type.slice(1) : 'Loading...'}</h2>

        <div className='bookmark-button-wrapper'>
          <button
            className='bookmark-button'
            onClick={handleToggleBookmark}
            disabled={isUpdatingBookmark || !pin || isInteractionLocked}
            aria-pressed={bookmarked ? 'true' : 'false'}
            aria-label={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
            aria-busy={isUpdatingBookmark ? 'true' : 'false'}
          >
            <img
              src={
                bookmarked
                  ? 'https://www.svgrepo.com/show/347684/bookmark-fill.svg'
                  : 'https://www.svgrepo.com/show/357397/bookmark-full.svg'
              }
              className='bookmark'
              alt={bookmarked ? 'Bookmarked' : 'Bookmark icon'}
            />
          </button>
          {bookmarkError ? (
            <span className='error-text bookmark-error'>{bookmarkError}</span>
          ) : null}
        </div>
      </header>

      {/* Event/Discussion Name */}
      <div className='name'>
        <h2>{pin ? pin.title || 'Untitled pin' : 'Loading pin...'}</h2>
        {pin?._id ? <span className="pin-id">ID: {pin._id}</span> : null}
        {proximityRadius ? (
          <span className="pin-radius">Proximity radius: {proximityRadius}</span>
        ) : null}
        {viewerDistanceLabel ? (
          <span className="pin-radius">Approximate distance: {viewerDistanceLabel}</span>
        ) : null}
        {createdAtLabel || updatedAtLabel ? (
          <span className="pin-timestamps">
            {createdAtLabel ? `Created ${createdAtLabel}` : null}
            {createdAtLabel && updatedAtLabel ? ' | ' : null}
            {updatedAtLabel ? `Updated ${updatedAtLabel}` : null}
          </span>
        ) : null}
      </div>

      <div className="status-container">
        {isLoading ? <div className="status-message">Loading pin details...</div> : null}
        {error ? <div className="status-message error">{error}</div> : null}
        {!pin && !isLoading && !error && pinId ? (
          <div className="status-message">No pin found for ID &ldquo;{pinId}&rdquo;.</div>
        ) : null}
      </div>

      {pin ? (
        <>
          {/* Map section */}
          <div className='map-section'>
            {coordinates ? (
              <div className="map-wrapper">
                <LeafletMap
                  userLocation={coordinates}
                  pins={[pin]}
                  selectedPinId={pin._id}
                  centerOverride={coordinates}
                />
              </div>
            ) : coverImageUrl ? (
              <img src={coverImageUrl} alt={`${pin.title ?? 'Pin'} cover`} className="cover-photo" />
            ) : (
              <div className="map-placeholder muted">No location data available for this pin.</div>
            )}
          </div>

          {/* Post creator */}
          {creatorProfileLink ? (
            <Link
              to={creatorProfileLink.pathname}
              state={creatorProfileLink.state}
              className='post-creator user-link'
            >
              <img
                src={creatorAvatarUrl}
                className='profile-icon'
                alt={`${pin.creator?.displayName ?? 'Creator'} avatar`}
              />
              <div className="post-creator-details">
                <span className="creator-name">
                  {pin.creator?.displayName || pin.creator?.username || 'Unknown creator'}
                </span>
                {pin.creator?.username ? (
                  <span className="creator-username">@{pin.creator.username}</span>
                ) : null}
              </div>
            </Link>
          ) : (
            <div className='post-creator'>
              <img
                src={creatorAvatarUrl}
                className='profile-icon'
                alt={`${pin.creator?.displayName ?? 'Creator'} avatar`}
              />
              <div className="post-creator-details">
                <span className="creator-name">
                  {pin.creator?.displayName || pin.creator?.username || 'Unknown creator'}
                </span>
                {pin.creator?.username ? (
                  <span className="creator-username">@{pin.creator.username}</span>
                ) : null}
              </div>
            </div>
          )}

          {/* Post description */}
          <div className='post-description'>
            {pin.description ? pin.description : <span className="muted">No description provided.</span>}
          </div>

          {/* Post images */}
          <div className='post-images'>
            {photoItems.length > 0 ? (
              <div className="photo-grid">
                {photoItems.map((photo, index) => (
                  <figure className="pin-photo-item" key={`${photo.url}-${index}`}>
                    <img
                      src={photo.url}
                      alt={photo.label ? `${photo.label}` : `Pin photo ${index + 1}`}
                      className="pin-photo"
                      loading="lazy"
                    />
                    {photo.label ? <figcaption>{photo.label}</figcaption> : null}
                  </figure>
                ))}
              </div>
            ) : (
              <div className="muted">No photos uploaded for this pin.</div>
            )}
          </div>

          {/* Post info */}
          <div className='post-info'>
            <div className='post-location'>
              <svg
                className='pin-icon'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <path
                  fill='currentColor'
                  d='M12 2a7 7 0 0 0-7 7c0 4.63 5.48 11.05 6.27 11.93a1 1 0 0 0 1.46 0C13.52 20.05 19 13.63 19 9a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z'
                />
              </svg>
              <span className='location-text'>
                Location:<br />
                {addressLabel ||
                  approximateAddressLabel ||
                  'No address information available.'}
                {coordinateLabel ? (
                  <>
                    <br />
                    Coordinates: {coordinateLabel}
                  </>
                ) : null}
              </span>
            </div>

            <div className='post-occurance'>
              <img
                src='https://www.svgrepo.com/show/533378/calendar.svg'
                className='calendar-icon'
                alt='Calendar icon'
              />
              <span className='occurance-text'>
                {pin.type === 'event' ? 'Occurs:' : 'Expires:'}
                <br />
                {pin.type === 'event'
                  ? eventDateRange || 'No schedule provided.'
                  : expirationLabel || 'No expiration set.'}
              </span>
            </div>

            <div className='post-attendance'>
              <img
                src='https://www.svgrepo.com/show/511192/user-check.svg'
                className='attendance-icon'
                alt='Attendance icon'
              />
              <span className='attendance-text'>
                Bookmarks: {pin.bookmarkCount ?? 0}
                {isEventPin ? (
                  <>
                    <br />
                    Attending: {pin.participantCount ?? 0}
                    {pin.participantLimit ? ` / ${pin.participantLimit}` : ''}
                  </>
                ) : null}
              </span>
              {isEventPin ? (
                <button
                  type="button"
                  className='view-attendees-button'
                  onClick={openAttendeeOverlay}
                  disabled={isInteractionLocked || (isLoadingAttendees && attendeeOverlayOpen)}
                >
                  {isLoadingAttendees && attendeeOverlayOpen ? 'Loading attendees...' : 'View Attendees'}
                </button>
              ) : null}
            </div>
          </div>

          {/* Attend button */}
          {isEventPin ? (
            <div className='attendance'>
              <button
                className={`attend-button ${attending ? 'attending' : ''}`}
                onClick={handleToggleAttendance}
                disabled={isUpdatingAttendance || !pin || isInteractionLocked}
                aria-busy={isUpdatingAttendance ? 'true' : 'false'}
              >
                {isUpdatingAttendance ? 'Updating...' : attending ? 'Attending!' : 'Attend'}
              </button>
              {attendanceError ? (
                <div className="error-text attendance-error">{attendanceError}</div>
              ) : null}
            </div>
          ) : null}

          {/* Comments header */}
          <div className='comments-header'>
            <img
              src='https://www.svgrepo.com/show/361088/comment-discussion.svg'
              className='comment-icon'
              alt='Comments icon'
            />
            <p>
              Comments (
              {isLoadingReplies
                ? '...'
                : replies.length || pin.replyCount || pin.stats?.replyCount || 0}
              )
            </p>
          </div>

          {/* Comments section */}
          <div className='comments-section'>
            {isLoadingReplies ? <div className="muted">Loading replies...</div> : null}
            {repliesError ? <div className="error-text">{repliesError}</div> : null}
            {!isLoadingReplies && !repliesError && replies.length === 0 ? (
              <div className="muted">No replies yet.</div>
            ) : null}

            {replies.map((reply) => {
              const authorName =
                reply.author?.displayName || reply.author?.username || 'Anonymous user';
              const replyAvatar = resolveMediaAssetUrl(
                reply.author?.avatar,
                DEFAULT_AVATAR_PATH
              );
              const createdLabel = formatDateTime(reply.createdAt);
              const authorProfileLink = buildUserProfileLink(reply.author, profileReturnPath);

              return (
                <div className='comment' key={reply._id}>
                  {authorProfileLink ? (
                    <Link
                      to={authorProfileLink.pathname}
                      state={authorProfileLink.state}
                      className='comment-header user-link'
                    >
                      <img
                        src={replyAvatar}
                        className='commenter-pfp'
                        alt={`${authorName} avatar`}
                      />
                      <span className='commenter-info'>
                        <strong>{authorName}</strong>
                        {createdLabel ? (
                          <span className="comment-timestamp">{createdLabel}</span>
                        ) : null}
                      </span>
                    </Link>
                  ) : (
                    <div className='comment-header'>
                      <img
                        src={replyAvatar}
                        className='commenter-pfp'
                        alt={`${authorName} avatar`}
                      />
                      <span className='commenter-info'>
                        <strong>{authorName}</strong>
                        {createdLabel ? (
                          <span className="comment-timestamp">{createdLabel}</span>
                        ) : null}
                      </span>
                    </div>
                  )}

                  <div className='comment-body'>
                    <p>{reply.message}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Create comment button */}
          <button className='create-comment' disabled={isInteractionLocked} onClick={openReplyComposer} aria-label='Create reply'>
            <img
              src='https://www.svgrepo.com/show/489238/add-comment.svg'
              className='create-comment-button'
              alt='Create comment button'
            />
          </button>

        </>
      ) : null}
      {replyComposerOpen ? (
        <div className='reply-overlay'>
          <div
            className='reply-overlay-backdrop'
            onClick={closeReplyComposer}
            aria-hidden='true'
          />
          <div
            className='reply-overlay-content'
            role='dialog'
            aria-modal='true'
            aria-label='Create reply'
          >
            <div className='reply-overlay-header'>
              <h3>Add a Reply</h3>
              <button
                type='button'
                className='reply-overlay-close'
                onClick={closeReplyComposer}
                disabled={isSubmittingReply || isInteractionLocked}
              >
                Cancel
              </button>
            </div>
            <div className='reply-overlay-body'>
              <label htmlFor='reply-message' className='reply-overlay-label'>
                Share your thoughts
              </label>
              <textarea
                id='reply-message'
                className='reply-overlay-textarea'
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                placeholder='Type your reply here...'
                maxLength={4000}
                disabled={isSubmittingReply || isInteractionLocked}
              />
              <div className='reply-overlay-footer'>
                <span className='reply-overlay-count'>{replyMessage.length}/4000</span>
                <button
                  type='button'
                  className='reply-overlay-submit'
                  onClick={handleSubmitReply}
                  disabled={isSubmittingReply || isInteractionLocked}
                >
                  {isSubmittingReply ? 'Posting...' : 'Post Reply'}
                </button>
              </div>
              {submitReplyError ? <div className='error-text'>{submitReplyError}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
      {attendeeOverlayOpen ? (
        <div className='attendee-overlay'>
          <div
            className='attendee-overlay-backdrop'
            onClick={closeAttendeeOverlay}
            aria-hidden='true'
          />
          <div
            className='attendee-overlay-content'
            role='dialog'
            aria-modal='true'
            aria-label='Event attendees'
          >
            <div className='attendee-overlay-header'>
              <h3>Event Attendees</h3>
              <button
                type='button'
                className='attendee-overlay-close'
                onClick={closeAttendeeOverlay}
              >
                Close
              </button>
            </div>
            <div className='attendee-overlay-body'>
              {isLoadingAttendees ? (
                <div className='muted'>Loading attendees...</div>
              ) : attendeesError ? (
                <div className='error-text'>{attendeesError}</div>
              ) : attendees.length === 0 ? (
                <div className='muted'>No attendees yet.</div>
              ) : (
                <ul className='attendee-list'>
                  {attendees.map((attendee) => {
                    const attendeeLink = buildUserProfileLink(attendee, profileReturnPath);
                    const attendeeAvatar = resolveMediaAssetUrl(
                      attendee?.avatar,
                      DEFAULT_AVATAR_PATH
                    );
                    const attendeeName =
                      attendee?.displayName || attendee?.username || 'Unknown attendee';
                    const attendeeKey =
                      attendee?._id ||
                      attendee?.id ||
                      attendee?.uid ||
                      attendee?.username ||
                      attendeeName;

                    const content = (
                      <>
                        <img
                          src={attendeeAvatar}
                          alt={`${attendeeName} avatar`}
                          className='attendee-avatar'
                        />
                        <span className='attendee-name'>{attendeeName}</span>
                      </>
                    );

                    return (
                      <li key={attendeeKey}>
                        {attendeeLink ? (
                          <Link
                            to={attendeeLink.pathname}
                            state={attendeeLink.state}
                            className='attendee-list-item user-link'
                            onClick={closeAttendeeOverlay}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div className='attendee-list-item'>{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PinDetails;
