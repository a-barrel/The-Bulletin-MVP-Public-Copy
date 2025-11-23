import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Stack,
  Typography,
  Divider
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import resolveAssetUrl from '../../utils/media';

function ChatSharePinModal({ open, onClose, bookmarks = [], onSelect }) {
  const hasBookmarks = Array.isArray(bookmarks) && bookmarks.length > 0;

  const formatAddress = (pin) => {
    const tryAddressObject = (value) => {
      if (!value || typeof value !== 'object') {
        return null;
      }
      if (typeof value.formatted === 'string' && value.formatted.trim()) {
        return value.formatted.trim();
      }
      const parts = [value.line1, value.city, value.state, value.country, value.postalCode]
        .filter((part) => typeof part === 'string' && part.trim());
      if (parts.length) {
        return parts.join(', ');
      }
      if (value.components && typeof value.components === 'object') {
        const { line1, city, state, country, postalCode } = value.components;
        const nestedParts = [line1, city, state, country, postalCode]
          .filter((part) => typeof part === 'string' && part.trim());
        if (nestedParts.length) {
          return nestedParts.join(', ');
        }
      }
      return null;
    };

    const candidates = [
      pin?.approximateAddress,
      pin?.approximateAddressLabel,
      pin?.address,
      pin?.addressLabel,
      pin?.address?.components,
      pin?.location?.approximateAddress,
      pin?.location?.approximate_address,
      pin?.location?.approxAddress,
      pin?.location?.address,
      pin?.location?.addressLabel,
      pin?.location?.address?.components,
      pin?.locationName,
      pin?.location?.name
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
      const objResult = tryAddressObject(candidate);
      if (objResult) {
        return objResult;
      }
    }

    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="chat-share-pin-title"
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          border: '1px solid rgba(93,56,137,0.24)',
          boxShadow: '0 18px 44px rgba(17, 12, 34, 0.22)',
          backgroundColor: '#ffffff'
        }
      }}
    >
      <DialogTitle id="chat-share-pin-title" sx={{ fontWeight: 700, color: '#2e2157' }}>
        Share a saved pin
      </DialogTitle>
      <DialogContent dividers sx={{ backgroundColor: 'transparent', pb: 1 }}>
        {hasBookmarks ? (
          <List
            dense
            sx={{
              maxHeight: 360,
              overflowY: 'auto',
              pr: 0.5
            }}
            subheader={
              <ListSubheader
                component="div"
                disableSticky
                sx={{ fontWeight: 700, color: '#5d3889', background: 'transparent' }}
              >
                Bookmarked pins
              </ListSubheader>
            }
          >
            {bookmarks.map((bookmark) => {
              const pin = bookmark.pin || bookmark;
              const label = pin?.title || 'Untitled pin';
              const subtitleParts = [];
              if (pin?.type) {
                subtitleParts.push(pin.type === 'event' ? 'Event' : 'Discussion');
              }
              const locationLabel = formatAddress(pin);
              if (locationLabel) {
                subtitleParts.push(locationLabel);
              }
                const subtitle = subtitleParts.join(' · ');
                const isEvent = (pin?.type || '').toLowerCase() === 'event';
                const cardBg = isEvent ? '#ecf8fe' : '#ffe5e0';
                const hoverBg = isEvent ? '#d8edf9' : '#ffd6cf';
                const borderColor = isEvent ? '#5d3889' : '#d84315';
              const thumb =
                resolveAssetUrl(pin.coverPhoto, null) ||
                (Array.isArray(pin.photos) ? resolveAssetUrl(pin.photos[0], null) : null) ||
                resolveAssetUrl(pin?.imageUrl, null);
              return (
                <ListItemButton
                  key={bookmark._id || bookmark.pinId || bookmark.id || label}
                  onClick={() => onSelect?.(pin)}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.5,
                    border: `1px solid ${borderColor}`,
                    background: `linear-gradient(135deg, rgba(93,56,137,0.12), ${cardBg})`,
                    color: '#0f172a',
                    '&:hover, &:focus-visible': {
                      borderColor,
                      backgroundColor: hoverBg
                    }
                  }}
                >
                  <ListItemText
                    disableTypography
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BookmarkIcon fontSize="small" htmlColor="#5d3889" />
                        <Typography variant="subtitle1" fontWeight={700} color="#0f172a">
                          {label}
                        </Typography>
                      </Stack>
                    }
                    secondary={
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5, width: '100%' }}>
                        {subtitle ? (
                          <>
                            <LocationOnIcon sx={{ fontSize: 16, color: '#5d3889' }} />
                            <Typography variant="body2" sx={{ color: '#0f172a' }}>
                              {subtitle}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="body2" sx={{ color: '#334155' }}>
                            No location provided
                          </Typography>
                        )}
                        {thumb ? (
                          <Box
                            component="img"
                            src={thumb}
                            alt=""
                            sx={{
                              ml: 'auto',
                              width: 80,
                              height: 80,
                              objectFit: 'cover',
                              borderRadius: 1.5,
                              border: '1px solid rgba(0,0,0,0.08)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                            }}
                          />
                        ) : null}
                      </Stack>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
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
