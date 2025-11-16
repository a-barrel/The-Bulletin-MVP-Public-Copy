import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export default function useOfflineNavigation(isOffline) {
  const navigate = useNavigate();

  const navigateIfOnline = useCallback(
    (to, options) => {
      if (isOffline) {
        return;
      }
      return navigate(to, options);
    },
    [isOffline, navigate]
  );

  return { navigateIfOnline };
}
