import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';

import { auth } from '../firebase';
import { revokeCurrentSession } from '../api';
import clearClientCaches from '../utils/clearClientCaches';

export default function useLogoutEffect({ onSuccess, onError }) {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        try {
          await revokeCurrentSession();
        } catch (sessionError) {
          if (import.meta.env.DEV) {
            console.error('Failed to revoke server session during logout.', sessionError);
          }
        }
        await signOut(auth);
        await clearClientCaches();
        if (!cancelled) {
          setError(null);
          if (typeof onSuccess === 'function') {
            onSuccess();
          }
        }
      } catch (logoutError) {
        if (!cancelled) {
          setError(logoutError);
          if (typeof onError === 'function') {
            onError(logoutError);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [onError, onSuccess]);

  return { isLoading, error };
}
