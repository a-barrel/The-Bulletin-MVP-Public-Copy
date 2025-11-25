import React from 'react';
import './PinPreviewCard.css';
import resolveAssetUrl, { resolveThumbnailUrl } from '../utils/media';
import { resolveAuthorAvatar, resolveAuthorName } from '../utils/feed';
import { formatDistanceMiles } from '../utils/geo';

const formatDateLabel = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatDistance = (distanceMiles) => {
  if (!Number.isFinite(distanceMiles)) {
    return null;
  }
  return formatDistanceMiles(distanceMiles, { withUnit: true });
};

const truncate = (value, max = 200) => {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

export default function PinPreviewCard({
  pin,
  distanceMiles,
  coordinateLabel,
  proximityRadiusMeters,
  createdAt,
  updatedAt,
  onViewPin,
  disableActions = false
}) {
  const safePin = pin || {};
  const title = safePin.title || 'Untitled pin';
  const type = typeof safePin.type === 'string' ? safePin.type.toLowerCase() : 'event';
  const isEvent = type === 'event' || type === 'pin';
  const pillClass = isEvent ? 'event' : 'discussion';
  const pillLabel = isEvent ? 'Event' : 'Discussion';
  const coverSource =
    safePin.coverPhoto?.url ||
    (Array.isArray(safePin.photos) && safePin.photos[0]?.url) ||
    (Array.isArray(safePin.images) && safePin.images[0]) ||
    null;
  const cover =
    coverSource && (resolveAssetUrl(coverSource) || resolveThumbnailUrl(coverSource) || coverSource);
  const avatarUrl = resolveAuthorAvatar(safePin);
  const creatorName = resolveAuthorName(safePin) || safePin.creator?.username || 'Unknown creator';
  const description = typeof safePin.description === 'string' ? safePin.description : '';
  const bookmarkCount =
    typeof safePin.bookmarkCount === 'number' ? safePin.bookmarkCount : safePin.stats?.bookmarkCount;
  const replyCount =
    typeof safePin.replyCount === 'number' ? safePin.replyCount : safePin.stats?.replyCount;
  const participantCount =
    typeof safePin.participantCount === 'number' ? safePin.participantCount : undefined;
  const limit =
    typeof safePin.participantLimit === 'number'
      ? safePin.participantLimit
      : safePin.milestones?.participantLimit;
  const distance = formatDistance(distanceMiles ?? safePin.distanceMiles);
  const pinId = safePin._id || safePin.id || 'draft';
  const createdLabel = formatDateLabel(createdAt || safePin.createdAt);
  const updatedLabel = formatDateLabel(updatedAt || safePin.updatedAt);
  const tags = Array.isArray(safePin.tags) ? safePin.tags.filter(Boolean).slice(0, 6) : [];

  const locationLabel = (() => {
    if (safePin.addressPrecise) return safePin.addressPrecise;
    if (safePin.approxFormatted) return safePin.approxFormatted;
    const cityState = [safePin.addressCity || safePin.approxCity, safePin.addressState || safePin.approxState]
      .filter(Boolean)
      .join(', ');
    if (cityState) return cityState;
    if (coordinateLabel) return coordinateLabel;
    if (safePin.latitude && safePin.longitude) {
      return `${safePin.latitude}, ${safePin.longitude}`;
    }
    return null;
  })();

  const scheduleLabel = (() => {
    const start = safePin.startDate || safePin.startsAt;
    const end = safePin.endDate || safePin.endsAt;
    const expires = safePin.expiresAt;
    const startLabel = formatDateLabel(start);
    const endLabel = formatDateLabel(end);
    if (startLabel && endLabel) {
      return `${startLabel} – ${endLabel}`;
    }
    if (startLabel || endLabel) {
      return startLabel || endLabel;
    }
    const expiresLabel = formatDateLabel(expires);
    return expiresLabel ? `Ends ${expiresLabel}` : null;
  })();

  const stats = [
    typeof participantCount === 'number'
      ? {
          label: 'Attending',
          value: `${participantCount}${limit ? ` / ${limit}` : ''}`
        }
      : null,
    typeof bookmarkCount === 'number'
      ? {
          label: 'Bookmarks',
          value: bookmarkCount
        }
      : null,
    typeof replyCount === 'number'
      ? {
          label: 'Replies',
          value: replyCount
        }
      : null
  ].filter(Boolean);

  const metaLine = [distance ? `Distance ${distance}` : null, createdLabel ? `Created ${createdLabel}` : null, updatedLabel ? `Updated ${updatedLabel}` : null]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="pin-preview-card pin-preview-card--postcard">
      <div className="pin-preview-card__body">
        <div className="pin-preview-card__title-row">
          <h3 className="pin-preview-card__title">{title}</h3>
          <div className={`pin-preview-card__pill ${pillClass}`}>{pillLabel}</div>
        </div>
        {distance ? <span className="pin-preview-card__distance">{distance}</span> : null}

        <div className="pin-preview-card__meta-block">
          {locationLabel ? (
            <div className="pin-preview-card__meta-line">
              <span className="pin-preview-card__meta-label">Location</span>
              <span className="pin-preview-card__meta-value">{locationLabel}</span>
            </div>
          ) : null}
          {scheduleLabel ? (
            <div className="pin-preview-card__meta-line">
              <span className="pin-preview-card__meta-label">{isEvent ? 'When' : 'Active'}</span>
              <span className="pin-preview-card__meta-value">{scheduleLabel}</span>
            </div>
          ) : null}
          {coordinateLabel ? (
            <div className="pin-preview-card__meta-line">
              <span className="pin-preview-card__meta-label">Coords</span>
              <span className="pin-preview-card__meta-value">{coordinateLabel}</span>
            </div>
          ) : null}
        </div>

        {tags.length ? (
          <div className="pin-preview-card__tags">
            {tags.map((tag) => (
              <span className="pin-preview-card__tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {description ? (
          <p className="pin-preview-card__description">{truncate(description, 220)}</p>
        ) : null}

        {stats.length ? (
          <div className="pin-preview-card__stats">
            {stats.map((stat) => (
              <div className="pin-preview-card__stat" key={stat.label}>
                <span className="pin-preview-card__stat-label">{stat.label}</span>
                <span className="pin-preview-card__stat-value">{stat.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pin-preview-card__footer">
          <div className="pin-preview-card__creator">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={creatorName ? `${creatorName}'s avatar` : 'Creator avatar'}
                className="pin-preview-card__creator-avatar"
              />
            ) : null}
            <div className="pin-preview-card__creator-text">
              <span className="pin-preview-card__creator-name">{creatorName}</span>
              {metaLine ? (
                <span className="pin-preview-card__creator-subline">{metaLine}</span>
              ) : null}
            </div>
          </div>
          {!disableActions && typeof onViewPin === 'function' ? (
            <div className="pin-preview-card__actions">
              <button
                type="button"
                className="pin-preview-card__button"
                onClick={() => onViewPin(pin)}
              >
                View pin
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="pin-preview-card__media">
        {cover ? (
          <img src={cover} alt={title} />
        ) : (
          <div className="pin-preview-card__media-fallback">No photo yet</div>
        )}
      </div>
    </div>
  );
}
