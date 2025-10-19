import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './PinDetails.css';
import PlaceIcon from '@mui/icons-material/Place'; // used only for pageConfig
import LeafletMap from '../components/Map';
import runtimeConfig from '../config/runtime';
import { fetchPinById, fetchReplies } from '../api/mongoDataApi';

export const pageConfig = {
  id: 'pin-details',
  label: 'Pin Details',
  icon: PlaceIcon,
  path: '/pin/:pinId',
  order: 3,
  showInNav: true,
  resolveNavTarget: () => {
    const input = window.prompt('Enter a pin ID to view in Pin Details:');
    if (typeof input !== 'string') {
      return null;
    }
    const trimmed = input.trim();
    return trimmed.length > 0 ? `/pin/${trimmed}` : null;
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

function PinDetails() {
  const { pinId } = useParams();
  const [pin, setPin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [attending, setAttending] = useState(false);
  const [replies, setReplies] = useState([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [repliesError, setRepliesError] = useState(null);

  useEffect(() => {
    setBookmarked(false);
    setAttending(false);
  }, [pinId]);

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
        const payload = await fetchPinById(pinId);
        if (ignore) {
          return;
        }
        setPin(payload);
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
  }, [pinId]);

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
        setReplies(Array.isArray(payload) ? payload : []);
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

  const expirationLabel = useMemo(() => formatDateTime(pin?.expiresAt), [pin]);
  const createdAtLabel = useMemo(() => formatDateTime(pin?.createdAt), [pin]);
  const updatedAtLabel = useMemo(() => formatDateTime(pin?.updatedAt), [pin]);

  return (
    <div className='pin-details'>
      {/* Header */}
      <header className='header'>
        <Link to="/list" className="back-button">
          <img
            src='https://www.svgrepo.com/show/326886/arrow-back-sharp.svg'
            className='back-arrow'
          />
        </Link>

        <h2>{pin ? pin.type.charAt(0).toUpperCase() + pin.type.slice(1) : 'Loading...'}</h2>

        <button
          className='bookmark-button'
          onClick={() => setBookmarked(!bookmarked)}
        >
          <img
            src={
              bookmarked
                ? 'https://www.svgrepo.com/show/347684/bookmark-fill.svg' // bookmarked
                : 'https://www.svgrepo.com/show/357397/bookmark-full.svg' // not bookmarked
            }
            className='bookmark'
          />
        </button>
      </header>

      {/* Event/Discussion Name */}
      <div className='name'>
        <h2>{pin ? pin.title || 'Untitled pin' : 'Loading pin...'}</h2>
        {pin?._id ? <span className="pin-id">ID: {pin._id}</span> : null}
        {proximityRadius ? (
          <span className="pin-radius">Proximity radius: {proximityRadius}</span>
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
                <br />
                Replies: {pin.replyCount ?? pin.stats?.replyCount ?? 0}
                {pin.type === 'event' ? (
                  <>
                    <br />
                    Attending: {pin.participantCount ?? 0}
                    {pin.participantLimit ? ` / ${pin.participantLimit}` : ''}
                  </>
                ) : null}
              </span>
            </div>
          </div>

          {/* Attend button */}
          <div className='attendance'>
            <button
              className={`attend-button ${attending ? 'attending' : ''}`}
              onClick={() => setAttending(!attending)}
            >
              {attending ? 'Attending!' : 'Attend'}
            </button>
          </div>

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
                        <span className="comment-timestamp">{createdLabel}</span>
                      ) : null}
                    </span>
                  </div>

                  <div className='comment-body'>
                    <p>{reply.message}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Create comment button */}
          <button className='create-comment'>
            <img
              src='https://www.svgrepo.com/show/489238/add-comment.svg'
              className='create-comment-button'
              alt='Create comment button'
            />
          </button>

        </>
      ) : null}
    </div>
  );
}

export default PinDetails;
