import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import { REPORT_OFFENSE_LABELS } from '../../constants/reportOffenseOptions';
import { formatFriendlyTimestamp } from '../../utils/dates';

const statusToChipColor = {
  pending: 'warning',
  resolved: 'success',
  dismissed: 'default'
};

function ReportsTable({ reports, onResolveReport, resolvingReportId }) {
  if (!reports.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No reports found for this state.
      </Typography>
    );
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: 'var(--color-text-primary)' }}>Content</TableCell>
            <TableCell sx={{ color: 'var(--color-text-primary)' }}>Reporter</TableCell>
            <TableCell sx={{ color: 'var(--color-text-primary)' }}>Author</TableCell>
            <TableCell sx={{ color: 'var(--color-text-primary)' }}>Status</TableCell>
            <TableCell sx={{ color: 'var(--color-text-primary)' }}>Submitted</TableCell>
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
                      {report.latestSnapshot?.metadata?.title
                        ? `Pin: ${report.latestSnapshot.metadata.title}`
                        : report.latestSnapshot?.message
                        ? report.latestSnapshot.message.slice(0, 120)
                        : report.contentType}
                    </Typography>
                    {report.context ? (
                      <Typography variant="caption" color="text.secondary">
                        {report.context}
                      </Typography>
                    ) : null}
                    {Array.isArray(report.offenseTags) && report.offenseTags.length ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {report.offenseTags.map((offense) => (
                          <Chip
                            key={`${report.id}-${offense}`}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            label={REPORT_OFFENSE_LABELS[offense] || offense}
                          />
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell width="15%" sx={{ color: 'var(--color-text-primary)' }}>
                  {report.reporter?.displayName || report.reporter?.username || 'User'}
                </TableCell>
                <TableCell width="15%" sx={{ color: 'var(--color-text-primary)' }}>
                  {report.contentAuthor?.displayName || report.contentAuthor?.username || 'User'}
                </TableCell>
                <TableCell width="10%">{statusChip}</TableCell>
                <TableCell width="15%" sx={{ color: 'var(--color-text-primary)' }}>
                  {createdAt}
                </TableCell>
                <TableCell width="10%" align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<DoneIcon fontSize="small" />}
                      onClick={() => onResolveReport(report.id, 'resolved')}
                      disabled={resolvingReportId === report.id || report.status === 'resolved'}
                    >
                      Resolve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      startIcon={<DoNotDisturbIcon fontSize="small" />}
                      onClick={() => onResolveReport(report.id, 'dismissed')}
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
  );
}

export default ReportsTable;
