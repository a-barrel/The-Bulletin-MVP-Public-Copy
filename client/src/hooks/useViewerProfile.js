import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCurrentUserProfile } from '../api';

export default function useViewerProfile({ enabled = true, skip = false } = {}) {
  const mountedRef = useRef(true);
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

    safeSetState(() => {
      setIsLoading(true);
      setError(null);
    });

    try {
      const profile = await fetchCurrentUserProfile();
      safeSetState(() => {
        setViewer(profile ?? null);
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
