import PropTypes from 'prop-types';
import { Paper, Stack, Typography } from '@mui/material';
import NotificationSettings from './NotificationSettings';
import settingsPalette from './settingsPalette';

export default function SettingsNotificationsSection({
  notifications,
  notificationVerbosity,
  quietHours,
  isMuteActive,
  muteStatusLabel,
  muteCountdownLabel,
  onNotificationToggle,
  onQuickMute,
  onClearMute,
  onQuietHoursChange,
  onNotificationVerbosityChange,
  onApplyNotificationBundle,
  digestFrequency,
  onDigestFrequencyChange,
  autoExportReminders,
  onAutoExportRemindersToggle
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
        border: `1px solid ${settingsPalette.borderSubtle}`,
        boxShadow: '0 12px 30px rgba(93, 56, 137, 0.1)'
      }}
    >
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700 }}>
          Notifications
        </Typography>
        <NotificationSettings
          notifications={notifications}
          quietHours={quietHours}
          isMuteActive={isMuteActive}
          muteStatusLabel={muteStatusLabel}
          muteCountdownLabel={muteCountdownLabel}
          onToggleNotification={onNotificationToggle}
          onQuickMute={onQuickMute}
          onClearMute={onClearMute}
          onQuietHoursChange={onQuietHoursChange}
          notificationVerbosity={notificationVerbosity}
          onNotificationVerbosityChange={onNotificationVerbosityChange}
          onApplyNotificationBundle={onApplyNotificationBundle}
          digestFrequency={digestFrequency}
          onDigestFrequencyChange={onDigestFrequencyChange}
          autoExportReminders={autoExportReminders}
          onAutoExportRemindersToggle={onAutoExportRemindersToggle}
        />
      </Stack>
    </Paper>
  );
}

SettingsNotificationsSection.propTypes = {
  notifications: PropTypes.object.isRequired,
  notificationVerbosity: PropTypes.object.isRequired,
  quietHours: PropTypes.array.isRequired,
  isMuteActive: PropTypes.bool.isRequired,
  muteStatusLabel: PropTypes.string.isRequired,
  muteCountdownLabel: PropTypes.string.isRequired,
  onNotificationToggle: PropTypes.func.isRequired,
  onQuickMute: PropTypes.func.isRequired,
  onClearMute: PropTypes.func.isRequired,
  onQuietHoursChange: PropTypes.func.isRequired,
  onNotificationVerbosityChange: PropTypes.func.isRequired,
  onApplyNotificationBundle: PropTypes.func.isRequired,
  digestFrequency: PropTypes.string.isRequired,
  onDigestFrequencyChange: PropTypes.func.isRequired,
  autoExportReminders: PropTypes.bool.isRequired,
  onAutoExportRemindersToggle: PropTypes.func.isRequired
};
