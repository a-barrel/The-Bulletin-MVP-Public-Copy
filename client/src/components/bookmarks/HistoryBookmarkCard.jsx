import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import resolveAssetUrl from '../../utils/media';
import { resolveUserAvatarUrl, DEFAULT_AVATAR_PATH } from '../../utils/pinFormatting';
import { formatSavedDate } from '../../utils/pinFormatting';

export default function HistoryBookmarkCard({ pin, viewedAt, imageUrl, onClick, actionSlot, testId }) {
  const title = pin?.title || 'Unavailable pin';
  const typeLabel =
    pin?.type === 'event' ? 'Event' : pin?.type === 'discussion' ? 'Discussion' : 'Pin';
  const hostName = pin?.creator?.displayName || pin?.creator?.username || 'Unknown host';
  const hostAvatar = resolveUserAvatarUrl(pin?.creator, DEFAULT_AVATAR_PATH) || DEFAULT_AVATAR_PATH;
  const isClickable = typeof onClick === 'function';
  const canonicalImage = imageUrl ? resolveAssetUrl(imageUrl) : null;
  const rawImage =
    canonicalImage ||
    resolveAssetUrl(pin?.coverPhoto) ||
    resolveAssetUrl(Array.isArray(pin?.mediaAssets) ? pin.mediaAssets[0] : null) ||
    resolveAssetUrl(Array.isArray(pin?.photos) ? pin.photos[0] : null) ||
    resolveAssetUrl(Array.isArray(pin?.images) ? pin.images[0] : null);
  const mediaSrc =
    rawImage && typeof rawImage === 'string' && !rawImage.includes('UNKNOWN_TEXTURE') ? rawImage : null;

  return (
    <Box
      onClick={() => (isClickable ? onClick(pin) : undefined)}
      className={`history-card${isClickable ? ' history-card--clickable' : ''}`}
      data-testid={testId}
    >
      <div className="history-card__row">
        <div className="history-card__content">
          <div className="history-card__header">
            <Typography variant="subtitle1" className="history-card__title">
              {title}
            </Typography>
            <span
              className={`history-card__badge ${
                pin?.type === 'discussion' ? 'history-card__badge--discussion' : ''
              }`}
            >
              {typeLabel}
            </span>
          </div>
          {viewedAt ? (
            <Typography variant="body2" className="history-card__meta">
              Viewed {formatSavedDate(viewedAt)}
            </Typography>
          ) : null}
          <Box className="history-card__host">
            <img className="history-card__avatar" src={hostAvatar} alt={`${hostName} avatar`} />
            <Box className="history-card__host-text">
              <div className="history-card__host-label">Hosted by</div>
              <div className="history-card__host-name">{hostName}</div>
            </Box>
            {actionSlot ? <div className="history-card__actions">{actionSlot}</div> : null}
          </Box>
        </div>
        <div
          className={`history-card__media${mediaSrc ? '' : ' history-card__media--placeholder'}`}
          aria-hidden={!mediaSrc}
        >
          {mediaSrc ? (
            <img src={mediaSrc} alt={`${title} preview`} loading="lazy" />
          ) : (
            <span className="history-card__media-fallback">Photo</span>
          )}
        </div>
      </div>
    </Box>
  );
}

HistoryBookmarkCard.propTypes = {
  pin: PropTypes.object,
  viewedAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
  imageUrl: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onClick: PropTypes.func,
  actionSlot: PropTypes.node,
  testId: PropTypes.string
};

HistoryBookmarkCard.defaultProps = {
  pin: null,
  viewedAt: null,
  imageUrl: null,
  onClick: null,
  actionSlot: null,
  testId: undefined
};
