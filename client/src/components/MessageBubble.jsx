import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { NavLink } from 'react-router-dom';
import AvatarIcon from '../assets/AvatarIcon.svg';
import "./MessageBubble.css";
import { formatFriendlyTimestamp, formatAbsoluteDateTime, formatRelativeTime } from '../utils/dates';
import GavelIcon from '@mui/icons-material/Gavel';
import ReportProblemIcon from '@mui/icons-material/ReportProblemOutlined';
import { ATTACHMENT_ONLY_PLACEHOLDER } from '../utils/chatAttachments';
import { resolveAvatarSrc } from '../utils/chatParticipants';
import { ensureImageSrc, withFallbackOnError } from '../utils/imageFallback';
import FriendBadge from './FriendBadge';


function MessageBubble({ msg, isSelf, authUser, canModerate = false, onModerate, onReport }) {
  const rawMessage = typeof msg?.message === 'string' ? msg.message : '';
  const strippedMessage = rawMessage.replace(/^GIF:\s*/i, '').trim();
  const isAttachmentOnly = rawMessage === ATTACHMENT_ONLY_PLACEHOLDER;
  const attachments = Array.isArray(msg?.attachments) ? msg.attachments : [];
  const imageAssets = attachments
    .map((asset, index) => ({
      key: asset._id || `${asset.url || 'attachment'}-${index}`,
      url: ensureImageSrc(asset?.url),
      alt:
        asset?.description ||
        (isAttachmentOnly
          ? 'Chat attachment'
          : strippedMessage
            ? `Attachment for message "${strippedMessage}"`
            : rawMessage
              ? `Attachment for message "${rawMessage}"`
              : 'Chat attachment')
    }))
    .filter((asset) => typeof asset.url === 'string' && asset.url.trim().length > 0);

  if (!imageAssets.length && msg?.imageUrl) {
    imageAssets.push({
      key: msg.imageUrl,
      url: ensureImageSrc(msg.imageUrl),
      alt: isAttachmentOnly
        ? 'Chat attachment'
        : strippedMessage
          ? `Attachment for message "${strippedMessage}"`
          : rawMessage
            ? `Attachment for message "${rawMessage}"`
            : 'Chat attachment'
    });
  }

  const displayMessage = (() => {
    if (!rawMessage || isAttachmentOnly) {
      return '';
    }
    if (imageAssets.length === 0) {
      return rawMessage;
    }
    return strippedMessage;
  })();

  const authorId =
    typeof msg?.authorId === 'string'
      ? msg.authorId
      : typeof msg?.authorId === 'object' && msg.authorId !== null && '$oid' in msg.authorId
        ? msg.authorId.$oid
        : typeof msg?.author?._id === 'string'
          ? msg.author._id
          : typeof msg?.author?._id === 'object' && msg.author._id !== null && '$oid' in msg.author._id
            ? msg.author._id.$oid
            : null;

  const profileHref =
    isSelf || (authUser && authorId && authUser.uid === authorId)
      ? '/profile/me'
      : authorId
        ? `/profile/${authorId}`
        : '/profile/me';

  const resolvedAvatarSrc = ensureImageSrc(resolveAvatarSrc(msg?.author) || AvatarIcon);

  return (
    <Box className={`chat-message ${isSelf ? 'self' : ''}`}>
      <Box className="chat-avatar">
        <NavLink to={profileHref} className="nav-item">
          <img
            src={resolvedAvatarSrc}
            alt={
              msg?.author?.displayName
                ? `${msg.author.displayName}'s avatar`
                : 'Chat avatar'
            }
            className="profile-icon"
            onError={withFallbackOnError}
          />
        </NavLink>
      </Box>

      <Box className="chat-text-area">
        <div className="chat-text-area-header">
          <Typography className="chat-author">
            {msg.author?.displayName || 'User'}
            <FriendBadge userId={authorId} />
          </Typography>
          <div className="chat-header-meta">
            <Typography
              className="chat-time"
              title={formatAbsoluteDateTime(msg.createdAt) || undefined}
            >
              {formatFriendlyTimestamp(msg.createdAt) || formatRelativeTime(msg.createdAt) || ''}
            </Typography>
            {!isSelf && typeof onReport === 'function' ? (
              <Tooltip title="Report message">
                <span>
                  <IconButton
                    className="chat-report-btn"
                    size="small"
                    aria-label="Report this message"
                    onClick={() => onReport(msg)}
                    sx={{
                      ml: 0.5,
                      color: '#d84315',
                      backgroundColor: 'rgba(216, 67, 21, 0.12)',
                      borderRadius: '8px',
                      transition: 'color 120ms ease, background-color 120ms ease',
                      '&:hover, &:focus-visible': {
                        color: '#ef6c00',
                        backgroundColor: 'rgba(239, 108, 0, 0.16)'
                      }
                    }}
                  >
                    <ReportProblemIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
            {canModerate && !isSelf && typeof onModerate === 'function' ? (
              <Tooltip title="Moderate user">
                <span>
                  <IconButton
                    className="chat-moderation-btn"
                    size="small"
                    aria-label="Moderate this user"
                    onClick={() => onModerate(msg)}
                    sx={{
                      ml: 0.5,
                      color: '#1e6ef5',
                      backgroundColor: 'rgba(30, 110, 245, 0.12)',
                      borderRadius: '8px',
                      transition: 'color 120ms ease, background-color 120ms ease',
                      '&:hover, &:focus-visible': {
                        color: '#7c4dff',
                        backgroundColor: 'rgba(124, 77, 255, 0.16)'
                      }
                    }}
                  >
                    <GavelIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          </div>
        </div>
        {displayMessage ? (
          <Typography className="chat-text">{displayMessage}</Typography>
        ) : null}
        {imageAssets.map((asset) => (
          <img
            key={asset.key}
            src={asset.url}
            alt={asset.alt}
            className="chat-image"
            loading="lazy"
            onError={withFallbackOnError}
          />
        ))}
      </Box>
    </Box>
  );
}

export default MessageBubble;
