import { Link } from 'react-router-dom';
import { Stack, Typography, FormControlLabel, Switch, FormControl, FormLabel, RadioGroup, Radio, Button } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';

function PrivacySettings({
  settings,
  onLocationSharingToggle,
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
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Privacy &amp; sharing</Typography>
      <FormControlLabel
        control={<Switch checked={settings.locationSharingEnabled} onChange={onLocationSharingToggle} />}
        label="Share my live location with friends"
      />
      <FormControlLabel
        control={<Switch checked={settings.statsPublic} onChange={onStatsVisibilityToggle} />}
        label="Allow others to view my stats"
      />
      <FormControlLabel
        control={<Switch checked={settings.filterCussWords} onChange={onFilterCussWordsToggle} />}
        label="Filter explicit language in public chats"
      />
      <FormControl component="fieldset" sx={{ mt: 1 }}>
        <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>
          Who can DM me?
        </FormLabel>
        <RadioGroup value={dmPermission} onChange={onDmPermissionChange}>
          <FormControlLabel value="everyone" control={<Radio />} label="Everyone" />
          <FormControlLabel value="friends" control={<Radio />} label="Friends & followers" />
          <FormControlLabel value="nobody" control={<Radio />} label="No one (mute DMs)" />
        </RadioGroup>
        <Typography variant="caption" color="text.secondary">
          Friends-only mode also allows people who follow you. Selecting “No one” hides you from new threads.
        </Typography>
      </FormControl>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button
          onClick={onManageBlockedUsers}
          variant="outlined"
          color="warning"
          startIcon={<BlockIcon />}
          disabled={isOffline || isManagingBlockedUsers}
          title={isOffline ? 'Reconnect to manage blocked users' : undefined}
        >
          Manage blocked users
        </Button>
        {canAccessAdminDashboard ? (
          <Button component={Link} to={adminRoute} variant="outlined" startIcon={<AdminPanelSettingsIcon />}>
            Admin dashboard
          </Button>
        ) : null}
        <Button component={Link} to={profileRoute} variant="outlined" startIcon={<ManageAccountsIcon />}>
          View profile
        </Button>
      </Stack>
    </Stack>
  );
}

export default PrivacySettings;
