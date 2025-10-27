import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import runtimeConfig from '../config/runtime';
import { playBadgeSound } from '../utils/badgeSound';
import { awardBadge } from '../api/mongoDataApi';

export const pageConfig = {
  id: 'emulation-test',
  label: 'Emulation Test',
  path: '/emulation-test',
  order: 999,
  showInNav: false,
  protected: true
};

const API_BASE_URL = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
const BACKGROUND_URL = `${API_BASE_URL || ''}/images/emulation/gifs/kirby-rushing.gif`;
const OVERLAY_URL = `${API_BASE_URL || ''}/images/emulation/gifs/engine-engineer.gif`;
const SOUND_URL = `${API_BASE_URL || ''}/images/emulation/sounds/gamestartup23.mp3`;

function EmulationTestPage() {
  const audioRef = useRef(null);

  useEffect(() => {
    awardBadge('how-badge')
      .then((result) => {
        if (result?.granted) {
          playBadgeSound();
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) {
      return;
    }

    const attemptPlay = () => {
      node.volume = 0.75;
      node.play().catch(() => {});
    };

    attemptPlay();

    const resumeOnInteraction = () => {
      attemptPlay();
      window.removeEventListener('click', resumeOnInteraction);
      window.removeEventListener('keydown', resumeOnInteraction);
    };

    window.addEventListener('click', resumeOnInteraction);
    window.addEventListener('keydown', resumeOnInteraction);

    return () => {
      window.removeEventListener('click', resumeOnInteraction);
      window.removeEventListener('keydown', resumeOnInteraction);
    };
  }, []);

  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        minHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundImage: `url(${BACKGROUND_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <Box
        component="img"
        src={OVERLAY_URL}
        alt="Engineer animation"
        sx={{
          position: 'absolute',
          top: { xs: '1%', sm: '2%' },
          right: { xs: '4%', sm: '6%' },
          width: { xs: '160px', sm: '220px' },
          height: 'auto',
          pointerEvents: 'none'
        }}
      />
      <Box
        component="img"
        src={OVERLAY_URL}
        alt="Engineer animation mirrored"
        sx={{
          position: 'absolute',
          top: { xs: '1%', sm: '2%' },
          left: { xs: '4%', sm: '6%' },
          width: { xs: '160px', sm: '220px' },
          height: 'auto',
          transform: 'scaleX(-1)',
          pointerEvents: 'none'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: { xs: '15%', sm: '12%' },
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 4,
          py: 1.5,
          borderRadius: 2,
          backgroundColor: 'rgba(15, 15, 15, 0.75)',
          border: '2px solid #000',
          boxShadow: '0 0 15px rgba(255, 170, 34, 0.9)',
          textTransform: 'uppercase',
          letterSpacing: '0.35rem',
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: { xs: '1.75rem', sm: '2.75rem' },
          color: '#ffe97f',
          textShadow: '2px 2px #824b00, -2px -2px #000000, 4px 4px 6px rgba(0, 0, 0, 0.6)'
        }}
      >
        LMAO GOTTEM
      </Box>
      <audio ref={audioRef} src={SOUND_URL} autoPlay loop preload="auto" />
    </Box>
  );
}

export default EmulationTestPage;



