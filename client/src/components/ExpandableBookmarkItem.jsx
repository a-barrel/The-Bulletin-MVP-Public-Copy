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

import PlusIcon from '../assets/Plus.svg';
import MinusIcon from '../assets/Minus.svg';
import DiscussionBookmarkIcon from '../assets/Discussion_Bookmarks.svg';
import EventBookmarkIcon from '../assets/Event_Bookmarks.svg';
import AttendingBookmarksIcon from '../assets/Attending_Bookmarks.svg';
import BookmarkedIcon from '../assets/Bookmarked.svg';
import BookmarkedOwnerIcon from '../assets/BookmarkedOwner.svg';
import resolveAssetUrl from '../utils/media';
import { fetchPinById } from '../api/mongoDataApi';
import toIdString from '../utils/ids';

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
  isTogglingAttendance
}) {
  const [expanded, setExpanded] = useState(false);
  const [fullPin, setFullPin] = useState(null);
  const [isLoadingPin, setIsLoadingPin] = useState(false);
  const requestTokenRef = useRef(0);

  const handleTitleClick = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!expanded || !pinId || fullPin || isLoadingPin || pin?.description) {
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
  }, [expanded, fullPin, isLoadingPin, pin?.description, pinId]);

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

  const iconSrc =
    pinType === 'discussion'
      ? DiscussionBookmarkIcon
      : pinType === 'event'
        ? EventBookmarkIcon
        : null;

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
    backgroundColor: '#4b208c',
    color: '#ffffff',
    fontFamily: '"Urbanist", sans-serif'
  };

  const cardBackground = pinType === 'discussion' ? '#E6F1FF' : '#F5EFFD';

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
        mb: 2,
        border: '1px solid black',
        borderRadius: 5,
        backgroundColor: cardBackground,
        color: '#5D3889',
        fontFamily: '"Urbanist", sans-serif'
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
          {iconSrc ? <Box component="img" src={iconSrc} alt={`${pinType} bookmark icon`} sx={{ width: 28, height: 28 }} /> : null}
        </Box>
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#5D3889', textAlign: 'center', fontFamily: '"Urbanist", sans-serif' }}>
          {pinTitle}
        </Typography>
        <Box
          component="img"
          src={expanded ? MinusIcon : PlusIcon}
          alt={expanded ? 'Collapse' : 'Expand'}
          sx={{ width: 20, height: 20, justifySelf: 'end' }}
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
                    sx={{ fontFamily: '"Urbanist", sans-serif', backgroundColor: '#3eb8f0', color: '#ffffff' }}
                  />
                ) : null}
                {ownsPin ? (
                  <Chip
                    size="small"
                    label="My pin"
                    color="secondary"
                    sx={{ fontFamily: '"Urbanist", sans-serif', backgroundColor: '#f15bb5', color: '#ffffff' }}
                  />
                ) : null}
              </Stack>
              <Box
                sx={{
                  backgroundColor: '#4b208c',
                  color: '#ffffff',
                  borderRadius: '999px',
                  px: 1.5,
                  py: 0.25
                }}
              >
                <Typography variant="body2" sx={{ fontFamily: '"Urbanist", sans-serif', color: '#ffffff' }}>
                  Saved {savedAt}
                </Typography>
              </Box>
            </Stack>

            {isLoadingPin ? (
              <Typography variant="body2" sx={{ color: '#5D3889', fontFamily: '"Urbanist", sans-serif' }}>
                Loading...
              </Typography>
            ) : null}

            {renderMedia()}

            {!isLoadingPin && description ? (
              <Typography
                variant="body2"
                sx={{ color: '#5D3889', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: '"Urbanist", sans-serif' }}
              >
                {description}
              </Typography>
            ) : null}

            <Typography variant="body2" sx={{ color: '#5D3889', fontFamily: '"Urbanist", sans-serif' }}>
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
              <Box sx={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 0.5 }}>
                {pinType === 'event' ? (
                  <>
                    <Box component="img" src={AttendingBookmarksIcon} alt="" sx={{ width: 20, height: 20 }} />
                    <Typography variant="body2" sx={{ color: '#5D3889', fontWeight: 500, fontFamily: '"Urbanist", sans-serif' }}>
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
                    color: 'black',
                    backgroundColor: '#CDAEF2',
                    border: '1px solid black',
                    fontFamily: '"Urbanist", sans-serif',
                    '&:hover': {
                      backgroundColor: '#CDAEF2',
                      border: '1px solid black',
                      color: 'black'
                    },
                    '&.MuiButton-outlined': {
                      borderColor: 'black'
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
                    color: attending ? '#ffffff' : '#4b208c',
                    backgroundColor: attending ? '#4b208c' : '#ffffff',
                    borderColor: '#4b208c',
                    fontFamily: '"Urbanist", sans-serif',
                    '&:hover': {
                      backgroundColor: attending ? '#38176c' : '#f5edff'
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
                  <img
                    src={ownsPin ? BookmarkedOwnerIcon : BookmarkedIcon}
                    alt={
                      removalGuardMessage
                        ? removalGuardMessage
                        : 'Remove bookmark'
                    }
                  />
                </button>
              </Box>
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
  isTogglingAttendance: PropTypes.bool
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
  isTogglingAttendance: false
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
    prev.onToggleAttendance === next.onToggleAttendance
  );
};

const MemoizedExpandableBookmarkItem = memo(ExpandableBookmarkItem, arePropsEqual);
MemoizedExpandableBookmarkItem.displayName = 'ExpandableBookmarkItem';
MemoizedExpandableBookmarkItem.propTypes = ExpandableBookmarkItem.propTypes;
MemoizedExpandableBookmarkItem.defaultProps = ExpandableBookmarkItem.defaultProps;

export default MemoizedExpandableBookmarkItem;
