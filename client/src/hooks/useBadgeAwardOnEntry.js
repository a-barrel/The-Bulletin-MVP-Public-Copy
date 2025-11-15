import { useEffect } from 'react';
import { awardBadge } from '../api/mongoDataApi';
import { playBadgeSound } from '../utils/badgeSound';
import { useBadgeSound } from '../contexts/BadgeSoundContext';

export default function useBadgeAwardOnEntry(badgeId) {
  const { announceBadgeEarned } = useBadgeSound();

  useEffect(() => {
    if (!badgeId) {
      return;
    }
    let cancelled = false;
    awardBadge(badgeId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result?.granted) {
          playBadgeSound();
          announceBadgeEarned(result?.badgeId ?? badgeId);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [announceBadgeEarned, badgeId]);
}
