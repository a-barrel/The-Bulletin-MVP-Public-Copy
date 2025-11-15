import { useEffect, useRef } from 'react';

export default function useAutoplayAudio({ volume = 0.75 } = {}) {
  const audioRef = useRef(null);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) {
      return undefined;
    }

    const attemptPlay = () => {
      node.volume = volume;
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
  }, [volume]);

  return audioRef;
}
