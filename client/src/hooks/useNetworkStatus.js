import { useEffect, useMemo, useState } from 'react';

const getInitialStatus = () => {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return true;
  }
  return navigator.onLine;
};

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(getInitialStatus);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const status = useMemo(
    () => ({
      isOnline,
      isOffline: !isOnline
    }),
    [isOnline]
  );

  return status;
}

export default useNetworkStatus;
