import { memo } from 'react';
import { Box, Chip, Divider, ListSubheader, Typography } from '@mui/material';
import ExpandableBookmarkItem from '../ExpandableBookmarkItem';
import { formatSavedDate } from '../../utils/pinFormatting';

const UNSORTED_COLLECTION_KEY = '__ungrouped__';
const UNSORTED_LABEL = 'Unsorted';

const BookmarkGroupSection = memo(function BookmarkGroupSection({
  group,
  highlightedCollectionKey,
  collectionAnchorsRef,
  handleViewPin,
  handleRemoveBookmark,
  notifyRemovalStatus,
  handleBookmarkAttendanceToggle,
  removingPinId,
  attendancePendingId,
  isOffline,
  authUser
}) {
  const { id: collectionId, name, description, items } = group;
  const groupKey = collectionId ?? UNSORTED_COLLECTION_KEY;
  const displayName = name || UNSORTED_LABEL;
  const normalizedName = displayName.trim().toLowerCase();
  const isHighlighted = highlightedCollectionKey === groupKey;
  const shouldHideHeader = displayName === 'Weekend Events' || displayName === UNSORTED_LABEL;

  return (
    <Box key={groupKey}>
      {!shouldHideHeader && (
        <>
          <ListSubheader
            component="div"
            ref={(node) => {
              const anchors = collectionAnchorsRef.current;
              const keys = [groupKey, normalizedName, `${groupKey}::header`].filter(Boolean);
              keys.forEach((key) => {
                if (!key) {
                  return;
                }
                if (node) {
                  anchors.set(key, node);
                } else {
                  anchors.delete(key);
                }
              });
            }}
            sx={{
              backgroundColor: isHighlighted ? 'rgba(144, 202, 249, 0.12)' : 'background.paper',
              transition: 'background-color 220ms ease',
              px: 3,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              borderLeft: isHighlighted ? '3px solid rgba(144, 202, 249, 0.6)' : '3px solid transparent'
            }}
          >
            <Typography variant="subtitle1" fontWeight={600} sx={{ fontFamily: '"Urbanist", sans-serif' }}>
              {displayName}
            </Typography>
            <Chip label={items.length} size="small" variant="outlined" sx={{ fontFamily: '"Urbanist", sans-serif' }} />
          </ListSubheader>
          <Divider />
        </>
      )}
      {description ? (
        <Typography variant="body2" sx={{ px: 3, py: 1, fontFamily: '"Urbanist", sans-serif' }}>
          {description}
        </Typography>
      ) : null}
      {items.map((bookmark) => {
        const pin = bookmark.pin;
        const pinId = bookmark.pinId || pin?._id;
        const pinTitle = pin?.title ?? 'Untitled Pin';
        const pinType = pin?.type ?? 'pin';
        const tagLabel = pinType === 'event' ? 'Event' : pinType === 'discussion' ? 'Discussion' : 'Pin';
        const savedAt = bookmark.savedAtText || formatSavedDate(bookmark.createdAt);
        const isRemoving = removingPinId === pinId;

        return (
          <ExpandableBookmarkItem
            key={bookmark._id || pinId}
            bookmark={bookmark}
            pin={pin}
            pinId={pinId}
            pinTitle={pinTitle}
            pinType={pinType}
            tagLabel={tagLabel}
            savedAt={savedAt}
            isRemoving={isRemoving}
            isOffline={isOffline}
            onViewPin={handleViewPin}
            onRemoveBookmark={handleRemoveBookmark}
            authUser={authUser}
            onShowRemovalStatus={notifyRemovalStatus}
            onToggleAttendance={handleBookmarkAttendanceToggle}
            isTogglingAttendance={attendancePendingId === pinId}
          />
        );
      })}
      {!shouldHideHeader && <Divider />}
    </Box>
  );
});

export default BookmarkGroupSection;
