import PropTypes from 'prop-types';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography } from '@mui/material';
import ExpandableBookmarkItem from '../ExpandableBookmarkItem';
import '../../pages/BookmarksPage.css';
import HistoryBookmarkCard from '../bookmarks/HistoryBookmarkCard';
import { useMemo } from 'react';
import { usePinCache } from '../../contexts/PinCacheContext';
import { useNetworkStatusContext } from '../../contexts/NetworkStatusContext';

function ChatSharePinModal({ open, onClose, bookmarks = [], onSelect }) {
  const hasBookmarks = Array.isArray(bookmarks) && bookmarks.length > 0;
  const pinCache = usePinCache();
  const { isOffline } = useNetworkStatusContext();

  const hydratedBookmarks = useMemo(() => {
    if (!hasBookmarks) {
      return [];
    }
    return bookmarks.map((bookmark) => {
      const pinId = bookmark.pinId || bookmark?.pin?._id || bookmark?.pin?.id || bookmark?._id || bookmark?.id;
      const cachedPin = pinId ? pinCache.getPin(pinId) : null;
      const pin = cachedPin || bookmark.pin || bookmark;
      return { bookmark, pin, pinId };
    });
  }, [bookmarks, hasBookmarks, pinCache]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="chat-share-pin-title"
      data-testid="chat-share-pin-modal"
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          border: '1px solid var(--color-border-strong)',
          boxShadow: '0 18px 44px rgba(17, 12, 34, 0.22)',
          backgroundColor: 'var(--color-surface)',
          maxHeight: '85vh'
        }
      }}
    >
      <DialogTitle
        id="chat-share-pin-title"
        sx={{ fontWeight: 700, color: 'var(--color-text-strong)' }}
      >
        Share a saved pin
      </DialogTitle>
      <DialogContent dividers sx={{ backgroundColor: 'transparent', pb: 1 }}>
        {hasBookmarks ? (
          <Stack spacing={1.5} sx={{ maxHeight: 450, overflowY: 'auto', pr: 0.5 }}>
            {hydratedBookmarks.map(({ bookmark, pin, pinId }, index) => {
              const testIdSafe = pinId || bookmark._id || bookmark.id || `bookmark-${index}`;
              return (
                <Box
                  key={bookmark._id || bookmark.pinId || bookmark.id || pinId || pin?._id || pin?.id || pin?.title}
                  data-testid={`share-pin-bookmark-item-${testIdSafe}`}
                >
                  <HistoryBookmarkCard
                    pin={pin}
                    viewedAt={bookmark.createdAt || bookmark.savedAtText}
                    onClick={() => onSelect?.(pin)}
                    testId={`share-pin-history-card-${testIdSafe}`}
                    actionSlot={
                      <Button
                        type="button"
                        size="small"
                        variant="contained"
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                        onClick={(event) => {
                          event?.stopPropagation?.();
                          onSelect?.(pin);
                        }}
                        data-testid={`share-pin-button-${testIdSafe}`}
                        aria-label="Share this pin"
                      >
                        Share
                      </Button>
                    }
                  />
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Typography variant="body1" fontWeight={600}>
                No bookmarks yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Save pins first, then come back to share them in chat.
              </Typography>
            </Stack>
          )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button
          onClick={onClose}
          color="error"
          variant="contained"
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ChatSharePinModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSelect: PropTypes.func,
  bookmarks: PropTypes.arrayOf(PropTypes.object)
};

export default ChatSharePinModal;
