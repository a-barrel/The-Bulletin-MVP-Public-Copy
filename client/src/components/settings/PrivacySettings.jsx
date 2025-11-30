import { Link } from 'react-router-dom';
import {
  Stack,
  Typography,
  FormControlLabel,
  RadioGroup,
  Radio,
  Button,
  Switch,
  FormControl,
  FormLabel
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SettingsAccordion from './SettingsAccordion';
import settingsPalette, {
  mutedTextSx,
  settingsButtonStyles,
  settingsToggleLabelSx
} from './settingsPalette';
import { useTranslation } from 'react-i18next';

function PrivacySettings({
  settings,
  onStatsVisibilityToggle,
  onFilterCussWordsToggle,
  dmPermission,
  onDmPermissionChange,
  onManageBlockedUsers,
  canAccessAdminDashboard,
  adminRoute,
  profileRoute,
  isManagingBlockedUsers,
  isOffline
}) {
  const { t } = useTranslation();
  
  return (
    <Stack spacing={2}>
      <SettingsAccordion
        title={t('tooltips.settings.privacySharing')}
        description={t('privacy.sharingDescription', {
          defaultValue:
            'Your location is used only to enable features (radius checks, proximity chat). It is never shared with other users.'
        })}
      >
        <Typography variant="body2" sx={{ color: settingsPalette.textPrimary }}>
          {t('privacy.sharingBody', {
            defaultValue:
              'Location is required to confirm you are in-range for map interactions, but your exact location is never shown to other people.'
          })}
        </Typography>
      </SettingsAccordion>

      <SettingsAccordion
        title={t('tooltips.settings.profileVisibility')}
        description={t('privacy.visibilityDescription', {
          defaultValue: 'Decide how much information other members can see.'
        })}
        defaultExpanded={false}
      >
        <FormControlLabel
          control={<Switch checked={settings.statsPublic} onChange={onStatsVisibilityToggle} />}
          label={t('privacy.statsPublic', { defaultValue: 'Allow others to view my stats' })}
          sx={settingsToggleLabelSx}
        />
        <FormControlLabel
          control={<Switch checked={settings.filterCussWords} onChange={onFilterCussWordsToggle} />}
          label={t('privacy.filterCussWords', { defaultValue: 'Filter explicit language in public chats' })}
          sx={settingsToggleLabelSx}
        />
      </SettingsAccordion>

      <SettingsAccordion
        title={t('tooltips.settings.directMessages')}
        description={t('privacy.dmDescription', {
          defaultValue: 'Choose who can start new conversations with you.'
        })}
        defaultExpanded={false}
      >
        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontSize: '0.875rem', color: settingsPalette.accent }}>
            {t('privacy.dmLabel', { defaultValue: 'Who can DM me?' })}
          </FormLabel>
          <RadioGroup
            value={dmPermission}
            onChange={onDmPermissionChange}
            sx={{
              color: settingsPalette.textPrimary,
              '& .MuiFormControlLabel-label': { color: settingsPalette.textPrimary }
            }}
          >
            <FormControlLabel value="everyone" control={<Radio />} label={t('privacy.dmEveryone', { defaultValue: 'Everyone' })} />
            <FormControlLabel value="friends" control={<Radio />} label={t('privacy.dmFriends', { defaultValue: 'Friends & followers' })} />
            <FormControlLabel value="nobody" control={<Radio />} label={t('privacy.dmNobody', { defaultValue: 'No one (mute DMs)' })} />
          </RadioGroup>
          <Typography variant="caption" sx={mutedTextSx}>
            {t('privacy.dmNote', {
              defaultValue:
                'Friends-only mode also allows people who follow you. Selecting “No one” hides you from new threads.'
            })}
          </Typography>
        </FormControl>
      </SettingsAccordion>

      <SettingsAccordion
        title={t('tooltips.settings.accountManagement')}
        description={t('privacy.accountDescription', {
          defaultValue: 'Block someone or jump into admin/profile views.'
        })}
        defaultExpanded={false}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            onClick={onManageBlockedUsers}
            variant="outlined"
            startIcon={<BlockIcon />}
            disabled={isOffline || isManagingBlockedUsers}
            title={isOffline ? t('tooltips.settings.blockedUsers') : undefined}
            sx={{
              borderColor: 'var(--color-danger)',
              color: 'var(--color-danger)',
              borderRadius: 999,
              fontWeight: 600,
              '&:hover': {
                borderColor: 'color-mix(in srgb, var(--color-danger) 80%, transparent)',
                backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))',
                color: 'color-mix(in srgb, var(--color-danger) 80%, transparent)'
              },
              '&:disabled': {
                borderColor: settingsPalette.borderSubtle,
                color: settingsPalette.borderSubtle
              }
            }}
          >
            {t('privacy.manageBlocked', { defaultValue: 'Manage blocked users' })}
          </Button>
          {canAccessAdminDashboard ? (
            <Button
              component={Link}
              to={adminRoute}
              variant="outlined"
              startIcon={<AdminPanelSettingsIcon />}
              sx={settingsButtonStyles.outlined}
            >
              {t('privacy.adminDashboard', { defaultValue: 'Admin dashboard' })}
            </Button>
          ) : null}
          <Button
            component={Link}
            to={profileRoute}
            variant="outlined"
            startIcon={<ManageAccountsIcon />}
            sx={settingsButtonStyles.outlined}
          >
            {t('privacy.viewProfile', { defaultValue: 'View profile' })}
          </Button>
        </Stack>
      </SettingsAccordion>
    </Stack>
  );
}

export default PrivacySettings;
