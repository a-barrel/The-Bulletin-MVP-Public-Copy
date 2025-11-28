import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCurrentUserProfile } from '../api';
import { useUserCache } from '../contexts/UserCacheContext';

export default function useViewerProfile({ enabled = true, skip = false } = {}) {
  const mountedRef = useRef(true);
  const userCache = useUserCache();
  const [viewer, setViewer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const shouldFetch = enabled && !skip;

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const safeSetState = useCallback((updater) => {
    if (mountedRef.current) {
      updater();
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!shouldFetch) {
      safeSetState(() => {
        setViewer(null);
        setError(null);
        setIsLoading(false);
      });
      return null;
    }

    const cached = userCache.getMe();
    if (cached) {
      safeSetState(() => {
        setViewer(cached);
        setError(null);
        setIsLoading(false);
      });
      return cached;
    }

    safeSetState(() => {
      setIsLoading(true);
      setError(null);
    });

    try {
      const profile = await fetchCurrentUserProfile();
      safeSetState(() => {
        setViewer(profile ?? null);
        if (profile) {
          userCache.setMe(profile);
        }
      });
      return profile ?? null;
    } catch (err) {
      safeSetState(() => {
        setViewer(null);
        setError(err?.message || 'Failed to load profile.');
      });
      throw err;
    } finally {
      safeSetState(() => {
        setIsLoading(false);
      });
    }
  }, [safeSetState, shouldFetch]);

  useEffect(() => {
    if (!shouldFetch) {
      safeSetState(() => {
        setViewer(null);
        setError(null);
        setIsLoading(false);
      });
      return;
    }
    loadProfile().catch(() => {});
  }, [loadProfile, safeSetState, shouldFetch]);

  return {
    viewer,
    isLoading: isLoading && shouldFetch,
    error,
    refresh: loadProfile
  };
}
