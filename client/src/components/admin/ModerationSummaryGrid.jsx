import { Alert, Paper, Stack, Typography } from '@mui/material';
import LoadingOverlay from '../LoadingOverlay';

function ModerationSummaryGrid({
  overviewStats,
  analyticsStats,
  analyticsAlerts,
  isLoading,
  error
}) {
  return (
    <Stack spacing={3}>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : null}

      {isLoading ? (
        <LoadingOverlay label="Loading overview…" minHeight={220} />
      ) : (
        <>
          {overviewStats.length ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {overviewStats.map((stat) => (
                <Paper
                  key={stat.label}
                  elevation={0}
                  sx={{ flex: 1, borderRadius: 2, p: 2, border: '1px solid', borderColor: 'divider' }}
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
                  sx={{ flex: 1, borderRadius: 2, p: 2, border: '1px solid', borderColor: 'divider' }}
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
        </>
      )}
    </Stack>
  );
}

export default ModerationSummaryGrid;
