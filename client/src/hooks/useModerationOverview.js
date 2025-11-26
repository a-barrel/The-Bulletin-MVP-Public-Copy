import { useCallback, useEffect, useState } from 'react';
import runtimeConfig from '../config/runtime';
import { fetchModerationOverview } from '../api/mongoDataApi';

export default function useModerationOverview() {
  const moderationRoleChecksEnabled = runtimeConfig.moderation?.roleChecksEnabled !== false;
  const bypassModerationRoleChecks = runtimeConfig.isOffline || !moderationRoleChecksEnabled;
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchModerationOverview();
      setOverview(payload);
      setAccessDenied(false);
    } catch (err) {
      if (err?.status === 403 && moderationRoleChecksEnabled && !bypassModerationRoleChecks) {
        setAccessDenied(true);
        setOverview(null);
        setError(null);
        return null;
      } else {
        setError(err?.message || 'Failed to load moderation overview.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [bypassModerationRoleChecks, moderationRoleChecksEnabled]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  return {
    overview,
    error,
    isLoading,
    refresh,
    accessDenied,
    moderationGuard: { moderationRoleChecksEnabled, bypassModerationRoleChecks }
  };
}
