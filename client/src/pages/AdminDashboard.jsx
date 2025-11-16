/* NOTE: Page exports configuration alongside the component. */
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Typography
} from '@mui/material';
import './AdminDashboard.css';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import RefreshIcon from '@mui/icons-material/Refresh';

import { resolveContentReport } from '../api/mongoDataApi';
import runtimeConfig from '../config/runtime';
import useModerationOverview from '../hooks/useModerationOverview';
import useContentReports from '../hooks/useContentReports';
import ModerationSummaryGrid from '../components/admin/ModerationSummaryGrid';
import ReportStatusTabs from '../components/admin/ReportStatusTabs';
import ReportsTable from '../components/admin/ReportsTable';

export const pageConfig = {
  id: 'admin-dashboard',
  label: 'Admin Dashboard',
  icon: AdminPanelSettingsIcon,
  path: '/admin',
  order: 500,
  showInNav: false,
  protected: true
};

const STATUS_TABS = [
  { value: 'pending', label: 'Pending', icon: null },
  { value: 'resolved', label: 'Resolved', icon: DoneIcon },
  { value: 'dismissed', label: 'Dismissed', icon: DoNotDisturbIcon }
];

const statusToChipColor = {
  pending: 'warning',
  resolved: 'success',
  dismissed: 'default'
};

const formatSummaryCount = (count) =>
  typeof count === 'number' ? (count > 99 ? '99+' : String(count)) : '0';

