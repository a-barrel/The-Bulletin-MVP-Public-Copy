import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import './PinDetails.css';
import PlaceIcon from '@mui/icons-material/Place';
import LeafletMap from '../components/Map';
import runtimeConfig from '../config/runtime';
import { fetchPinById, fetchReplies } from '../api/mongoDataApi';

const EXPIRED_PIN_ID = '68e061721329566a22d47fff';
const SAMPLE_PIN_IDS = [
  '68e061721329566a22d474aa',
  '68e061721329566a22d474ab',
  '68e061721329566a22d474ac'
];
const FAR_PIN_ID = SAMPLE_PIN_IDS[0] ?? '68e061721329566a22d474aa';

export const pageConfig = {
  id: 'pin-details-v2-wip',
  label: 'Pin Details v2 (WIP)',
  icon: PlaceIcon,
  path: '/pin-v2/:pinId',
  order: 98,
  showInNav: true,
  resolveNavTarget: ({ currentPath } = {}) => {
    const input = window.prompt(
      'Enter a pin ID to view in Pin Details v2 (type "expired" for an expired preview, type "far" to preview a pin outside your interaction radius, leave blank for a random sample, cancel to stay put):'
    );
    if (input === null) {
      return currentPath ?? null;
    }
    const trimmed = input.trim();
    if (trimmed.toLowerCase() === 'expired') {
      return `/pin-v2/${EXPIRED_PIN_ID}`;
    }
    if (trimmed.toLowerCase() === 'far') {
      const farId = FAR_PIN_ID;
      return `/pin-v2/${farId}?preview=far`;
    }
    if (!trimmed) {
      const randomId =
        SAMPLE_PIN_IDS[Math.floor(Math.random() * SAMPLE_PIN_IDS.length)] ?? '68e061721329566a22d474aa';
      return `/pin-v2/${randomId}`;
    }
    return `/pin-v2/${trimmed}`;
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
  return `${parsed.latitude.toFixed(5)}, ${parsed.longitude.toFixed(5)}`;
};

const combineTagArray = (tags) => {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null;
  }
  return tags.filter(Boolean).join(', ');
};

const combineStringList = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  return value.filter(Boolean).join(', ');
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

