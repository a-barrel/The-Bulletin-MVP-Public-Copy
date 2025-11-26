import React from 'react';
import './PinPreviewCard.css';
import resolveAssetUrl, { resolveThumbnailUrl } from '../utils/media';
import { resolveAuthorAvatar, resolveAuthorName } from '../utils/feed';
import { formatDistanceMiles } from '../utils/geo';
import BookmarkButton from './BookmarkButton';
import FlagIcon from '@mui/icons-material/Flag';

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

const formatMonthYear = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const resolveCount = (value) => {
  if (Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.length;
  return null;
};

const truncate = (value, max = 200) => {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

/**
 * PinPreviewCard props (reusable):
 * - pin: pin data object (required for content)
 * - distanceMiles / coordinateLabel / proximityRadiusMeters: optional geo metadata display
 * - createdAt / updatedAt: optional timestamps for meta line
 * - onView: optional handler for the primary View action (defaults to onViewPin legacy prop)
 * - onBookmark: optional handler for bookmark action (optional future use)
 * - disableActions: hides actions even if handlers are provided
 * - actionsSlot: optional custom actions node; if absent and no handlers, actions are hidden by default
 */

export default function PinPreviewCard({
  pin,
  distanceMiles,
  coordinateLabel,
  proximityRadiusMeters,
  createdAt,
  updatedAt,
  isBookmarked = false,
  bookmarkPending = false,
  viewerOwnsPin = false,
  viewerIsAttending = false,
  onFlag,
  onView,
  onBookmark,
  onCreatorClick,
  actionsSlot,
  onViewPin,
  className,
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
  const participantCountRaw =
    safePin.participantCount ??
    safePin.stats?.participantCount ??
    safePin.participants ??
    safePin.stats?.participants;
  const participantCount = resolveCount(participantCountRaw);
  const bookmarkCountRaw = safePin.bookmarkCount ?? safePin.stats?.bookmarkCount;
  const replyCountRaw = safePin.replyCount ?? safePin.stats?.replyCount;
  const bookmarkCount = resolveCount(bookmarkCountRaw) ?? 0;
  const replyCount = resolveCount(replyCountRaw) ?? 0;
  const limit =
    typeof safePin.participantLimit === 'number'
      ? safePin.participantLimit
      : safePin.milestones?.participantLimit;
  const distance = formatDistance(distanceMiles ?? safePin.distanceMiles);
  const pinId = safePin._id || safePin.id || 'draft';
  const createdLabel = formatMonthYear(createdAt || safePin.createdAt);
  const updatedLabel = formatDateLabel(updatedAt || safePin.updatedAt);
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

  const computedViewerOwnsPin =
    viewerOwnsPin || Boolean(safePin.viewerOwnsPin || safePin.viewerIsCreator || safePin.isSelf);
  const computedViewerIsAttending =
    viewerIsAttending || Boolean(safePin.viewerIsAttending || safePin.viewerIsParticipant);

  const friendsGoingRaw =
    safePin.friendsGoing ??
    safePin.friendsGoingCount ??
    safePin.friendsAttending ??
    safePin.friendCount ??
    safePin.viewerFriendsGoing ??
    safePin.stats?.friendsGoing ??
    safePin.stats?.friendsGoingCount ??
    safePin.stats?.friendsAttending ??
    safePin.stats?.friendCount ??
    safePin.stats?.viewerFriendsGoing;
  const friendsGoing = resolveCount(friendsGoingRaw);
  const friendsGoingPending =
    Boolean(safePin.friendsGoingPending) ||
    (friendsGoingRaw === null || typeof friendsGoingRaw === 'undefined') ||
    friendsGoing === null;
  const friendsGoingDisplay = friendsGoingPending ? '—' : friendsGoing ?? 0;
  const attendingPending = participantCount === null && limit === undefined;
  const attendingDisplay =
    participantCount !== null
      ? `${participantCount}${limit ? ` / ${limit}` : ''}`
      : limit !== undefined
      ? `— / ${limit}`
      : '—';

  const stats = [
    {
      label: 'Attending',
      value: attendingPending ? '—' : attendingDisplay
    },
    {
      label: 'Friends Going',
      value: friendsGoingDisplay
    },
    {
      label: 'Bookmarks',
      value: bookmarkCount
    },
    {
      label: 'Replies',
      value: replyCount
    }
  ];

  const metaLine = [distance ? `Distance ${distance}` : null, createdLabel ? `Created ${createdLabel}` : null]
    .filter(Boolean)
    .join(' • ');

  const viewHandler = typeof onView === 'function' ? onView : onViewPin;
  const showViewAction = !disableActions && typeof viewHandler === 'function';
  const showBookmarkAction = !disableActions && typeof onBookmark === 'function';
  const hasActions = !disableActions && (actionsSlot || showViewAction || showBookmarkAction);
  const bookmarkLabel = isBookmarked ? 'Unbookmark' : 'Bookmark';
  const rootClassName = [
    'pin-preview-card',
    'pin-preview-card--postcard',
    isEvent ? 'pin-preview-card--event' : 'pin-preview-card--discussion',
    className
  ]
    .filter(Boolean)
    .join(' ');
  const creatorClickable = typeof onCreatorClick === 'function';

  const handleCreatorClick = (event) => {
    if (!creatorClickable) return;
    event?.stopPropagation?.();
    onCreatorClick(pin);
  };

  const handleCreatorKeyDown = (event) => {
    if (!creatorClickable) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onCreatorClick(pin);
    }
  };

  return (
    <div className={rootClassName}>
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
          <div
            className={`pin-preview-card__creator${creatorClickable ? ' pin-preview-card__creator--clickable' : ''}`}
            onClick={handleCreatorClick}
            role={creatorClickable ? 'button' : undefined}
            tabIndex={creatorClickable ? 0 : undefined}
            onKeyDown={handleCreatorKeyDown}
          >
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
          {hasActions ? (
            <div className="pin-preview-card__actions">
              {actionsSlot}
              {!actionsSlot && showViewAction ? (
                <>
                  <button
                    type="button"
                    className="pin-preview-card__flag-button"
                    onClick={(event) => {
                      event?.stopPropagation?.();
                      if (typeof onFlag === 'function' && !computedViewerOwnsPin) {
                        onFlag(pin);
                      }
                    }}
                    aria-label={
                      computedViewerOwnsPin ? "You can't flag your own pin" : 'Flag pin'
                    }
                    title={computedViewerOwnsPin ? "You can't flag your own pin" : 'Flag pin'}
                    disabled={computedViewerOwnsPin}
                    aria-hidden="false"
                    style={{ color: '#d32f2f' }}
                  >
                    <FlagIcon fontSize="small" />
                  </button>
                  <button
                    type="button"
                    className="pin-preview-card__button"
                    onClick={() => viewHandler(pin)}
                  >
                    View
                  </button>
                </>
              ) : null}
              {!actionsSlot && showBookmarkAction ? (
                <div className="bookmark-button-wrapper">
                  <BookmarkButton
                    variant="card"
                    bookmarked={Boolean(isBookmarked)}
                    pending={bookmarkPending}
                    ownsPin={computedViewerOwnsPin}
                    attending={computedViewerIsAttending}
                    autoLockAttending={false}
                    ownerLockLabel="You can't unbookmark your own pin"
                    lockedLabel="You can't unbookmark your own pin"
                    onToggle={(event) => {
                      event?.stopPropagation?.();
                      onBookmark(pin);
                    }}
                  />
                </div>
              ) : null}
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
