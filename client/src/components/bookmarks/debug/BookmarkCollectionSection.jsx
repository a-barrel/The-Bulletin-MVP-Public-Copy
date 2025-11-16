import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import PinCard from '../../PinCard';
import { mapBookmarkToFeedItem } from '../../../utils/bookmarks';

function normalizeDisplayName(name) {
  if (typeof name !== 'string') {
    return '';
  }
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === 'unsorted') {
    return '';
  }
  return trimmed;
}

function BookmarkCollectionSection({
  group,
  viewerProfileId,
  removingPinId,
  isOffline,
  formatSavedDate,
  onViewPin,
  onViewAuthor,
  onRemoveBookmark,
  isHighlighted,
  isPinned,
  onPinToggle,
  registerAnchor
}) {
  const { id: collectionId, name, items } = group;
  const groupKey = collectionId ?? '__ungrouped__';
  const normalizedDisplayName = normalizeDisplayName(name);
  const normalizedName = normalizedDisplayName.toLowerCase();

  return (
    <Paper
      className={`bookmarks-collection-card${isHighlighted ? ' is-highlighted' : ''}`}
      ref={(node) => registerAnchor(groupKey, normalizedName, node)}
    >
      {normalizedDisplayName ? (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
          className="bookmark-group-title"
        >
          <Typography variant="h6">{normalizedDisplayName}</Typography>
          <Button
            type="button"
            size="small"
            variant={isPinned ? 'contained' : 'outlined'}
            color="secondary"
            startIcon={isPinned ? <BookmarkAddedIcon fontSize="small" /> : <BookmarkAddIcon fontSize="small" />}
            onClick={() => onPinToggle(!isPinned)}
          >
            {isPinned ? 'Pinned to quick nav' : 'Pin to quick nav'}
          </Button>
        </Stack>
      ) : null}

      <Stack spacing={2} className="bookmarks-collection-list">
        {items.map((bookmark, bookmarkIndex) => {
          const pin = bookmark.pin;
          const pinId = bookmark.pinId || pin?._id;
          const savedAt = formatSavedDate(bookmark.createdAt);
          const isRemoving = removingPinId === pinId;
          const cardItem = mapBookmarkToFeedItem(bookmark, { viewerProfileId });
          const cardKey = bookmark._id || pinId || `bookmark-${bookmarkIndex}`;
          const canViewPin = Boolean(pinId);

          return (
            <Box key={cardKey} className="bookmark-item">
              {cardItem ? (
                <PinCard
                  item={cardItem}
                  onSelectItem={() => onViewPin(pinId, pin)}
                  onSelectAuthor={onViewAuthor}
                  showAttendeeAvatars={false}
                  className="pin-card--fluid"
                />
              ) : (
                <Paper variant="outlined" className="bookmark-missing-card">
                  <Typography variant="subtitle1" fontWeight={600}>
                    Pin unavailable
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This bookmark no longer has enough pin data to render.
                  </Typography>
                </Paper>
              )}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                className="bookmark-item-footer"
              >
                <Typography variant="body2">Saved on {savedAt}</Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LaunchIcon fontSize="small" />}
                    onClick={() => onViewPin(pinId, pin)}
                    disabled={!canViewPin}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    color="error"
                    startIcon={<DeleteOutlineIcon fontSize="small" />}
                    disabled={isOffline || isRemoving}
                    onClick={() => onRemoveBookmark(bookmark)}
                  >
                    {isRemoving ? 'Removing...' : 'Remove'}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}

export default BookmarkCollectionSection;
