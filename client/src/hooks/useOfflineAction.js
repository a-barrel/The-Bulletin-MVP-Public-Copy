import { useCallback } from 'react';

export default function useOfflineAction(isOffline, { onBlocked } = {}) {
  return useCallback(
    (nextAction) => {
      if (isOffline) {
        if (typeof onBlocked === 'function') {
          onBlocked();
        }
        return;
      }
      if (typeof nextAction === 'function') {
        nextAction();
      }
    },
    [isOffline, onBlocked]
  );
}
