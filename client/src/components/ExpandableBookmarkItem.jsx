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
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlusIcon from '../assets/Plus.svg';
import MinusIcon from '../assets/Minus.svg';
import DiscussionBookmarkIcon from '../assets/Discussion_Bookmarks.svg';
import EventBookmarkIcon from '../assets/Event_Bookmarks.svg';
import resolveAssetUrl from '../utils/media';
import { fetchPinById } from '../api/mongoDataApi';

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
  onRemoveBookmark
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
        color: '#5D3889'
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
          sx={{ color: '#5D3889', textAlign: 'center', justifySelf: 'center' }}
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
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip label={tagLabel} size="small" color="secondary" variant="outlined" />
              <Typography variant="body2" sx={{ color: '#5D3889' }}>
                Saved on {savedAt}
              </Typography>
            </Stack>
            {isLoadingPin ? (
              <Typography variant="body2" sx={{ color: '#5D3889' }}>
                Loading...
              </Typography>
            ) : description ? (
              <Typography
                variant="body2"
                sx={{
                  color: '#5D3889',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {description}
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

            {creator ? (
              <Typography variant="body2" sx={{ color: '#5D3889' }}>
                Created by {creatorName}
              </Typography>
            ) : null}
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<LaunchIcon fontSize="small" />}
                onClick={(event) => {
                  event.stopPropagation();
                  onViewPin(pinId, fullPin || pin);
                }}
              >
                View
              </Button>
              <Button
                size="small"
                variant="text"
                color="error"
                startIcon={<DeleteOutlineIcon fontSize="small" />}
                disabled={isOffline || isRemoving}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveBookmark(bookmark);
                }}
                title={isOffline ? 'Reconnect to remove bookmarks' : undefined}
              >
                {isRemoving ? 'Removing...' : 'Remove'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

export default ExpandableBookmarkItem;

