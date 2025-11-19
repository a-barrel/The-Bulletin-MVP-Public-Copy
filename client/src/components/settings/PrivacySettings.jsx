import { Link } from 'react-router-dom';
import {
  Stack,
  Typography,
  FormControlLabel,
  Switch,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Button,
  Select,
  MenuItem
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
  onLocationSharingToggle,
  locationAutoShareHours,
  onLocationAutoShareChange,
  globalMapVisible,
  onGlobalMapVisibilityToggle,
  onStatsVisibilityToggle,
  onFilterCussWordsToggle,
  dmPermission,
  onDmPermissionChange,
  onManageBlockedUsers,
  canAccessAdminDashboard,
  adminRoute,
  profileRoute,
  isOffline,
  isManagingBlockedUsers
}) {
  const autoShareOptions = [
    { value: 0, label: 'Never auto-disable' },
    { value: 4, label: 'After 4 hours' },
    { value: 12, label: 'After 12 hours' },
    { value: 24, label: 'After 24 hours' },
    { value: 72, label: 'After 3 days' }
  ];

  return (
    <Stack spacing={2}>
      <SettingsAccordion
        title="Privacy & sharing"
        description="Control who can see your location and how you appear in discovery."
      >
        <FormControlLabel
          control={<Switch checked={settings.locationSharingEnabled} onChange={onLocationSharingToggle} />}
          label="Share my live location with friends"
          sx={settingsToggleLabelSx}
        />
        <FormControl size="small" sx={{ maxWidth: 320 }}>
          <FormLabel
            component="legend"
            sx={{ fontSize: '0.875rem', mb: 0.5, color: settingsPalette.accent }}
          >
            Auto-disable location sharing
          </FormLabel>
          <Select
            value={locationAutoShareHours}
            onChange={(event) => onLocationAutoShareChange(event.target.value)}
            disabled={isOffline}
            sx={{
              '& .MuiSelect-select': {
                borderRadius: 2,
                backgroundColor: '#FFFFFF',
                color: settingsPalette.textPrimary
              },
              '& fieldset': {
                borderRadius: 2,
                borderColor: settingsPalette.borderSubtle
              },
              '&:hover fieldset': {
                borderColor: settingsPalette.accent
              },
              '&.Mui-focused fieldset': {
                borderColor: settingsPalette.accent
              }
            }}
          >
            {autoShareOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" sx={mutedTextSx}>
            We’ll turn location sharing off automatically once the timer runs out.
          </Typography>
        </FormControl>
        <FormControlLabel
          control={<Switch checked={globalMapVisible} onChange={onGlobalMapVisibilityToggle} />}
          label="Show me on the global map & discovery"
          sx={settingsToggleLabelSx}
        />
        <Typography variant="caption" sx={mutedTextSx}>
          Turn this off to stay visible only to friends and followers.
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
