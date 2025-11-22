import { useMemo } from 'react';
import { formatDateTime } from '../../utils/dates';

const PIN_TYPE_COPY = {
  event: {
    pill: 'Event',
    defaultTitle: 'Give your event a title',
    defaultDescription: 'Share what makes this event special.',
    meta: 'Hosting an event'
  },
  discussion: {
    pill: 'Discussion',
    defaultTitle: 'What are we discussing?',
    defaultDescription: 'Describe what people should talk about.',
    meta: 'Starting a discussion'
  }
};

const resolveTimeLabel = (pinType, formState) => {
  if (pinType === 'event') {
    if (!formState.startDate) {
      return 'Pick a start time';
    }
    const starts = formatDateTime(formState.startDate, {
      fallback: null,
      options: { dateStyle: 'medium', timeStyle: 'short' }
    });
    if (formState.endDate) {
      const ends = formatDateTime(formState.endDate, {
        fallback: null,
        options: { dateStyle: 'medium', timeStyle: 'short' }
      });
      if (starts && ends) {
        return `${starts} → ${ends}`;
      }
    }
    return starts || 'Pick a start time';
  }

  if (formState.expiresAt) {
    return formatDateTime(formState.expiresAt, {
      fallback: 'Set expiration',
      options: { dateStyle: 'medium', timeStyle: 'short' }
    });
  }
  return 'Set expiration';
};

const resolveLocationLabel = (pinType, formState) => {
  if (pinType === 'event') {
    if (formState.addressPrecise) {
      return formState.addressPrecise;
    }
    const parts = [formState.addressCity, formState.addressState]
      .map((value) => (value || '').trim())
      .filter(Boolean);
    return parts.length ? parts.join(', ') : 'Set the event location';
  }

  if (formState.approxFormatted) {
    return formState.approxFormatted;
  }
  const parts = [formState.approxCity, formState.approxState]
    .map((value) => (value || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : 'Describe where this takes place';
};

const resolveCoverPhoto = (photoAssets = [], coverPhotoId) => {
  if (!Array.isArray(photoAssets) || photoAssets.length === 0) {
    return null;
  }
  if (coverPhotoId) {
    const cover = photoAssets.find((photo) => photo.id === coverPhotoId && photo.asset?.url);
    if (cover) {
      return cover.asset.url;
    }
  }
  return photoAssets.find((photo) => photo.asset?.url)?.asset?.url ?? null;
};

function PinPreviewCard({
  pinType,
  formState,
  viewerName,
  viewerAvatarUrl,
  photoAssets,
  coverPhotoId,
  pinDistanceLabel
}) {
  const copy = PIN_TYPE_COPY[pinType] ?? PIN_TYPE_COPY.event;
  const coverPhotoUrl = useMemo(
    () => resolveCoverPhoto(photoAssets, coverPhotoId),
    [photoAssets, coverPhotoId]
  );
  const title = formState.title?.trim() || copy.defaultTitle;
  const description = formState.description?.trim() || copy.defaultDescription;
  const timeLabel = resolveTimeLabel(pinType, formState);
  const locationLabel = resolveLocationLabel(pinType, formState);

  return (
    <div className="pin-preview-card">
      {coverPhotoUrl ? (
        <div
          className="pin-preview-card__media"
          style={{ backgroundImage: `url(${coverPhotoUrl})` }}
          aria-label="Selected cover photo preview"
        />
      ) : null}
      <div className="pin-preview-card__body">
        <div className="pin-preview-card__author">
          <img src={viewerAvatarUrl} alt="" />
          <div>
            <span className="pin-preview-card__author-name">{viewerName}</span>
            <span className="pin-preview-card__author-meta">{copy.meta}</span>
          </div>
          <span className="pin-preview-card__pill">{copy.pill}</span>
        </div>
        <div className="pin-preview-card__content">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <ul className="pin-preview-card__details">
          <li>
            <span className="pin-preview-card__detail-label">When</span>
            <span className="pin-preview-card__detail-value">{timeLabel}</span>
          </li>
          <li>
            <span className="pin-preview-card__detail-label">Where</span>
            <span className="pin-preview-card__detail-value">{locationLabel}</span>
          </li>
          {pinDistanceLabel ? (
            <li>
              <span className="pin-preview-card__detail-label">Distance</span>
              <span className="pin-preview-card__detail-value">{pinDistanceLabel}</span>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

export default PinPreviewCard;
