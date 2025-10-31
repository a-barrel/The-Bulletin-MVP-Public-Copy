import { Box, Typography } from '@mui/material';
import { NavLink } from 'react-router-dom';
import AvatarIcon from '../assets/AvatarIcon.svg';
import "./MessageBubble.css";
import { formatFriendlyTimestamp } from '../utils/dates';



function MessageBubble({ msg, isSelf, authUser }) {
  const rawMessage = typeof msg?.message === 'string' ? msg.message : '';
  const strippedMessage = rawMessage.replace(/^GIF:\s*/i, '').trim();
  const attachments = Array.isArray(msg?.attachments) ? msg.attachments : [];
  const imageAssets = attachments
    .map((asset, index) => ({
      key: asset._id || `${asset.url || 'attachment'}-${index}`,
      url: asset?.url,
      alt:
        asset?.description ||
        (strippedMessage
          ? `Attachment for message "${strippedMessage}"`
          : rawMessage
            ? `Attachment for message "${rawMessage}"`
            : 'Chat attachment')
    }))
    .filter((asset) => typeof asset.url === 'string' && asset.url.trim().length > 0);

  if (!imageAssets.length && msg?.imageUrl) {
    imageAssets.push({
      key: msg.imageUrl,
      url: msg.imageUrl,
      alt: strippedMessage
        ? `Attachment for message "${strippedMessage}"`
        : rawMessage
          ? `Attachment for message "${rawMessage}"`
          : 'Chat attachment'
    });
  }

  const displayMessage = (() => {
    if (!rawMessage) {
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

  const avatarUrl = msg?.author?.avatar?.url;
  const resolvedAvatarSrc =
    typeof avatarUrl === 'string' && avatarUrl.trim()
      ? avatarUrl.trim().startsWith('http') || avatarUrl.trim().startsWith('data:')
        ? avatarUrl.trim()
        : `/${avatarUrl.trim().replace(/^\/+/, '')}`
      : AvatarIcon;

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
          />
        </NavLink>
      </Box>

      <Box className="chat-text-area">
        <div className="chat-text-area-header">
          <Typography className="chat-author">
            {msg.author?.displayName || 'User'}
          </Typography>
          <Typography className="chat-time">
            {formatFriendlyTimestamp(msg.createdAt)}
          </Typography>
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
          />
        ))}
      </Box>
    </Box>
  );
}

export default MessageBubble;
