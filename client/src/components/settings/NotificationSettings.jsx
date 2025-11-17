import { Paper, Stack, Typography, Chip, Button, FormControl, FormLabel, Select, MenuItem, Divider } from '@mui/material';
import DoNotDisturbOnIcon from '@mui/icons-material/DoNotDisturbOn';
import RestoreIcon from '@mui/icons-material/Restore';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotificationToggleList from './NotificationToggleList';
import notificationToggleConfig from './notificationToggleConfig';
import notificationBundleConfig from './notificationBundleConfig';
import NotificationQuietHoursEditor from './NotificationQuietHoursEditor';
import NotificationBundleSelector from './NotificationBundleSelector';

function NotificationSettings({
  isOffline,
  isFetchingProfile,
  isMuteActive,
  muteStatusLabel,
  muteCountdownLabel,
  hasMuteTimer,
  onQuickMute,
  onClearMute,
  notifications,
  quietHours,
  onQuietHoursChange,
  notificationVerbosity,
  onVerbosityChange,
  onApplyBundle,
  onToggleNotification,
  digestFrequency,
  onDigestFrequencyChange
}) {
  const chatVerbosity = notificationVerbosity?.chat || 'highlights';

  const handleVerbosityChange = (event) => {
    const value = event.target.value;
    if (typeof onVerbosityChange === 'function') {
      onVerbosityChange('chat', value);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="h6">Notification preferences</Typography>
        <Typography variant="body2" color="text.secondary">
          Choose which updates reach you. Changes apply to both push and in-app alerts.
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'grey.50' }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Quick actions
            </Typography>
            <Chip
              icon={<AccessTimeIcon fontSize="small" />}
              color={isMuteActive ? 'warning' : 'success'}
              label={muteStatusLabel}
              size="small"
            />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DoNotDisturbOnIcon />}
              onClick={() => onQuickMute(1)}
              disabled={isOffline || isFetchingProfile}
            >
              Mute 1h
            </Button>
            <Button
              variant="outlined"
              startIcon={<DoNotDisturbOnIcon />}
              onClick={() => onQuickMute(4)}
              disabled={isOffline || isFetchingProfile}
            >
              Mute 4h
            </Button>
            <Button
              variant="outlined"
              startIcon={<DoNotDisturbOnIcon />}
              onClick={() => onQuickMute(24)}
              disabled={isOffline || isFetchingProfile}
            >
              Mute 24h
            </Button>
            <Button
              variant="text"
              color="inherit"
              startIcon={<RestoreIcon />}
              onClick={onClearMute}
              disabled={!hasMuteTimer}
            >
              Clear mute
            </Button>
          </Stack>
          {isMuteActive ? (
            <Typography variant="caption" color="text.secondary">
              {muteCountdownLabel || 'Mute scheduled. Save your settings to keep it active.'}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Muting pauses delivery without changing the toggles below. Save after applying changes.
            </Typography>
          )}
        </Stack>
      </Paper>

      <NotificationToggleList
        toggles={notificationToggleConfig}
        values={notifications}
        onToggle={onToggleNotification}
        disabled={isOffline}
      />

      <Stack spacing={1}>
        <FormControl size="small" sx={{ maxWidth: 320 }}>
          <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
            Chat notification intensity
          </FormLabel>
          <Select value={chatVerbosity} onChange={handleVerbosityChange} disabled={isOffline}>
            <MenuItem value="highlights">Highlights only</MenuItem>
            <MenuItem value="all">All activity</MenuItem>
            <MenuItem value="muted">Mute chat alerts</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          “Mute” blocks chat message alerts even if the toggle above stays on. “All activity” behaves like Highlights until we expose lower-signal pings.
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <FormControl size="small" sx={{ maxWidth: 320 }}>
          <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
            Digest frequency
          </FormLabel>
          <Select value={digestFrequency} onChange={onDigestFrequencyChange}>
            <MenuItem value="immediate">Send immediately</MenuItem>
            <MenuItem value="daily">Daily summary</MenuItem>
            <MenuItem value="weekly">Weekly summary</MenuItem>
            <MenuItem value="never">Never send digests</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          Digests bundle less-urgent updates (badges, friend activity, marketing) into a single notification.
        </Typography>
      </Stack>

      <Divider />

      <NotificationQuietHoursEditor
        quietHours={quietHours}
        disabled={isOffline || isFetchingProfile}
        onChange={onQuietHoursChange}
      />

      <Divider />

      <NotificationBundleSelector
        bundles={notificationBundleConfig}
        onApplyBundle={onApplyBundle}
        disabled={isOffline || isFetchingProfile}
      />
    </Stack>
  );
}

export default NotificationSettings;
