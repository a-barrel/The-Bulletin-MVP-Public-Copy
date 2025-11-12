import { useMemo } from 'react';

export default function useProfileBadges(effectiveUser) {
  return useMemo(() => effectiveUser?.badges ?? [], [effectiveUser?.badges]);
}
