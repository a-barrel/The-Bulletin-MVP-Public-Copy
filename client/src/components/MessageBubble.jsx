import React, { memo, useCallback, useMemo, useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { NavLink, useNavigate } from 'react-router-dom';
import AvatarIcon from '../assets/AvatarIcon.svg';
import './MessageBubble.css';
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
import PinPreviewCard from './PinPreviewCard';
import { usePinCache } from '../contexts/PinCacheContext';
import normalizeObjectId from '../utils/normalizeObjectId';
import { CHAT_REACTION_OPTIONS } from '../constants/chatReactions';

function MessageBubble({
  msg,
  isSelf,
  authUser,
  canModerate = false,
  onModerate,
  onReport,
  onToggleReaction,
  onReportPin
}) {
  const { t } = useTranslation();
  const pinCache = usePinCache();
  const navigate = useNavigate();
  const [bookmarkState, setBookmarkState] = useState({});
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

  const hydratedPinShares = useMemo(() => {
    return pinShares.map((share) => {
      const pin = share.pin || {};
      const rawPinId =
        pin?.pinId ||
        pin?._id ||
        (typeof pin?.id === 'string' ? pin.id : null) ||
        (typeof pin?.pin_id === 'string' ? pin.pin_id : null);
      const normalizedPinId = normalizeObjectId(rawPinId) || rawPinId;
      const cachedPin =
        normalizedPinId ? pinCache.getPin(normalizedPinId) : rawPinId ? pinCache.getPin(rawPinId) : null;
      const thumb = share.thumb || pin.thumb || null;
      const mergedPin = cachedPin ? { ...pin, ...cachedPin } : pin;
      const effectivePin =
        thumb && !mergedPin?.coverPhoto
          ? { ...mergedPin, coverPhoto: { url: thumb }, photos: mergedPin?.photos || [{ url: thumb }] }
          : mergedPin;
      return { ...share, pin: effectivePin, pinId: normalizedPinId || rawPinId };
    });
  }, [pinCache, pinShares]);

  const handleViewSharedPin = (pinId, pin) => {
    if (!pinId) return;
    navigate(routes.pin.byId(pinId), { state: { pin } });
  };

  const handleToggleBookmark = useCallback((pinId) => {
    if (!pinId) return;
    setBookmarkState((prev) => ({
      ...prev,
      [pinId]: !(prev[pinId] ?? false)
    }));
  }, []);

  const handleFlagPin = useCallback(
    (pin, pinId) => {
      if (typeof onReportPin === 'function') {
        onReportPin(pin, pinId);
        return;
      }
      if (typeof onReport === 'function') {
        const syntheticMessage = {
          _id: pinId || msg?._id || msg?.id || msg?.messageId,
          message: pin?.title || 'Shared pin',
          attachments: msg?.attachments || []
        };
        onReport(syntheticMessage);
      }
    },
    [msg, onReport, onReportPin]
  );

  const handleCreatorClick = useCallback(
    (pin) => {
      const creatorId =
        normalizeObjectId(pin?.creatorId) ||
        normalizeObjectId(pin?.creator?._id) ||
        normalizeObjectId(pin?.creator?.id);
      if (!creatorId) {
        return;
      }
      navigate(routes.profile.byId(creatorId));
    },
    [navigate]
  );

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
    return CHAT_REACTION_OPTIONS.filter((option) => Number(reactionCounts?.[option.key]) > 0);
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
  const messageId = msg?._id || msg?.id || msg?.messageId;

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
              <IconButton
                className="chat-report-btn"
                size="small"
                aria-label="Report this message"
                title={t('tooltips.reportMessage')}
                onClick={() => onReport(msg)}
                disableRipple
                sx={{
                  ml: 0.5,
                  color: 'var(--danger)',
                  backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                  borderRadius: '8px',
                  transition: 'color 120ms ease, background-color 120ms ease',
                  '&:hover, &:focus-visible': {
                    color: 'color-mix(in srgb, var(--danger) 85%, var(--danger))',
                    backgroundColor: 'color-mix(in srgb, var(--danger) 16%, transparent)'
                  }
                }}
              >
                <ReportProblemIcon fontSize="inherit" />
              </IconButton>
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
              <IconButton
                className="chat-moderation-btn"
                size="small"
                aria-label="Moderate this user"
                title={t('tooltips.moderateUser')}
                onClick={() => onModerate(msg)}
                disableRipple
                sx={{
                  ml: 0.5,
                  color: 'var(--accent-primary)',
                  backgroundColor: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                  borderRadius: '8px',
                  transition: 'color 120ms ease, background-color 120ms ease',
                  '&:hover, &:focus-visible': {
                    color: 'var(--accent-strong)',
                    backgroundColor: 'color-mix(in srgb, var(--accent-strong) 16%, transparent)'
                  }
                }}
              >
                <GavelIcon fontSize="inherit" />
              </IconButton>
            ) : null}
          </div>
        </div>
        {displayMessage ? (
          <Typography className="chat-text">{displayMessage}</Typography>
        ) : null}
        {hydratedPinShares.length > 0 ? (
          <Box className="chat-pin-share-stack">
            {hydratedPinShares.map((share, index) => {
              const pin = share.pin || share;
              const pinId = share.pinId;
              const thumb = share.thumb || pin.thumb || null;
              const isBookmarked = bookmarkState[pinId] ?? Boolean(pin?.viewerHasBookmarked);
              return (
                <Box key={share._id || pinId || index} className="chat-pin-share-card">
                  <PinPreviewCard
                    pin={
                      thumb && !pin?.coverPhoto
                        ? { ...pin, coverPhoto: { url: thumb }, photos: pin?.photos || [{ url: thumb }] }
                        : pin
                    }
                    onView={() => handleViewSharedPin(pinId, pin)}
                    isBookmarked={isBookmarked}
                    onBookmark={() => handleToggleBookmark(pinId)}
                    onFlag={() => handleFlagPin(pin, pinId)}
                    onCreatorClick={() => handleCreatorClick(pin)}
                    disableActions={false}
                    className="pin-preview-card--map pin-preview-card--chat-share"
                  />
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
                    count > 0 ? `${option.label} reaction, ${count}` : `${option.label} reaction`
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

const arePropsEqual = (prev, next) => {
  const sameMsg = prev.msg === next.msg;
  const sameSelf = prev.isSelf === next.isSelf;
  const prevAuthId = prev.authUser?.uid || prev.authUser?._id || null;
  const nextAuthId = next.authUser?.uid || next.authUser?._id || null;
  const sameAuth = prevAuthId === nextAuthId;
  const sameModerate = prev.canModerate === next.canModerate && prev.onModerate === next.onModerate;
  const sameReport = prev.onReport === next.onReport;
  const sameReportPin = prev.onReportPin === next.onReportPin;
  const sameToggleReaction = prev.onToggleReaction === next.onToggleReaction;
  return (
    sameMsg &&
    sameSelf &&
    sameAuth &&
    sameModerate &&
    sameReport &&
    sameReportPin &&
    sameToggleReaction
  );
};

export default memo(MessageBubble, arePropsEqual);
