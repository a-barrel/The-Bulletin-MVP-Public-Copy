import { Chip, Stack, Tab, Tabs, Typography } from '@mui/material';

function ReportStatusTabs({ tabs, currentStatus, onChange, summary, formatCount }) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <Typography variant="h6">Content moderation queue</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={`Pending ${formatCount(summary?.pendingCount)}`}
            color="warning"
            variant={currentStatus === 'pending' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`Resolved today ${formatCount(summary?.resolvedTodayCount)}`}
            color="success"
            variant={currentStatus === 'resolved' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`Dismissed ${formatCount(summary?.dismissedCount)}`}
            color="default"
            variant={currentStatus === 'dismissed' ? 'filled' : 'outlined'}
          />
        </Stack>
      </Stack>

      <Tabs value={currentStatus} onChange={onChange} variant="scrollable" allowScrollButtonsMobile>
        {tabs.map(({ value, label, icon: IconComponent }) => (
          <Tab
            key={value}
            value={value}
            label={label}
            icon={IconComponent ? <IconComponent fontSize="small" /> : undefined}
            iconPosition="start"
          />
        ))}
      </Tabs>
    </Stack>
  );
}

export default ReportStatusTabs;