function PinDetailsV2WIP() {
  const { pinId } = useParams();
  const location = useLocation();
  const [pin, setPin] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [replies, setReplies] = useState([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [repliesError, setRepliesError] = useState(null);
  const [attending, setAttending] = useState(false);

  const previewMode = useMemo(() => {
    const params = new URLSearchParams(location.search ?? '');
    return (params.get('preview') || '').toLowerCase();
  }, [location.search]);

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
    if (!pinId) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    const signal = controller.signal;

    async function loadPin() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchPinById(pinId, { signal, previewMode });
        if (!isMounted) {
          return;
        }
        setPin(result);
      } catch (err) {
        if (!isMounted || signal.aborted) {
          return;
        }
        console.error('Failed to load pin:', err);
        setError(err.message || 'Unable to load pin details.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPin();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [pinId, previewMode]);

  useEffect(() => {
    if (!pinId) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    const signal = controller.signal;

    async function loadReplies() {
      setIsLoadingReplies(true);
      setRepliesError(null);
      try {
        const list = await fetchReplies(pinId, { signal });
        if (!isMounted) {
          return;
        }
        setReplies(Array.isArray(list) ? sortRepliesByDateDesc(list) : []);
      } catch (err) {
        if (!isMounted || signal.aborted) {
          return;
        }
        console.error('Failed to load replies:', err);
        setRepliesError(err.message || 'Unable to load replies.');
      } finally {
        if (isMounted) {
          setIsLoadingReplies(false);
        }
      }
    }

    loadReplies();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [pinId]);

  const coordinateLabel = useMemo(() => formatCoordinateLabel(pin?.coordinates?.coordinates), [pin]);
  const eventDateRange = useMemo(() => formatEventRange(pin?.startDate, pin?.endDate), [pin?.startDate, pin?.endDate]);
  const expirationLabel = useMemo(() => formatDateTime(pin?.expiresAt), [pin?.expiresAt]);
  const formattedAddress = useMemo(() => formatAddress(pin?.address), [pin?.address]);
  const formattedApproximate = useMemo(() => formatApproximateAddress(pin?.approximateAddress), [pin?.approximateAddress]);
  const combinedTags = useMemo(() => combineTagArray(pin?.tags), [pin?.tags]);
  const combinedRelatedPins = useMemo(() => combineStringList(pin?.relatedPinIds), [pin?.relatedPinIds]);

  const coverPhotoUrl = useMemo(
    () => resolveMediaAssetUrl(pin?.coverPhoto, DEFAULT_COVER_PATH),
    [pin?.coverPhoto]
  );
  const creatorAvatarUrl = useMemo(
    () => resolveMediaAssetUrl(pin?.creator?.avatar, DEFAULT_AVATAR_PATH),
    [pin?.creator]
  );

  const mapCenter = useMemo(() => {
    const parsed = parseCoordinates(pin?.coordinates?.coordinates);
    if (!parsed) {
      return null;
    }
    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude
    };
  }, [pin?.coordinates?.coordinates]);

  return (
    <div className='pin-details-page'>
      <header className='pin-details-header'>
        <h1>Pin Details (v2 WIP)</h1>
        <p className='muted'>Previewing Wai's in-progress design.</p>
      </header>

      {interactionOverlay ? (
        <div className='pin-expired-overlay' role='dialog' aria-modal='true'>
          <div className='pin-expired-modal'>
            <h3>{interactionOverlay.title}</h3>
            <p>{interactionOverlay.message}</p>
            <div className='expired-actions'>
              <Link to="/list" className='expired-return-button'>
                Return to List
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className='pin-actions'>
        <Link to='/list' className='back-button'>
          &larr; Back to List
        </Link>
        <button type='button' className='primary-action' disabled={isInteractionLocked}>
          Share
        </button>
      </div>

      {isLoading ? <div className='muted'>Loading pin...</div> : null}
      {error ? <div className='error-text'>{error}</div> : null}

      {!isLoading && !error && pin ? (
        <>
          <section className='pin-hero'>
            <div className='hero-media'>
              <img
                src={coverPhotoUrl ?? DEFAULT_COVER_PATH}
                alt={pin.title || 'Pin cover'}
                className='pin-cover'
              />
              <div className='hero-overlay'>
                <div className='pin-type-label'>{pin.type?.toUpperCase() || 'PIN'}</div>
                <h2>{pin.title ?? 'Untitled Pin'}</h2>
                <p>{pin.description ?? 'No description provided for this pin.'}</p>
              </div>
            </div>
            <aside className='pin-metadata'>
              <div className='meta-block'>
                <h3>Location</h3>
                <p>
                  {formattedAddress || formattedApproximate || 'No address provided.'}
                  {coordinateLabel ? <><br />Coordinates: {coordinateLabel}</> : null}
                </p>
              </div>
              <div className='meta-block'>
                <h3>Schedule</h3>
                <p>
                  {pin.type === 'event'
                    ? eventDateRange || 'No schedule provided.'
                    : expirationLabel || 'No expiration set.'}
                </p>
              </div>
              <div className='meta-block'>
                  <h3>Stats</h3>
                  <p>
                    Bookmarks: {pin.bookmarkCount ?? 0}
                    {pin.type === 'event' ? (
                  <>
                    <br />
                    Attending: {pin.participantCount ?? 0}
                    {pin.participantLimit ? ` / ${pin.participantLimit}` : ''}
                  </>
                ) : null}
                {viewerDistanceLabel ? (
                  <>
                    <br />
                    Distance: {viewerDistanceLabel}
                  </>
                ) : null}
              </p>
            </div>
            </aside>
          </section>

          <section className='pin-main-content'>
            <div className='creator-card'>
              <img
                src={creatorAvatarUrl ?? DEFAULT_AVATAR_PATH}
                alt={pin.creator?.displayName || 'Creator avatar'}
                className='creator-avatar'
              />
              <div>
                <h3>{pin.creator?.displayName || pin.creator?.username || 'Unknown creator'}</h3>
                <p className='muted'>@{pin.creator?.username || 'unknown'}</p>
              </div>
              <button type='button' className='secondary-action' disabled={isInteractionLocked}>
                Message
              </button>
            </div>

            <div className='pin-details-grid'>
              <div className='detail-card'>
                <h4>Tags</h4>
                <p>{combinedTags || 'No tags provided.'}</p>
              </div>
              <div className='detail-card'>
                <h4>Related Pins</h4>
                <p>{combinedRelatedPins || 'No related pins set.'}</p>
              </div>
              <div className='detail-card'>
                <h4>Radius</h4>
                <p>
                  {pin.proximityRadiusMeters
                    ? `${pin.proximityRadiusMeters} meters`
                    : 'No radius specified.'}
                </p>
              </div>
            </div>

            <div className='map-wrapper'>
              {mapCenter ? (
                <LeafletMap userLocation={mapCenter} pins={[pin]} />
              ) : (
                <div className='muted'>No map coordinates available for this pin.</div>
              )}
            </div>
          </section>

          <section className='pin-replies'>
            <header className='replies-header'>
              <h3>Comments</h3>
              <button
                type='button'
                className={`attend-button ${attending ? 'attending' : ''}`}
                disabled={isInteractionLocked}
                onClick={() => {
                  if (isInteractionLocked) {
                    return;
                  }
                  setAttending((prev) => !prev);
                }}
              >
                {attending ? 'Attending!' : 'Attend'}
              </button>
            </header>

            {isLoadingReplies ? <div className='muted'>Loading replies...</div> : null}
            {repliesError ? <div className='error-text'>{repliesError}</div> : null}
            {!isLoadingReplies && !repliesError && replies.length === 0 ? (
              <div className='muted'>No replies yet.</div>
            ) : null}

            {replies.map((reply) => {
              const authorName =
                reply.author?.displayName || reply.author?.username || 'Anonymous user';
              const replyAvatar = resolveMediaAssetUrl(
                reply.author?.avatar,
                DEFAULT_AVATAR_PATH
              );
              const createdLabel = formatDateTime(reply.createdAt);

              return (
                <div className='comment' key={reply._id}>
                  <div className='comment-header'>
                    <img
                      src={replyAvatar}
                      className='commenter-pfp'
                      alt={`${authorName} avatar`}
                    />
                    <span className='commenter-info'>
                      <strong>{authorName}</strong>
                      {createdLabel ? (
                        <span className='comment-timestamp'>{createdLabel}</span>
                      ) : null}
                    </span>
                  </div>

                  <div className='comment-body'>
                    <p>{reply.message}</p>
                  </div>
                </div>
              );
            })}
          </section>

          <section className='pin-actions-footer'>
            <button type='button' className='primary-action' disabled={isInteractionLocked}>
              Create Comment
            </button>
            <button type='button' className='secondary-action' disabled={isInteractionLocked}>
              Bookmark
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default PinDetailsV2WIP;

