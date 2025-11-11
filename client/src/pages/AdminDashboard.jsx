/* NOTE: Page exports configuration alongside the component. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Typography
} from '@mui/material';
import './AdminDashboard.css';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneIcon from '@mui/icons-material/Done';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';

import { fetchModerationOverview } from '../api/mongoDataApi';
import { listContentReports, resolveContentReport } from '../api/mongoDataApi';
import { formatFriendlyTimestamp } from '../utils/dates';

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
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  const [reportStatus, setReportStatus] = useState('pending');
  const [reports, setReports] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);
  const [reportsError, setReportsError] = useState(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [resolvingReportId, setResolvingReportId] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const loadOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    setOverviewError(null);
    try {
      const payload = await fetchModerationOverview();
      setOverview(payload);
    } catch (error) {
      setOverviewError(error?.message || 'Failed to load moderation overview.');
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  const loadReports = useCallback(
    async (status = reportStatus) => {
      setIsLoadingReports(true);
      setReportsError(null);
      try {
        const payload = await listContentReports({ status });
        setReports(Array.isArray(payload?.reports) ? payload.reports : []);
        setReportSummary(payload?.summary ?? null);
      } catch (error) {
        setReportsError(error?.message || 'Failed to load moderation reports.');
        setReports([]);
      } finally {
        setIsLoadingReports(false);
      }
    },
    [reportStatus]
  );

  useEffect(() => {
    loadOverview().catch(() => {});
  }, [loadOverview]);

  useEffect(() => {
    loadReports(reportStatus).catch(() => {});
  }, [loadReports, reportStatus]);

  const handleRefreshAll = useCallback(() => {
    loadOverview().catch(() => {});
    loadReports(reportStatus).catch(() => {});
  }, [loadOverview, loadReports, reportStatus]);

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
            {overviewError ? (
              <Alert severity="error" onClose={() => setOverviewError(null)}>
                {overviewError}
              </Alert>
            ) : null}
            {isLoadingOverview ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Loading moderation metrics…
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                >
                  {overviewStats.map((stat) => (
                    <Paper
                      key={stat.label}
                      elevation={0}
                      sx={{
                        flex: 1,
                        borderRadius: 2,
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <Typography variant="subtitle2" color="text.secondary">
                        {stat.label}
                      </Typography>
                      <Typography variant="h4">{stat.value}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {stat.description}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>

                {analyticsStats.length ? (
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                  >
                    {analyticsStats.map((stat) => (
                      <Paper
                        key={stat.label}
                        elevation={0}
                        sx={{
                          flex: 1,
                          borderRadius: 2,
                          p: 2,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Typography variant="subtitle2" color="text.secondary">
                          {stat.label}
                        </Typography>
                        <Typography variant="h4">{stat.value}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stat.description}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : null}

                {analyticsAlerts.map((alert, index) => (
                  <Alert key={`${alert.severity}-${index}`} severity={alert.severity} variant="outlined">
                    {alert.message}
                  </Alert>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 3 }}>
          <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
            >
              <Typography variant="h6">Content moderation queue</Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={`Pending ${formatSummaryCount(reportSummary?.pendingCount)}`}
                  color="warning"
                  variant={reportStatus === 'pending' ? 'filled' : 'outlined'}
                />
                <Chip
                  label={`Resolved today ${formatSummaryCount(reportSummary?.resolvedTodayCount)}`}
                  color="success"
                  variant={reportStatus === 'resolved' ? 'filled' : 'outlined'}
                />
                <Chip
                  label={`Dismissed ${formatSummaryCount(reportSummary?.dismissedCount)}`}
                  color="default"
                  variant={reportStatus === 'dismissed' ? 'filled' : 'outlined'}
                />
              </Stack>
            </Stack>

            <Tabs
              value={reportStatus}
              onChange={handleStatusChange}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              {STATUS_TABS.map(({ value, label, icon: IconComponent }) => (
                <Tab
                  key={value}
                  value={value}
                  label={label}
                  icon={IconComponent ? <IconComponent fontSize="small" /> : undefined}
                  iconPosition="start"
                />
              ))}
            </Tabs>

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
            ) : reports.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No reports found for this state.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Content</TableCell>
                      <TableCell>Reporter</TableCell>
                      <TableCell>Author</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Submitted</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reports.map((report) => {
                      const createdAt = formatFriendlyTimestamp(report.createdAt) || report.createdAt;
                      const statusChip = (
                        <Chip
                          size="small"
                          label={report.status}
                          color={statusToChipColor[report.status] ?? 'default'}
                          variant="outlined"
                        />
                      );
                      return (
                        <TableRow key={report.id} hover>
                          <TableCell width="35%">
                            <Stack spacing={0.5}>
                              <Typography variant="subtitle2">
                                {report.latestSnapshot?.message
                                  ? report.latestSnapshot.message.slice(0, 120)
                                  : report.contentType}
                              </Typography>
                              {report.context ? (
                                <Typography variant="caption" color="text.secondary">
                                  {report.context}
                                </Typography>
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell width="15%">
                            {report.reporter?.displayName || report.reporter?.username || 'User'}
                          </TableCell>
                          <TableCell width="15%">
                            {report.contentAuthor?.displayName ||
                              report.contentAuthor?.username ||
                              'User'}
                          </TableCell>
                          <TableCell width="10%">{statusChip}</TableCell>
                          <TableCell width="15%">{createdAt}</TableCell>
                          <TableCell width="10%" align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<DoneIcon fontSize="small" />}
                                onClick={() => handleResolveReport(report.id, 'resolved')}
                                disabled={resolvingReportId === report.id || report.status === 'resolved'}
                              >
                                Resolve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                startIcon={<DoNotDisturbIcon fontSize="small" />}
                                onClick={() => handleResolveReport(report.id, 'dismissed')}
                                disabled={resolvingReportId === report.id || report.status === 'dismissed'}
                              >
                                Dismiss
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

export default AdminDashboard;
