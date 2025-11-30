/* NOTE: This module exports the celebration hook alongside the toast component. */
import { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Slide from '@mui/material/Slide';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';
import { getBadgeLabel } from '../utils/badges';
import resolveAssetUrl from '../utils/media';

import './BadgeCelebrationToast.css'

const BADGE_CELEBRATION_GIFS = [
  '/images/badges/badge_obtained_1.gif',
  '/images/badges/badge_obtained_2.gif',
  '/images/badges/badge_obtained_3.gif',
  '/images/badges/badge_obtained_4.gif',
  '/images/badges/badge_obtained_5.gif'
];

export function useBadgeCelebrationToast() {
  const { t } = useTranslation();
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
      const message = t('badge.announcement', {
        badge: label,
        defaultValue: `You earned ${label} badge!`
      });
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
    [badgeGifUrls, t]
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

  function SlideDownTransition(props) {
    return <Slide {...props} direction="down" />;
  }

export function BadgeCelebrationToast({ toastState, onClose }) {
  const { t } = useTranslation();
  const { open, message, key, gifUrl } = toastState;

  return (
    <Snackbar
      className="badge-overlay"
      key={key}
      open={open}
      TransitionComponent={SlideDownTransition}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      resumeHideDuration={10000}
      disableWindowBlurListener
      message={
        <Box
          className="badge-wrapper"
          role="button"
          tabIndex={0}
          onClick={(event) => onClose?.(event, 'manual')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onClose?.(event, 'manual');
            }
          }}
        >
          {gifUrl ? (
            <Box
              className="badge-background"
              component="img"
              src={gifUrl}
              alt={t('badge.alt')}
              sx={{
                boxShadow: (theme) => theme.shadows[8],
              }}
            />
          ) : null}
          <Typography className="badge-text-label">
            {message}
          </Typography>
        </Box>
      }
      autoHideDuration={10000}
      onClose={onClose}
      ContentProps={{
        sx: {
          backgroundColor: 'transparent',
          overflow: 'visible',
          display: 'flex',
          justifyContent: 'flex-end',
          boxShadow: 'none',
          p: 0,
          m: 0
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
