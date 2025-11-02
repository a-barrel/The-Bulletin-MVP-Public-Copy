/* NOTE: This module exports the celebration hook alongside the toast component. */
import { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { getBadgeLabel } from '../utils/badges';
import resolveAssetUrl from '../utils/media';

const BADGE_CELEBRATION_GIFS = [
  '/images/badges/badge_obtained_1.gif',
  '/images/badges/badge_obtained_2.gif',
  '/images/badges/badge_obtained_3.gif',
  '/images/badges/badge_obtained_4.gif',
  '/images/badges/badge_obtained_5.gif'
];

export function useBadgeCelebrationToast() {
  const badgeGifUrls = useMemo(
    () => BADGE_CELEBRATION_GIFS.map(resolveAssetUrl).filter(Boolean),
    []
  );

  const [toastState, setToastState] = useState({
    open: false,
    message: '',
    key: 0,
    gifUrl: null
  });

  const announceBadgeEarned = useCallback(
    (badgeId) => {
      if (!badgeId) {
        return;
      }

      const label = getBadgeLabel(badgeId);
      const message = `you earned ${label} badge!!`;
      const gifUrl =
        badgeGifUrls.length > 0
          ? badgeGifUrls[Math.floor(Math.random() * badgeGifUrls.length)]
          : null;

      setToastState({
        open: true,
        message,
        key: Date.now(),
        gifUrl
      });
    },
    [badgeGifUrls]
  );

  const handleClose = useCallback((event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setToastState((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  return {
    toastState,
    announceBadgeEarned,
    handleClose
  };
}

export function BadgeCelebrationToast({ toastState, onClose }) {
  const { open, message, key, gifUrl } = toastState;

  return (
    <Snackbar
      key={key}
      open={open}
      message={
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.1,
            textAlign: 'center'
          }}
        >
          {gifUrl ? (
            <Box
              component="img"
              src={gifUrl}
              alt="Badge celebration"
              sx={{
                width: 'min(165px, 45vw)',
                height: 'auto',
                borderRadius: 2,
                boxShadow: (theme) => theme.shadows[8],
                pointerEvents: 'none'
              }}
            />
          ) : null}
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.85rem' }}
          >
            {message}
          </Typography>
        </Box>
      }
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      autoHideDuration={4000}
      onClose={onClose}
      ContentProps={{
        sx: {
          fontSize: '0.9rem',
          overflow: 'visible',
          display: 'flex',
          justifyContent: 'center',
          py: gifUrl ? 2.25 : 1.5,
          px: 2.25
        }
      }}
    />
  );
}

BadgeCelebrationToast.propTypes = {
  toastState: PropTypes.shape({
    open: PropTypes.bool.isRequired,
    message: PropTypes.string.isRequired,
    key: PropTypes.number.isRequired,
    gifUrl: PropTypes.string
  }).isRequired,
  onClose: PropTypes.func.isRequired
};
