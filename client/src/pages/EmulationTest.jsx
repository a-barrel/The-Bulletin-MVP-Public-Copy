/* NOTE: Page exports configuration alongside the component. */
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import resolveAssetUrl from '../utils/media';
import useBadgeAwardOnEntry from '../hooks/useBadgeAwardOnEntry';
import useAutoplayAudio from '../hooks/useAutoplayAudio';

export const pageConfig = {
  id: 'emulation-test',
  label: 'Emulation Test',
  path: '/emulation-test',
  order: 999,
  showInNav: false,
  protected: true
};

function EmulationTestPage() {
  const backgroundUrl = useMemo(
    () => resolveAssetUrl('/images/emulation/gifs/kirby-rushing.gif'),
    []
  );
  const overlayUrl = useMemo(
    () => resolveAssetUrl('/images/emulation/gifs/engine-engineer.gif'),
    []
  );
  const soundUrl = useMemo(
    () => resolveAssetUrl('/images/emulation/sounds/gamestartup23.mp3'),
    []
  );

  useBadgeAwardOnEntry('how-badge');
  const audioRef = useAutoplayAudio({ volume: 0.75 });

  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        minHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <Box
        component="img"
        src={overlayUrl}
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
        src={overlayUrl}
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
          border: '2px solid var(--color-border-strong)',
          boxShadow: '0 0 15px color-mix(in srgb, var(--accent-warn) 90%, transparent)',
          textTransform: 'uppercase',
          letterSpacing: '0.35rem',
          fontFamily: '"Trebuchet MS", Verdana, sans-serif',
          fontSize: { xs: '1.75rem', sm: '2.75rem' },
          color: 'var(--accent-warn)',
          textShadow: '2px 2px var(--accent-strong), -2px -2px var(--color-surface), 4px 4px 6px rgba(0, 0, 0, 0.6)'
        }}
      >
        LMAO GOTTEM
      </Box>
      <audio ref={audioRef} src={soundUrl} autoPlay loop preload="auto" />
    </Box>
  );
}

export default EmulationTestPage;
