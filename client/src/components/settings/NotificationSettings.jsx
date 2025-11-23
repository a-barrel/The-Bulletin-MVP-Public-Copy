import { Chip, Button, FormControl, FormLabel, Select, MenuItem, Stack, Typography } from '@mui/material';
import DoNotDisturbOnIcon from '@mui/icons-material/DoNotDisturbOn';
import RestoreIcon from '@mui/icons-material/Restore';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotificationToggleList from './NotificationToggleList';
import notificationToggleConfig from './notificationToggleConfig';
import notificationBundleConfig from './notificationBundleConfig';
import NotificationQuietHoursEditor from './NotificationQuietHoursEditor';
import NotificationBundleSelector from './NotificationBundleSelector';
import SettingsAccordion from './SettingsAccordion';
import settingsPalette, { mutedTextSx, settingsButtonStyles } from './settingsPalette';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
        <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700 }}>
          Notification preferences
        </Typography>
        <Typography variant="body2" sx={{ color: settingsPalette.textPrimary }}>
          Choose which updates reach you. Changes apply to both push and in-app alerts.
        </Typography>
      </Stack>

      <SettingsAccordion
        title={t('tooltips.settings.quickActions')}
        description={t('notifications.quickActionsDescription', {
          defaultValue: 'Mute delivery temporarily without changing your preferences.'
        })}
      >
        <Stack spacing={1.5} sx={{ color: settingsPalette.textPrimary }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DoNotDisturbOnIcon />}
              onClick={() => onQuickMute(1)}
              disabled={isOffline || isFetchingProfile}
              sx={settingsButtonStyles.outlined}
            >
              {t('notifications.mute1h', { defaultValue: 'Mute 1h' })}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DoNotDisturbOnIcon />}
              onClick={() => onQuickMute(4)}
              disabled={isOffline || isFetchingProfile}
              sx={settingsButtonStyles.outlined}
            >
              {t('notifications.mute4h', { defaultValue: 'Mute 4h' })}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DoNotDisturbOnIcon />}
              onClick={() => onQuickMute(24)}
              disabled={isOffline || isFetchingProfile}
              sx={settingsButtonStyles.outlined}
            >
              {t('notifications.mute24h', { defaultValue: 'Mute 24h' })}
            </Button>
            <Button
              variant="text"
              color="inherit"
              startIcon={<RestoreIcon />}
              onClick={onClearMute}
              disabled={!hasMuteTimer}
              sx={settingsButtonStyles.text}
            >
              {t('notifications.clearMute', { defaultValue: 'Clear mute' })}
            </Button>
          </Stack>
          {isMuteActive ? (
            <Typography variant="caption" sx={mutedTextSx}>
              {muteCountdownLabel || t('notifications.muteActive', { defaultValue: 'Mute scheduled. Save your settings to keep it active.' })}
            </Typography>
          ) : (
            <Typography variant="caption" sx={mutedTextSx}>
              {t('notifications.muteInactive', { defaultValue: 'Muting pauses delivery without changing the toggles below. Save after applying changes.' })}
            </Typography>
          )}
        </Stack>
        <Chip
          icon={<AccessTimeIcon fontSize="small" />}
          label={muteStatusLabel}
          size="small"
          sx={{
            alignSelf: 'flex-start',
            mt: 2,
            backgroundColor: isMuteActive ? '#FFE5E0' : settingsPalette.pastelBlue,
            border: `1px solid ${isMuteActive ? '#FF3B30' : settingsPalette.accentLight}`,
            color: isMuteActive ? '#B3261E' : settingsPalette.textPrimary,
            fontWeight: 600,
            '& .MuiChip-icon': {
              color: isMuteActive ? '#B3261E' : settingsPalette.accent
            }
          }}
        />
      </SettingsAccordion>

      <SettingsAccordion
        title={t('tooltips.settings.notificationChannels')}
        description={t('notifications.channelsDescription', { defaultValue: 'Choose which updates reach you across the app.' })}
      >
        <NotificationToggleList
          toggles={notificationToggleConfig}
          values={notifications}
          onToggle={onToggleNotification}
          disabled={isOffline}
        />
      </SettingsAccordion>

      <SettingsAccordion
        title={t('tooltips.settings.chatIntensity')}
        description={t('notifications.chatIntensityDescription', { defaultValue: 'Fine-tune how often direct messages and chat highlights ping you.' })}
        defaultExpanded={false}
      >
        <Stack spacing={1}>
          <FormControl size="small" sx={{ maxWidth: 320 }}>
            <FormLabel
              component="legend"
              sx={{ fontSize: '0.875rem', mb: 0.5, color: settingsPalette.accent }}
            >
              {t('notifications.chatIntensityLabel', { defaultValue: 'Chat notification intensity' })}
            </FormLabel>
            <Select
              value={chatVerbosity}
              onChange={handleVerbosityChange}
              disabled={isOffline}
              sx={{
                borderRadius: 2,
                color: settingsPalette.textPrimary,
                '& .MuiSelect-select': { borderRadius: 2, backgroundColor: '#FFFFFF' },
                '& fieldset': { borderColor: settingsPalette.borderSubtle, borderRadius: 2 }
              }}
            >
              <MenuItem value="highlights">{t('notifications.chatIntensityHighlights', { defaultValue: 'Highlights only' })}</MenuItem>
              <MenuItem value="all">{t('notifications.chatIntensityAll', { defaultValue: 'All activity' })}</MenuItem>
              <MenuItem value="muted">{t('notifications.chatIntensityMuted', { defaultValue: 'Mute chat alerts' })}</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" sx={mutedTextSx}>
            {t('notifications.chatIntensityNote', { defaultValue: '“Mute” blocks chat alerts even if the toggle above stays on. “All activity” behaves like Highlights until we surface lower-signal pings.' })}
          </Typography>
        </Stack>
      </SettingsAccordion>

      <SettingsAccordion
        title={t('tooltips.settings.digestFrequency')}
        description={t('notifications.digestDescription', { defaultValue: 'Bundle low-priority updates into daily or weekly recaps.' })}
        defaultExpanded={false}
      >
        <Stack spacing={1}>
          <FormControl size="small" sx={{ maxWidth: 320 }}>
            <FormLabel
              component="legend"
              sx={{ fontSize: '0.875rem', mb: 0.5, color: settingsPalette.accent }}
            >
              {t('notifications.digestLabel', { defaultValue: 'Digest frequency' })}
            </FormLabel>
            <Select
              value={digestFrequency}
              onChange={onDigestFrequencyChange}
              sx={{
                borderRadius: 2,
                color: settingsPalette.textPrimary,
                '& .MuiSelect-select': { borderRadius: 2, backgroundColor: '#FFFFFF' },
                '& fieldset': { borderColor: settingsPalette.borderSubtle, borderRadius: 2 }
              }}
            >
              <MenuItem value="immediate">{t('notifications.digestImmediate', { defaultValue: 'Send immediately' })}</MenuItem>
              <MenuItem value="daily">{t('notifications.digestDaily', { defaultValue: 'Daily summary' })}</MenuItem>
              <MenuItem value="weekly">{t('notifications.digestWeekly', { defaultValue: 'Weekly summary' })}</MenuItem>
              <MenuItem value="never">{t('notifications.digestNever', { defaultValue: 'Never send digests' })}</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" sx={mutedTextSx}>
            Digests bundle less-urgent updates (badges, friend activity, marketing) into a single notification.
          </Typography>
        </Stack>
      </SettingsAccordion>

      <SettingsAccordion
        title={t('tooltips.settings.quietHours')}
        description={t('notifications.quietDescription', { defaultValue: 'Pause non-critical notifications on a weekly schedule.' })}
        defaultExpanded={false}
      >
        <NotificationQuietHoursEditor
          quietHours={quietHours}
          disabled={isOffline || isFetchingProfile}
          onChange={onQuietHoursChange}
        />
      </SettingsAccordion>

      <SettingsAccordion
        title={t('tooltips.settings.channelBundles')}
        description={t('notifications.channelBundlesDescription', { defaultValue: 'Start from a preset and then tweak individual toggles.' })}
        defaultExpanded={false}
      >
        <NotificationBundleSelector
          bundles={notificationBundleConfig}
          onApplyBundle={onApplyBundle}
          disabled={isOffline || isFetchingProfile}
        />
      </SettingsAccordion>
    </Stack>
  );
}

export default NotificationSettings;
