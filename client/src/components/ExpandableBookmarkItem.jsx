//import { useState, useMemo } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
//import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import resolveAssetUrl from '../utils/media';
import { fetchPinById } from '../api/mongoDataApi';
import toIdString from '../utils/ids';
import BookmarkedIcon from '../assets/Bookmarked.svg';

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
  authUser
}) {
  const [expanded, setExpanded] = useState(false);
  const [fullPin, setFullPin] = useState(null);
  const [isLoadingPin, setIsLoadingPin] = useState(false);

  const handleTitleClick = (event) => {
    event.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const handleBodyClick = () => {
    onViewPin(pinId, fullPin || pin);
  };

  // Fetch full pin data when expanded
  useEffect(() => {
    if (expanded && pinId && !fullPin && !isLoadingPin) {
      // Only fetch if pin preview doesn't have description
      if (!pin?.description) {
        setIsLoadingPin(true);
        fetchPinById(pinId)
          .then((fetchedPin) => {
            setFullPin(fetchedPin);
          })
          .catch((error) => {
            console.error('Failed to fetch full pin data:', error);
          })
          .finally(() => {
            setIsLoadingPin(false);
          });
      }
    }
  }, [expanded, pinId, pin, fullPin, isLoadingPin]);

  // Use full pin data if available, otherwise use preview
  const displayPin = fullPin || pin;
  const description = displayPin?.description || '';
  const creator = displayPin?.creator;
  const creatorName = creator?.displayName || creator?.username || 'Unknown';

  // Determine if the current user owns the pin
  const creatorId = toIdString(displayPin?.creatorId) ?? toIdString(displayPin?.creator?._id);
  const viewerId = toIdString(authUser?.uid);
  const ownsPin = Boolean(creatorId && viewerId && creatorId === viewerId);

  // Determine if the user is attending (for event pins)
  const attending = Boolean(bookmark?.viewerIsAttending);

  // Get participant count for event pins
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
        if (!photo || !photo.url) continue;
        if (cover && cover.url && photo.url === cover.url) continue;
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

  return (
    <Box
      sx={{
        p: '12px',
        mb: 2,
        border: '1px solid black',
        borderRadius: 5,
        backgroundColor: '#F5EFFD',
        color: '#5D3889',
        fontFamily: '"Urbanist", sans-serif'
      }}
    >
      <ListItemButton
        onClick={handleTitleClick}
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
        <Box
          sx={{ width: 32, height: 32, justifySelf: 'start', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {iconSrc ? (
            <Box
              component="img"
              src={iconSrc}
              alt={`${pinType} bookmark icon`}
              sx={{ width: 28, height: 28 }}
            />
          ) : null}
        </Box>
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ color: '#5D3889', textAlign: 'center', justifySelf: 'center', fontFamily: '"Urbanist", sans-serif' }}
        >
          {pinTitle}
        </Typography>
        <Box
          component="img"
          src={expanded ? MinusIcon : PlusIcon}
          alt={expanded ? 'Collapse' : 'Expand'}
          sx={{
            width: 20,
            height: 20,
            justifySelf: 'end'
          }}
        />
      </ListItemButton>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box
          sx={{
            py: 2,
            px: { xs: 2, md: 3 },
            transition: 'background-color 0.2s'
          }}
        >
          <Stack spacing={1.5}>
            {isLoadingPin ? (
              <Typography variant="body2" sx={{ color: '#5D3889', fontFamily: '"Urbanist", sans-serif' }}>
                Loading...
              </Typography>
            ) : null}

            {images.length > 0 && (
              images.length >= 3 ? (
                <div className="media-scroll" aria-label="Pin photos" role="list">
                  {images.map((src, imgIndex) => (
                    <img
                      key={`${(pinId || bookmark?._id || 'pin')}-media-${imgIndex}`}
                      src={src}
                      className="media scroll-item"
                      alt=""
                      loading="lazy"
                      role="listitem"
                    />
                  ))}
                </div>
              ) : (
                <div className={`media-grid ${images.length === 1 ? 'one' : 'two'}`}>
                  {images.map((src, imgIndex) => (
                    <img
                      key={`${(pinId || bookmark?._id || 'pin')}-media-${imgIndex}`}
                      src={src}
                      className="media"
                      alt=""
                      loading="lazy"
                    />
                  ))}
                </div>
              )
            )}

            {!isLoadingPin && description ? (
              <Typography
                variant="body2"
                sx={{
                  color: '#5D3889',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: '"Urbanist", sans-serif'
                }}
              >
                {description}
              </Typography>
            ) : null}

            {/* Attending count, View button, and Bookmark button in one row */}
            <Box
              sx={{
                pt: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                minHeight: '40px'
              }}
            >
              {/* Left: Attending count (only for event pins) */}
              <Box sx={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 0.5 }}>
                {pinType === 'event' ? (
                  <>
                    <Box
                      component="img"
                      src={AttendingBookmarksIcon}
                      alt=""
                      sx={{ width: 20, height: 20 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#5D3889',
                        fontWeight: 500,
                        fontFamily: '"Urbanist", sans-serif'
                      }}
                    >
                      {participantCount}
                    </Typography>
                  </>
                ) : null}
              </Box>

              {/* Center: View button */}
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(event) => {
                    event.stopPropagation();
                    onViewPin(pinId, fullPin || pin);
                  }}
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
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'black'
                    },
                    '&.MuiButton-outlined': {
                      borderColor: 'black'
                    }
                  }}
                >
                  View
                </Button>
              </Box>

              {/* Right: Bookmark button */}
              <Box sx={{ flex: '1 1 0', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={isOffline || isRemoving}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveBookmark(bookmark);
                  }}
                  title={isOffline ? 'Reconnect to manage bookmarks' : 'Remove bookmark'}
                  aria-label="Remove bookmark"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: isOffline || isRemoving ? 'not-allowed' : 'pointer',
                    opacity: isOffline || isRemoving ? 0.5 : 1
                  }}
                >
                  <img
                    src={BookmarkedIcon}
                    alt="Remove bookmark"
                    style={{ width: '24px', height: '24px' }}
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

export default ExpandableBookmarkItem;


