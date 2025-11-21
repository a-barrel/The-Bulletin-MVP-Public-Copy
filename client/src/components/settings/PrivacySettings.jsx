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
  
  return (
    <Stack spacing={2}>
      <SettingsAccordion
        title="Privacy & sharing"
        description="Your location is used only to enable features (radius checks, proximity chat). It is never shared with other users."
      >
        <Typography variant="body2" sx={{ color: settingsPalette.textPrimary }}>
          Location is required to confirm you are in-range for map interactions, but your exact
          location is never shown to other people.
        </Typography>
      </SettingsAccordion>

      <SettingsAccordion
        title="Profile visibility"
        description="Decide how much information other members can see."
        defaultExpanded={false}
      >
        <FormControlLabel
          control={<Switch checked={settings.statsPublic} onChange={onStatsVisibilityToggle} />}
          label="Allow others to view my stats"
          sx={settingsToggleLabelSx}
        />
        <FormControlLabel
          control={<Switch checked={settings.filterCussWords} onChange={onFilterCussWordsToggle} />}
          label="Filter explicit language in public chats"
          sx={settingsToggleLabelSx}
        />
      </SettingsAccordion>

      <SettingsAccordion
        title="Direct messages"
        description="Choose who can start new conversations with you."
        defaultExpanded={false}
      >
        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontSize: '0.875rem', color: settingsPalette.accent }}>
            Who can DM me?
          </FormLabel>
          <RadioGroup
            value={dmPermission}
            onChange={onDmPermissionChange}
            sx={{
              color: settingsPalette.textPrimary,
              '& .MuiFormControlLabel-label': { color: settingsPalette.textPrimary }
            }}
          >
            <FormControlLabel value="everyone" control={<Radio />} label="Everyone" />
            <FormControlLabel value="friends" control={<Radio />} label="Friends & followers" />
            <FormControlLabel value="nobody" control={<Radio />} label="No one (mute DMs)" />
          </RadioGroup>
          <Typography variant="caption" sx={mutedTextSx}>
            Friends-only mode also allows people who follow you. Selecting “No one” hides you from new threads.
          </Typography>
        </FormControl>
      </SettingsAccordion>

      <SettingsAccordion
        title="Account management"
        description="Block someone or jump into admin/profile views."
        defaultExpanded={false}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            onClick={onManageBlockedUsers}
            variant="outlined"
            startIcon={<BlockIcon />}
            disabled={isOffline || isManagingBlockedUsers}
            title={isOffline ? 'Reconnect to manage blocked users' : undefined}
            sx={{
              borderColor: '#B3261E',
              color: '#B3261E',
              borderRadius: 999,
              fontWeight: 600,
              '&:hover': {
                borderColor: '#7A2017',
                backgroundColor: '#FFE5E0',
                color: '#7A2017'
              },
              '&:disabled': {
                borderColor: settingsPalette.borderSubtle,
                color: settingsPalette.borderSubtle
              }
            }}
          >
            Manage blocked users
          </Button>
          {canAccessAdminDashboard ? (
            <Button
              component={Link}
              to={adminRoute}
              variant="outlined"
              startIcon={<AdminPanelSettingsIcon />}
              sx={settingsButtonStyles.outlined}
            >
              Admin dashboard
            </Button>
          ) : null}
          <Button
            component={Link}
            to={profileRoute}
            variant="outlined"
            startIcon={<ManageAccountsIcon />}
            sx={settingsButtonStyles.outlined}
          >
            View profile
          </Button>
        </Stack>
      </SettingsAccordion>
    </Stack>
  );
}

export default PrivacySettings;
