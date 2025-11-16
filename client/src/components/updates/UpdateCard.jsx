import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/CancelRounded';
import DropDownArrow from '@mui/icons-material/ArrowForwardIosRounded';
import { formatRelativeTime } from '../../utils/dates';
import { routes } from '../../routes';

function UpdateCard({
  update,
  expanded,
  onToggleExpand,
  onMarkRead,
  onDeleteUpdate,
  pending,
  isDeleting,
  resolveBadgeImageUrl
}) {
  const read = Boolean(update.readAt);
  const message = update.payload?.body;
  const pinTitle = update.payload?.pin?.title;
  const pinId = update.payload?.pin?._id;
  const typeKey = update.payload?.type ?? 'update';
  const displayTypeLabel = typeKey.replace(/-/g, ' ');
  const isBadgeUpdate = typeKey === 'badge-earned';
  const badgeImage = update.payload?.metadata?.badgeImage;
  const badgeImageUrl = badgeImage ? resolveBadgeImageUrl(badgeImage) : null;
  const createdAt = update.createdAt;

  return (
    <Box className="update-card" onClick={() => onToggleExpand(update._id)}>
      <Box className="update-header">
        <Chip label={displayTypeLabel} size="small" color={read ? 'secondary' : 'secondary'} />

        {pinTitle ? (
          <Typography className="pin-title" size="small" color="black" variant="outlined">
            {pinTitle}
          </Typography>
        ) : null}

        <Typography className="update-time">{formatRelativeTime(createdAt) || ''}</Typography>

        {!read && <span className="unread-dot" />}
      </Box>

      <Typography className="update-title">{update.payload?.title}</Typography>

      {message ? <Typography className="update-message">{message}</Typography> : null}

      {update.payload?.avatars?.length > 0 ? (
        <Box className="avatar-row">
          {update.payload.avatars.map((src, idx) => (
            <img key={idx} src={src} alt="participant" className="avatar" />
          ))}
        </Box>
      ) : null}

      {isBadgeUpdate && badgeImageUrl ? (
        <Box
          component="img"
          src={badgeImageUrl || undefined}
          alt={
            update.payload?.metadata?.badgeId
              ? `${update.payload.metadata.badgeId} badge`
              : 'Badge earned'
          }
          sx={{
            width: { xs: 96, sm: 128 },
            height: { xs: 96, sm: 128 },
            borderRadius: 3,
            alignSelf: 'flex-start',
            border: (theme) => `1px solid ${theme.palette.divider}`,
            objectFit: 'cover',
            mt: 2
          }}
        />
      ) : null}

      <Box className="drop-down-arrow-container">
        <DropDownArrow
          className="update-action-drop-down-indicator-arrow"
          sx={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </Box>

      <Box
        className="update-action-container"
        sx={{
          maxHeight: expanded ? 200 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease, opacity 0.3s ease',
          opacity: expanded ? 1 : 0,
          mt: expanded ? 1.5 : 0
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {pinId ? (
          <Button component={Link} to={routes.pin.byId(pinId)} className="view-pin-btn">
            View
          </Button>
        ) : null}

        {!read ? (
          <Button
            className="mark-as-read-btn"
            startIcon={<CheckCircleOutlineIcon className="read-icon" fontSize="small" />}
            onClick={() => onMarkRead(update._id)}
            disabled={pending || isDeleting}
          >
            {pending ? 'Marking...' : 'Mark as read'}
          </Button>
        ) : null}

        <Button
          className="delete-update-btn"
          startIcon={<CloseIcon className="delete-icon" fontSize="small" />}
          onClick={() => onDeleteUpdate(update._id)}
          disabled={pending || isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </Box>
    </Box>
  );
}

export default UpdateCard;
