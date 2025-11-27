import { Box, Typography, IconButton, Tooltip, Button } from '@mui/material';
import { NavLink, Link } from 'react-router-dom';
import AvatarIcon from '../assets/AvatarIcon.svg';
import "./MessageBubble.css";
import { formatFriendlyTimestamp, formatAbsoluteDateTime, formatRelativeTime } from '../utils/dates';
import GavelIcon from '@mui/icons-material/Gavel';
import ReportProblemIcon from '@mui/icons-material/ReportProblemOutlined';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import { ATTACHMENT_ONLY_PLACEHOLDER } from '../utils/chatAttachments';
import { resolveAvatarSrc } from '../utils/chatParticipants';
import { ensureImageSrc, withFallbackOnError } from '../utils/imageFallback';
import FriendBadge from './FriendBadge';
import { routes } from '../routes';
import { useTranslation } from 'react-i18next';
import { CHAT_REACTION_OPTIONS } from '../constants/chatReactions';
import { useEffect, useMemo, useState } from 'react';


function MessageBubble({
  msg,
  isSelf,
  authUser,
  canModerate = false,
  onModerate,
  onReport,
  onToggleReaction
}) {
  const { t } = useTranslation();
  const rawMessage = typeof msg?.message === 'string' ? msg.message : '';
  const strippedMessage = rawMessage.replace(/^GIF:\s*/i, '').trim();
  const isAttachmentOnly = rawMessage === ATTACHMENT_ONLY_PLACEHOLDER;
  const attachments = Array.isArray(msg?.attachments) ? msg.attachments : [];
  const pinShares = [];
  const imageAssets = [];
  attachments.forEach((asset, index) => {
    const desc = typeof asset?.description === 'string' ? asset.description : '';
    let parsedPin = null;
    if (desc.startsWith('PINSHARE:')) {
      const payload = desc.slice('PINSHARE:'.length);
      try {
        const meta = JSON.parse(payload);
        if (meta && (meta.pinId || meta.link)) {
          parsedPin = {
            id: meta.pinId || meta.link || index,
            title: meta.title || 'Shared pin',
            type: meta.type || 'pin',
            link: meta.link || (meta.pinId ? routes.pin.byId(meta.pinId) : null),
            location: meta.location || null,
            thumb: meta.thumb || null
          };
        }
      } catch {
        // ignore parse errors, treat as regular attachment
      }
    }
    if (parsedPin) {
      pinShares.push({
        key: asset._id || parsedPin.id || `${asset.url || 'pin'}-${index}`,
        pin: parsedPin,
        thumb: parsedPin.thumb || ensureImageSrc(asset?.url)
      });
      return;
    }
    const url = ensureImageSrc(asset?.url);
    if (typeof url === 'string' && url.trim().length > 0) {
      imageAssets.push({
        key: asset._id || `${asset.url || 'attachment'}-${index}`,
        url,
        alt:
          asset?.description ||
          (isAttachmentOnly
            ? 'Chat attachment'
            : strippedMessage
              ? `Attachment for message "${strippedMessage}"`
              : rawMessage
                ? `Attachment for message "${rawMessage}"`
                : 'Chat attachment')
      });
    }
  });

  if (!imageAssets.length && !pinShares.length && msg?.imageUrl) {
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

  const formatLocation = (pin) => {
    const approx = pin?.approximateAddress;
    if (approx && typeof approx === 'object') {
      if (typeof approx.formatted === 'string' && approx.formatted.trim()) {
        return approx.formatted.trim();
      }
      const parts = [approx.city, approx.state, approx.country].filter(
        (part) => typeof part === 'string' && part.trim()
      );
      if (parts.length) {
        return parts.join(', ');
      }
    }
    const addr = pin?.address;
    if (!addr) {
      const loc = pin?.location || null;
      if (typeof loc === 'string' && loc.trim()) {
        return loc.trim();
      }
      if (loc && typeof loc === 'object') {
        if (typeof loc.formatted === 'string' && loc.formatted.trim()) {
          return loc.formatted.trim();
        }
        const parts = [loc.line1, loc.city, loc.state, loc.country, loc.postalCode].filter(
          (part) => typeof part === 'string' && part.trim()
        );
        if (!parts.length && loc.components && typeof loc.components === 'object') {
          const nested = [loc.components.line1, loc.components.city, loc.components.state, loc.components.country]
            .filter((part) => typeof part === 'string' && part.trim());
          if (nested.length) {
            return nested.join(', ');
          }
        }
        if (parts.length) {
          return parts.join(', ');
        }
      }
      if (typeof pin?.locationLabel === 'string' && pin.locationLabel.trim()) {
        return pin.locationLabel.trim();
      }
      return null;
    }
    if (typeof addr === 'string' && addr.trim()) {
      return addr.trim();
    }
    if (typeof addr === 'object') {
      if (typeof addr.formatted === 'string' && addr.formatted.trim()) {
        return addr.formatted.trim();
      }
      const parts = [addr.line1, addr.city, addr.state, addr.country, addr.postalCode]
        .filter((part) => typeof part === 'string' && part.trim());
      if (!parts.length && addr.components && typeof addr.components === 'object') {
        const nested = [addr.components.line1, addr.components.city, addr.components.state, addr.components.country]
          .filter((part) => typeof part === 'string' && part.trim());
        if (nested.length) {
          return nested.join(', ');
        }
      }
      if (parts.length) {
        return parts.join(', ');
      }
    }
    return null;
  };

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

  const reactionCounts =
    msg?.reactions && typeof msg.reactions === 'object' ? msg.reactions.counts || {} : {};
  const viewerReactions =
    msg?.reactions && Array.isArray(msg.reactions.viewerReactions)
      ? msg.reactions.viewerReactions
      : msg?.reactions?.viewerReaction
        ? [msg.reactions.viewerReaction]
        : [];
  const hasReactions = useMemo(
    () => Object.entries(reactionCounts || {}).some(([, value]) => Number(value) > 0),
    [reactionCounts]
  );
  const hasViewerReaction = viewerReactions.length > 0;
  const [isReactionPickerOpen, setReactionPickerOpen] = useState(false);

  const optionsToRender = useMemo(() => {
    if (isReactionPickerOpen) {
      return CHAT_REACTION_OPTIONS;
    }
    return CHAT_REACTION_OPTIONS.filter(
      (option) => Number(reactionCounts?.[option.key]) > 0
    );
  }, [isReactionPickerOpen, reactionCounts]);

  const showReactions =
    isReactionPickerOpen || optionsToRender.length > 0 || hasViewerReaction || hasReactions;

  if (msg?.isSystem || msg?.messageType === 'system-checkin') {
    return (
      <Box className="chat-message system">
        <Box className="chat-system-text">
          <Typography className="chat-system-label">
            {msg?.messageType === 'system-checkin' ? 'Check-in' : 'System'}
          </Typography>
          <Typography className="chat-system-body">{rawMessage}</Typography>
          <Typography className="chat-system-time">
            {formatFriendlyTimestamp(msg?.createdAt || msg?.timestamp, t)}
          </Typography>
        </Box>
      </Box>
    );
  }

  const profileHref =
    isSelf || (authUser && authorId && authUser.uid === authorId)
      ? '/profile/me'
      : authorId
        ? `/profile/${authorId}`
        : '/profile/me';

  const resolvedAvatarSrc = ensureImageSrc(resolveAvatarSrc(msg?.author) || AvatarIcon);
  const messageId = msg?._id || msg?.id;

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
              <Tooltip title={t('tooltips.reportMessage')}>
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
            {typeof onToggleReaction === 'function' ? (
              <Tooltip title="React to this message">
                <span>
                  <IconButton
                    className="chat-reaction-btn"
                    size="small"
                    aria-label="React to this message"
                    onClick={() => setReactionPickerOpen((prev) => !prev)}
                    sx={{
                      ml: 0.5,
                      color: '#5d3889',
                      backgroundColor: 'rgba(93, 56, 137, 0.12)',
                      borderRadius: '8px',
                      transition: 'color 120ms ease, background-color 120ms ease',
                      '&:hover, &:focus-visible': {
                        color: '#7c4dff',
                        backgroundColor: 'rgba(124, 77, 255, 0.16)'
                      }
                    }}
                  >
                    <EmojiEmotionsIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
            {canModerate && !isSelf && typeof onModerate === 'function' ? (
              <Tooltip title={t('tooltips.moderateUser')}>
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
        {pinShares.length > 0 ? (
          <Box className="chat-pin-share-stack">
            {pinShares.map((share, index) => {
              const pin = share.pin || share;
              const pinId =
                pin?.pinId ||
                pin?._id ||
                (typeof pin?.id === 'string' ? pin.id : null) ||
                (typeof pin?.pin_id === 'string' ? pin.pin_id : null);
              const href = pinId ? routes.pin.byId(pinId) : null;
              const locationLabel = formatLocation(pin);
              const thumb = share.thumb || pin.thumb || null;
              return (
                <Box key={share._id || pinId || index} className="chat-pin-share-card">
                  <Box className="chat-pin-card-row">
                    <Box className="chat-pin-card-body">
                      <Typography variant="subtitle2" fontWeight={700} className="chat-pin-title">
                        {pin?.title || 'Shared pin'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#0f172a' }}>
                        {pin?.type === 'event' ? 'Event' : 'Discussion'}
                        {locationLabel ? ` · ${locationLabel}` : ''}
                      </Typography>
                      {href ? (
                        <Button
                          component={Link}
                          to={href}
                          variant="outlined"
                          size="small"
                          className="chat-pin-view-btn"
                          sx={{
                            color: '#1d4ed8',
                            borderColor: '#1d4ed8',
                            fontWeight: 700,
                            textTransform: 'none'
                          }}
                        >
                          View pin
                        </Button>
                      ) : null}
                    </Box>
                    {thumb ? (
                      <Box className="chat-pin-thumb-wrapper">
                        <Box component="img" src={thumb} alt="" className="chat-pin-thumb-vertical" />
                      </Box>
                    ) : null}
                  </Box>
                </Box>
              );
            })}
          </Box>
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
        {showReactions ? (
          <Box className="chat-reaction-row">
            {optionsToRender.map((option) => {
              const count = Number(reactionCounts?.[option.key]) || 0;
              const isActive = viewerReactions.includes(option.key);
              const handleClick = () => {
                if (typeof onToggleReaction === 'function' && messageId) {
                  onToggleReaction(messageId, option.key);
                }
              };
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`chat-reaction-pill ${isActive ? 'active' : ''}`}
                  onClick={handleClick}
                  disabled={typeof onToggleReaction !== 'function'}
                  aria-pressed={isActive}
                  aria-label={
                    count > 0
                      ? `${option.label} reaction, ${count}`
                      : `${option.label} reaction`
                  }
                >
                  <span className="chat-reaction-emoji">{option.emoji}</span>
                  {count > 0 ? <span className="chat-reaction-count">{count}</span> : null}
                </button>
              );
            })}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

export default MessageBubble;
