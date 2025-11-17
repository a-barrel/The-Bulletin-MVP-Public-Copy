import { useCallback, useEffect, useState } from 'react';
import runtimeConfig from '../config/runtime';
import { listContentReports } from '../api/mongoDataApi';

export default function useContentReports(initialStatus = 'pending') {
  const moderationRoleChecksEnabled = runtimeConfig.moderation?.roleChecksEnabled !== false;
  const bypassModerationRoleChecks = runtimeConfig.isOffline || !moderationRoleChecksEnabled;
  const [reportStatus, setReportStatus] = useState(initialStatus);
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const refresh = useCallback(
    async (status = reportStatus) => {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await listContentReports({ status });
        setReports(Array.isArray(payload?.reports) ? payload.reports : []);
        setSummary(payload?.summary ?? null);
        setAccessDenied(false);
      } catch (err) {
        if (err?.status === 403 && moderationRoleChecksEnabled && !bypassModerationRoleChecks) {
          setAccessDenied(true);
          setReports([]);
          setError('Moderator privileges required.');
        } else {
          setError(err?.message || 'Failed to load moderation reports.');
        }
        setReports([]);
        setSummary(null);
      } finally {
        setIsLoading(false);
      }
    },
    [bypassModerationRoleChecks, moderationRoleChecksEnabled, reportStatus]
  );

  useEffect(() => {
    refresh(reportStatus).catch(() => {});
  }, [refresh, reportStatus]);

  return {
    reportStatus,
    setReportStatus,
    reports,
    setReports,
    summary,
    setSummary,
    error,
    setError,
    isLoading,
    refresh,
    accessDenied,
    moderationGuard: { moderationRoleChecksEnabled, bypassModerationRoleChecks }
  };
}