function AdminDashboard() {
  const {
    overview,
    error: overviewError,
    isLoading: isLoadingOverview,
    refresh: refreshOverview,
    accessDenied: overviewAccessDenied,
    moderationGuard: overviewGuard
  } = useModerationOverview();
  const {
    reportStatus,
    setReportStatus,
    reports,
    setReports,
    summary: reportSummary,
    setSummary: setReportSummary,
    error: reportsError,
    setError: setReportsError,
    isLoading: isLoadingReports,
    refresh: refreshReports,
    accessDenied: reportsAccessDenied,
    moderationGuard: reportsGuard
  } = useContentReports('pending');
  const [resolvingReportId, setResolvingReportId] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const guard = overviewGuard ?? reportsGuard;
  const moderationRoleChecksEnabled =
    guard?.moderationRoleChecksEnabled ?? (runtimeConfig.moderation?.roleChecksEnabled !== false);
  const bypassModerationRoleChecks =
    guard?.bypassModerationRoleChecks ?? (runtimeConfig.isOffline || !moderationRoleChecksEnabled);
  const accessDenied =
    (overviewAccessDenied || reportsAccessDenied) &&
    moderationRoleChecksEnabled &&
    !bypassModerationRoleChecks;
  const handleRefreshAll = useCallback(() => {
    refreshOverview().catch(() => {});
    refreshReports(reportStatus).catch(() => {});
  }, [refreshOverview, refreshReports, reportStatus]);

  const handleStatusChange = useCallback((event, newValue) => {
    if (newValue === reportStatus) {
      return;
    }
    setReportStatus(newValue);
  }, [reportStatus]);

  const handleResolveReport = useCallback(
    async (reportId, nextStatus) => {
      if (!reportId || !nextStatus) {
        return;
      }
      setResolvingReportId(reportId);
      try {
        const response = await resolveContentReport(reportId, { status: nextStatus });
        setSnackbar({
          type: 'success',
          message:
            nextStatus === 'resolved'
              ? 'Report marked as resolved.'
              : 'Report dismissed.'
        });
        setReports((prev) =>
          prev
            .map((report) =>
              report.id === reportId
                ? {
                    ...report,
                    status: nextStatus,
                    resolution: response?.report?.resolution ?? {
                      resolvedAt: new Date().toISOString(),
                      resolvedBy: response?.report?.resolution?.resolvedBy ?? null,
                      notes: response?.report?.resolution?.notes ?? ''
                    }
                  }
                : report
            )
            .filter((report) => (reportStatus === 'pending' ? report.id !== reportId : true))
        );
        if (reportSummary) {
          const updates = { ...reportSummary };
          if (reportStatus === 'pending' && typeof updates.pendingCount === 'number') {
            updates.pendingCount = Math.max(0, updates.pendingCount - 1);
          }
          if (nextStatus === 'resolved' && typeof updates.resolvedTodayCount === 'number') {
            updates.resolvedTodayCount += 1;
          }
          if (nextStatus === 'dismissed' && typeof updates.dismissedCount === 'number') {
            updates.dismissedCount += 1;
          }
          setReportSummary(updates);
        }
      } catch (error) {
        setSnackbar({
          type: 'error',
          message: error?.message || 'Failed to update report.'
        });
      } finally {
        setResolvingReportId(null);
      }
    },
    [reportStatus, reportSummary]
  );

  const overviewStats = useMemo(() => {
    if (!overview) {
      return [];
    }
    const blockedCount = overview.blockedUsers?.length ?? 0;
    const mutedCount = overview.mutedUsers?.length ?? 0;
    const flaggedCount = overview.flaggedUsers?.length ?? 0;
    return [
      {
        label: 'Blocked users',
        value: blockedCount.toLocaleString(),
        description: 'Users you have blocked via moderation tools'
      },
      {
        label: 'Muted users',
        value: mutedCount.toLocaleString(),
        description: 'Users currently muted by moderators'
      },
      {
        label: 'Flagged users',
        value: flaggedCount.toLocaleString(),
        description: 'Users with multiple recent moderation actions'
      }
    ];
  }, [overview]);

  const analyticsStats = useMemo(() => {
    if (!overview?.metrics) {
      return [];
    }
    const pendingReports =
      (reportSummary?.pendingCount ?? overview.metrics.pendingReportCount ?? 0).toLocaleString();
    const shareCount = (overview.metrics.shareEventsLast24h ?? 0).toLocaleString();
    const pushSubscribers = overview.metrics.pushSubscribers ?? overview.metrics.pushOptInCount ?? 0;
    const activeUsers = overview.metrics.activeUsers ?? 0;
    const rate = overview.metrics.pushSubscriptionRate ?? (activeUsers > 0 ? pushSubscribers / activeUsers : 0);
    const pushPercentage = `${Math.round(rate * 100)}%`;

    return [
      {
        label: 'Pending reports',
        value: pendingReports,
        description: 'Unresolved submissions awaiting review'
      },
      {
        label: 'Shares (24h)',
        value: shareCount,
        description: 'pin-share events tracked during the last 24 hours'
      },
      {
        label: 'Push opt-in rate',
        value: pushPercentage,
        description: `${pushSubscribers.toLocaleString()} of ${activeUsers.toLocaleString()} active users`
      }
    ];
  }, [overview?.metrics, reportSummary?.pendingCount]);

  const analyticsAlerts = useMemo(() => {
    const alerts = [];
    const pending = reportSummary?.pendingCount ?? overview?.metrics?.pendingReportCount ?? 0;
    if (pending > 25) {
      alerts.push({
        severity: 'warning',
        message: 'Pending reports exceed 25 items. Consider reassigning reviewers to keep the queue healthy.'
      });
    }
    const shares = overview?.metrics?.shareEventsLast24h ?? 0;
    if (shares > 50) {
      alerts.push({
        severity: 'info',
        message: 'Share activity is spiking; monitor pin submissions for potential spam.'
      });
    }
    if (overview?.metrics) {
      const rate = overview.metrics.pushSubscriptionRate ?? 0;
      if (rate < 0.25 && (overview.metrics.activeUsers ?? 0) >= 50) {
        alerts.push({
          severity: 'info',
          message: 'Push opt-in is below 25%. Consider prompting power users to enable notifications.'
        });
      }
    }
    return alerts;
  }, [overview?.metrics, reportSummary?.pendingCount]);

  if (accessDenied) {
    return (
      <Box
        className="admin-dashboard"
        sx={{
          width: '100%',
          maxWidth: 640,
          mx: 'auto',
          py: { xs: 3, md: 5 },
          px: { xs: 2, md: 4 }
        }}
      >
        <Alert severity="warning">Moderator privileges required to view this dashboard.</Alert>
      </Box>
    );
  }

  return (
    <Box
      className="admin-dashboard"
      sx={{
        width: '100%',
        maxWidth: 1080,
        mx: 'auto',
        py: { xs: 3, md: 5 },
        px: { xs: 2, md: 4 }
      }}
    >
      <Stack spacing={3}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AdminPanelSettingsIcon color="primary" fontSize="large" />
            <Typography variant="h4" component="h1">
              Admin dashboard
            </Typography>
          </Stack>
          <Button
            type="button"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshAll}
            disabled={isLoadingOverview || isLoadingReports}
          >
            Refresh
          </Button>
        </Stack>

        {snackbar ? (
          <Snackbar
            open
            autoHideDuration={4000}
            onClose={(_, reason) => {
              if (reason === 'clickaway') {
                return;
              }
              setSnackbar(null);
            }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              elevation={6}
              variant="filled"
              severity={snackbar.type}
              onClose={() => setSnackbar(null)}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        ) : null}

        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="h6">Moderation overview</Typography>
            <ModerationSummaryGrid
              overviewStats={overviewStats}
              analyticsStats={analyticsStats}
              analyticsAlerts={analyticsAlerts}
              isLoading={isLoadingOverview}
              error={overviewError}
            />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 3 }}>
          <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
            <ReportStatusTabs
              tabs={STATUS_TABS}
              currentStatus={reportStatus}
              onChange={handleStatusChange}
              summary={reportSummary}
              formatCount={formatSummaryCount}
            />

            {reportsError ? (
              <Alert severity="error" onClose={() => setReportsError(null)}>
                {reportsError}
              </Alert>
            ) : null}

            {isLoadingReports ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Loading reports…
                </Typography>
              </Stack>
            ) : (
              <ReportsTable
                reports={reports}
                onResolveReport={handleResolveReport}
                resolvingReportId={resolvingReportId}
              />
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

export default AdminDashboard;
