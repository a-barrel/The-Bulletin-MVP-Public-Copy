import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Chip,
  Collapse,
  ListItemButton,
  Stack,
  Typography
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import GroupsIcon from '@mui/icons-material/Groups';
import BookmarkRemoveIcon from '@mui/icons-material/BookmarkRemove';
import resolveAssetUrl from '../utils/media';
import { fetchPinById } from '../api';
import toIdString from '../utils/ids';
import { usePinCache } from '../contexts/PinCacheContext';

function ExpandableBookmarkItem({
  bookmark,
  pin,
  pinId,
  pinTitle,
  pinType,
  tagLabel,
  savedAt,
  isRemoving,
  isOffline,
  onViewPin,
  onRemoveBookmark,
  authUser,
  onShowRemovalStatus,
  onToggleAttendance,
  isTogglingAttendance,
  defaultExpanded = false,
  actionsSlot = null
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);
  const [fullPin, setFullPin] = useState(null);
  const [isLoadingPin, setIsLoadingPin] = useState(false);
  const requestTokenRef = useRef(0);
  const pinCache = usePinCache();

  const handleTitleClick = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!expanded || !pinId || fullPin || isLoadingPin || pin?.description) {
      return undefined;
    }

    const cached = pinCache.getPin(pinId);
    if (cached) {
      setFullPin(cached);
      return undefined;
    }

    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;
    setIsLoadingPin(true);
    let cancelled = false;

    fetchPinById(pinId)
      .then((fetchedPin) => {
        if (!cancelled && requestTokenRef.current === token && fetchedPin) {
          setFullPin(fetchedPin);
          pinCache.upsertPin(fetchedPin);
        }
      })
      .catch((error) => {
        if (!cancelled && requestTokenRef.current === token) {
          console.error('Failed to fetch full pin data:', error);
        }
      })
      .finally(() => {
        if (!cancelled && requestTokenRef.current === token) {
          setIsLoadingPin(false);
        }
      });

    return () => {
      cancelled = true;
      requestTokenRef.current += 1;
      setIsLoadingPin(false);
    };
  }, [expanded, fullPin, isLoadingPin, pin?.description, pinCache, pinId]);

  const displayPin = fullPin || pin;
  const description = displayPin?.description || '';
  const creator = displayPin?.creator;
  const creatorName = creator?.displayName || creator?.username || 'Unknown';
  const creatorId = toIdString(displayPin?.creatorId) ?? toIdString(displayPin?.creator?._id);
  const viewerId = toIdString(authUser?.uid);
  const ownsPin = Boolean(creatorId && viewerId && creatorId === viewerId);
  const attending =
    typeof bookmark?.viewerIsAttending === 'boolean'
      ? bookmark.viewerIsAttending
      : Boolean(displayPin?.viewerIsAttending);
  const participantCount =
    typeof displayPin?.stats?.participantCount === 'number'
      ? displayPin.stats.participantCount
      : typeof displayPin?.participantCount === 'number'
      ? displayPin.participantCount
      : 0;

  const iconElement =
    pinType === 'discussion'
      ? <ForumOutlinedIcon sx={{ width: 28, height: 28, color: 'var(--accent-strong)' }} />
      : pinType === 'event'
        ? <EventAvailableIcon sx={{ width: 28, height: 28, color: 'var(--accent-strong)' }} />
        : <GroupsIcon sx={{ width: 28, height: 28, color: 'var(--accent-strong)' }} />;

  const mediaAssets = useMemo(() => {
    const list = [];
    const cover = displayPin?.coverPhoto;
    if (cover && cover.url) {
      list.push(cover);
    }
    if (Array.isArray(displayPin?.photos)) {
      for (const photo of displayPin.photos) {
        if (!photo || !photo.url) {
          continue;
        }
        if (cover && cover.url && photo.url === cover.url) {
          continue;
        }
        list.push(photo);
      }
    }
    return list;
  }, [displayPin]);

  const images = useMemo(() => {
    const urls = [];
    for (const asset of mediaAssets) {
      const resolved = resolveAssetUrl(asset, { keys: ['thumbnailUrl', 'url', 'path'] });
      if (resolved && !urls.includes(resolved)) {
        urls.push(resolved);
      }
    }
    return urls;
  }, [mediaAssets]);

  const renderMedia = () => {
    if (!images.length) {
      return null;
    }
    if (images.length >= 3) {
      return (
        <div className="media-scroll" aria-label="Pin photos" role="list">
          {images.map((src, index) => (
            <img
              key={`${pinId || bookmark?._id || 'pin'}-media-${index}`}
              src={src}
              className="media scroll-item"
              alt=""
              loading="lazy"
              role="listitem"
            />
          ))}
        </div>
      );
    }
    const gridClass = images.length === 1 ? 'one' : 'two';
    return (
      <div className={`media-grid ${gridClass}`}>
        {images.map((src, index) => (
          <img
            key={`${pinId || bookmark?._id || 'pin'}-media-${index}`}
            src={src}
            className="media"
            alt=""
            loading="lazy"
          />
        ))}
      </div>
    );
  };

  const removalGuardMessage = ownsPin
    ? 'Creators keep their pins bookmarked automatically.'
    : attending
    ? 'Attendees keep these pins bookmarked automatically.'
    : null;
  const removeDisabled = Boolean(isOffline || isRemoving || removalGuardMessage);
  const removeButtonTitle = removalGuardMessage
    ? removalGuardMessage
    : isOffline
    ? 'Reconnect to manage bookmarks'
    : isRemoving
    ? 'Removing bookmark...'
    : 'Remove bookmark';

  const tagChipStyles = {
    backgroundColor: 'var(--accent-strong)',
    color: 'var(--color-text-on-accent)',
    fontFamily: '"Urbanist", sans-serif'
  };

  const cardBackground =
    pinType === 'discussion' ? 'var(--color-surface-wash-strong)' : 'var(--color-surface-wash)';

  const handleViewClick = useCallback(
    (event) => {
      event.stopPropagation();
      onViewPin(pinId, fullPin || pin);
    },
    [fullPin, onViewPin, pin, pinId]
  );

  const handleToggleAttendanceClick = useCallback(
    (event) => {
      event.stopPropagation();
      onToggleAttendance?.(bookmark);
    },
    [bookmark, onToggleAttendance]
  );

  const handleRemoveClick = useCallback(
    (event) => {
      event.stopPropagation();
      if (!removeDisabled) {
        onRemoveBookmark(bookmark);
      } else if (removalGuardMessage) {
        onShowRemovalStatus?.({
          type: 'info',
          message: removalGuardMessage,
          toast: true
        });
      }
    },
    [bookmark, onRemoveBookmark, onShowRemovalStatus, removalGuardMessage, removeDisabled]
  );

  return (
    <Box
      sx={{
        p: '12px',
        m: 0,
        border: '1px solid var(--color-border-strong)',
        borderRadius: 5,
        backgroundColor: cardBackground,
        color: 'var(--color-text-primary)',
        fontFamily: '"Urbanist", sans-serif',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <ListItemButton
        onClick={handleTitleClick}
        disableRipple
        sx={{
          py: 1.5,
          px: { xs: 2, md: 3 },
          gap: 1.5,
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          columnGap: 1.5,
          borderRadius: 0
        }}
      >
        <Box sx={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {iconElement}
        </Box>
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ color: 'var(--color-text-strong)', textAlign: 'center', fontFamily: '"Urbanist", sans-serif' }}
        >
          {pinTitle}
        </Typography>
        <Box
          component={expanded ? RemoveCircleOutlineIcon : AddCircleOutlineIcon}
          sx={{ width: 20, height: 20, justifySelf: 'end', color: 'var(--accent-strong)' }}
          aria-hidden
        />
      </ListItemButton>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ py: 2, px: { xs: 2, md: 3 }, transition: 'background-color 0.2s' }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center">
                {tagLabel ? <Chip size="small" label={tagLabel} sx={tagChipStyles} /> : null}
                {attending ? (
                  <Chip
                    size="small"
                    label="Attending"
                    color="success"
                    sx={{
                      fontFamily: '"Urbanist", sans-serif',
                      backgroundColor: 'var(--accent-blue)',
                      color: 'var(--color-text-on-accent)'
                    }}
                  />
                ) : null}
                {ownsPin ? (
                  <Chip
                    size="small"
                    label="My pin"
                    color="secondary"
                    sx={{
                      fontFamily: '"Urbanist", sans-serif',
                      backgroundColor: 'var(--accent-pink)',
                      color: 'var(--color-text-on-accent)'
                    }}
                  />
                ) : null}
              </Stack>
              <Box
                sx={{
                  backgroundColor: 'var(--accent-strong)',
                  color: 'var(--color-text-on-accent)',
                  borderRadius: '999px',
                  px: 1.5,
                  py: 0.25
                }}
              >
                <Typography variant="body2" sx={{ fontFamily: '"Urbanist", sans-serif', color: 'var(--color-text-on-accent)' }}>
                  Saved {savedAt}
                </Typography>
              </Box>
            </Stack>

            {isLoadingPin ? (
              <Typography variant="body2" sx={{ color: 'var(--color-text-primary)', fontFamily: '"Urbanist", sans-serif' }}>
                Loading...
              </Typography>
            ) : null}

            {renderMedia()}

            {!isLoadingPin && description ? (
              <Typography
                variant="body2"
                sx={{ color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: '"Urbanist", sans-serif' }}
              >
                {description}
              </Typography>
            ) : null}

            <Typography variant="body2" sx={{ color: 'var(--color-text-primary)', fontFamily: '"Urbanist", sans-serif' }}>
              Created by {creatorName}
            </Typography>

            <Box
              sx={{
                pt: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                minHeight: '40px'
              }}
            >
              {actionsSlot ? (
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>{actionsSlot}</Box>
              ) : (
                <>
                  <Box sx={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 0.5 }}>
                {pinType === 'event' ? (
                  <>
                    <GroupsIcon sx={{ width: 20, height: 20, color: 'var(--accent-strong)' }} />
                    <Typography
                      variant="body2"
                      sx={{ color: 'var(--color-text-primary)', fontWeight: 500, fontFamily: '"Urbanist", sans-serif' }}
                    >
                      {participantCount}
                    </Typography>
                  </>
                ) : null}
                  </Box>

                  <Box sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', justifyContent: 'center' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleViewClick}
                      disableRipple
                      sx={{
                        color: 'var(--accent-strong)',
                        backgroundColor: 'var(--color-surface-wash-strong)',
                        border: '1px solid var(--color-border-strong)',
                        fontFamily: '"Urbanist", sans-serif',
                        '&:hover': {
                          backgroundColor: 'var(--color-surface-wash-strong)',
                          border: '1px solid var(--color-border-strong)',
                          color: 'var(--accent-strong)'
                        },
                        '&.MuiButton-outlined': {
                          borderColor: 'var(--color-border-strong)'
                        }
                      }}
                    >
                      View
                    </Button>
                  </Box>

                  <Box sx={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button
                      size="small"
                      variant={attending ? 'contained' : 'outlined'}
                      onClick={handleToggleAttendanceClick}
                      disabled={Boolean(isOffline || isTogglingAttendance)}
                      disableRipple
                      sx={{
                        color: attending ? 'var(--color-text-on-accent)' : 'var(--accent-strong)',
                        backgroundColor: attending ? 'var(--accent-strong)' : 'var(--color-surface)',
                        borderColor: 'var(--accent-strong)',
                        fontFamily: '"Urbanist", sans-serif',
                        '&:hover': {
                          backgroundColor: attending
                            ? 'color-mix(in srgb, var(--accent-strong) 90%, transparent)'
                            : 'var(--color-surface-wash)'
                        }
                      }}
                    >
                      {isTogglingAttendance
                        ? 'Updating…'
                        : attending
                        ? 'Unattend'
                        : 'Attend'}
                    </Button>
                    <button
                      type="button"
                      disabled={removeDisabled}
                      onClick={handleRemoveClick}
                      title={removeButtonTitle}
                      aria-label={removeButtonTitle}
                      className="bookmark-remove-btn"
                    >
                      <BookmarkRemoveIcon
                        sx={{ color: 'var(--accent-strong)', width: 22, height: 22 }}
                        aria-hidden
                      />
                    </button>
                  </Box>
                </>
              )}
            </Box>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

ExpandableBookmarkItem.propTypes = {
  bookmark: PropTypes.object.isRequired,
  pin: PropTypes.object,
  pinId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  pinTitle: PropTypes.string.isRequired,
  pinType: PropTypes.string.isRequired,
  tagLabel: PropTypes.string,
  savedAt: PropTypes.string,
  isRemoving: PropTypes.bool,
  isOffline: PropTypes.bool,
  onViewPin: PropTypes.func.isRequired,
  onRemoveBookmark: PropTypes.func.isRequired,
  authUser: PropTypes.object,
  onShowRemovalStatus: PropTypes.func,
  onToggleAttendance: PropTypes.func,
  isTogglingAttendance: PropTypes.bool,
  defaultExpanded: PropTypes.bool,
  actionsSlot: PropTypes.node
};

ExpandableBookmarkItem.defaultProps = {
  pin: null,
  pinId: null,
  tagLabel: 'Pin',
  savedAt: 'Recently',
  isRemoving: false,
  isOffline: false,
  authUser: null,
  onShowRemovalStatus: null,
  onToggleAttendance: null,
  isTogglingAttendance: false,
  defaultExpanded: false,
  actionsSlot: null
};

const arePropsEqual = (prev, next) => {
  return (
    prev.pinId === next.pinId &&
    prev.pin === next.pin &&
    prev.pinTitle === next.pinTitle &&
    prev.pinType === next.pinType &&
    prev.tagLabel === next.tagLabel &&
    prev.savedAt === next.savedAt &&
    prev.isRemoving === next.isRemoving &&
    prev.isOffline === next.isOffline &&
    prev.isTogglingAttendance === next.isTogglingAttendance &&
    prev.authUser === next.authUser &&
    prev.bookmark?._id === next.bookmark?._id &&
    prev.bookmark?.pinId === next.bookmark?.pinId &&
    prev.bookmark?.viewerIsAttending === next.bookmark?.viewerIsAttending &&
    prev.onViewPin === next.onViewPin &&
    prev.onRemoveBookmark === next.onRemoveBookmark &&
    prev.onShowRemovalStatus === next.onShowRemovalStatus &&
    prev.onToggleAttendance === next.onToggleAttendance &&
    prev.defaultExpanded === next.defaultExpanded &&
    prev.actionsSlot === next.actionsSlot
  );
};

const MemoizedExpandableBookmarkItem = memo(ExpandableBookmarkItem, arePropsEqual);
MemoizedExpandableBookmarkItem.displayName = 'ExpandableBookmarkItem';
MemoizedExpandableBookmarkItem.propTypes = ExpandableBookmarkItem.propTypes;
MemoizedExpandableBookmarkItem.defaultProps = ExpandableBookmarkItem.defaultProps;

export default MemoizedExpandableBookmarkItem;
