/* NOTE: Page exports configuration alongside the component. */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Box,
  Stack,
  Typography,
  Paper,
  Divider,
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Switch,
  Slider,
  Chip
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import BlockIcon from '@mui/icons-material/Block';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { auth } from '../firebase';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import { routes } from '../routes';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import useSettingsManager, {
  DEFAULT_SETTINGS,
  RADIUS_MAX,
  RADIUS_MIN
} from '../hooks/useSettingsManager';
import { metersToMiles } from '../utils/geo';

export const pageConfig = {
  id: 'settings',
  label: 'Settings',
  icon: SettingsIcon,
  path: '/settings',
  aliases: ['/settings-todo'],
  order: 92,
  showInNav: true,
  protected: true
};

function SettingsPage() {
  const navigate = useNavigate();
  const [authUser, authLoading] = useAuthState(auth);
  const { enabled: badgeSoundEnabled, setEnabled: setBadgeSoundEnabled } = useBadgeSound();
  const { isOffline } = useNetworkStatusContext();

  const {
    profile,
    profileError,
    isFetchingProfile,
    settings,
    saveStatus,
    setSaveStatus,
    isSaving,
    hasChanges,
    blockedOverlayOpen,
    blockedUsers,
    isLoadingBlockedUsers,
    isManagingBlockedUsers,
    blockedOverlayStatus,
    setBlockedOverlayStatus,
    handleThemeChange,
    handleRadiusChange,
    handleNotificationToggle,
    handleLocationSharingToggle,
    handleStatsVisibilityToggle,
    handleFilterCussWordsToggle,
    handleOpenBlockedOverlay,
    handleCloseBlockedOverlay,
    handleUnblockUser,
    handleReset,
    handleSave,
    handleSignOut
  } = useSettingsManager({ authUser, authLoading, isOffline });

  const theme = settings.theme;
  const notifications = settings.notifications;
  const radiusMeters = settings.radiusPreferenceMeters ?? DEFAULT_SETTINGS.radiusPreferenceMeters;
  const rawRadiusMiles = metersToMiles(radiusMeters);
  const radiusMiles = rawRadiusMiles === null ? null : Math.round(rawRadiusMiles * 10) / 10;

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 960,
        mx: 'auto',
        py: { xs: 3, md: 5 },
        px: { xs: 2, md: 4 }
      }}
    >
      <Stack spacing={3}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => navigate(-1)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Back
        </Button>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <SettingsIcon color="primary" />
          <Typography variant="h4" component="h1">
            Settings
          </Typography>
          {authUser ? (
            <Chip
              icon={<ManageAccountsIcon />}
              label={authUser.email ?? 'Authenticated'}
              size="small"
            />
          ) : null}
        </Stack>

        {saveStatus ? (
          <Alert severity={saveStatus.type} onClose={() => setSaveStatus(null)}>
            {saveStatus.message}
          </Alert>
        ) : null}

        {profileError ? (
          <Alert severity="warning" variant="outlined">
            {profileError}
          </Alert>
        ) : null}

        {isFetchingProfile && !profile ? (
          <Paper elevation={3} sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading your account settings...
              </Typography>
            </Stack>
          </Paper>
        ) : null}

        <Paper elevation={4} sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h6">Appearance</Typography>
              <Typography variant="body2" color="text.secondary">
                Choose how Pinpoint adapts to your device.
              </Typography>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>
                  Theme
                </FormLabel>
                <RadioGroup row value={theme} onChange={handleThemeChange}>
                  <FormControlLabel value="system" control={<Radio />} label="Match system" />
                  <FormControlLabel value="light" control={<Radio />} label="Light" />
                  <FormControlLabel value="dark" control={<Radio />} label="Dark" />
                </RadioGroup>
              </FormControl>
            </Stack>

            <Divider />

            <Stack spacing={2}>
              <Typography variant="h6">Location radius</Typography>
              <Typography variant="body2" color="text.secondary">
                Adjust how far from your location the app should pull nearby pins and updates.
              </Typography>
              <Slider
                value={radiusMeters}
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                step={500}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => {
                  const miles = metersToMiles(value);
                  return miles === null ? 'N/A' : `${Math.round(miles * 10) / 10} mi`;
                }}
                onChange={handleRadiusChange}
              />
              <Typography variant="caption" color="text.secondary">
                Current radius: {radiusMeters} m ({radiusMiles ?? 'N/A'} mi)
              </Typography>
            </Stack>

            <Divider />

            <Stack spacing={2}>
              <Typography variant="h6">Privacy &amp; personalization</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.locationSharingEnabled}
                    onChange={handleLocationSharingToggle}
                  />
                }
                label="Share my live location with friends"
              />
              <FormControlLabel
                control={<Switch checked={settings.statsPublic} onChange={handleStatsVisibilityToggle} />}
                label="Allow others to view my stats"
              />
              <FormControlLabel
                control={
                  <Switch checked={settings.filterCussWords} onChange={handleFilterCussWordsToggle} />
                }
                label="Filter explicit language in public chats"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={badgeSoundEnabled}
                    onChange={(_, value) => setBadgeSoundEnabled(value)}
                  />
                }
                label="Play celebration sounds when I earn badges"
              />
            </Stack>

            <Divider />

            <Stack spacing={2}>
              <Typography variant="h6">Notifications</Typography>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>
                  Toggle the notification types you care about.
                </FormLabel>
                <Stack spacing={1.5}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.proximity}
                        onChange={() => handleNotificationToggle('proximity')}
                      />
                    }
                    label="Nearby pin alerts"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.updates}
                        onChange={() => handleNotificationToggle('updates')}
                      />
                    }
                    label="App updates & announcements"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.marketing}
                        onChange={() => handleNotificationToggle('marketing')}
                      />
                    }
                    label="Promotions & experiments"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.chatTransitions}
                        onChange={() => handleNotificationToggle('chatTransitions')}
                      />
                    }
                    label="Chatroom join/leave notifications"
                  />
                </Stack>
              </FormControl>
            </Stack>

            <Divider />

            <Stack spacing={2}>
              <Typography variant="h6">Manage account</Typography>
              <Typography variant="body2" color="text.secondary">
                Review who you&apos;ve blocked or sign out of the app.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  onClick={handleOpenBlockedOverlay}
                  variant="outlined"
                  color="warning"
                  startIcon={<BlockIcon />}
                  disabled={isOffline || isManagingBlockedUsers}
                  title={isOffline ? 'Reconnect to manage blocked users' : undefined}
                >
                  Manage blocked users
                </Button>
                <Button
                  component={Link}
                  to={routes.profile.me}
                  variant="outlined"
                  startIcon={<ManageAccountsIcon />}
                >
                  View profile
                </Button>
                <Button
                  onClick={handleSignOut}
                  variant="outlined"
                  color="error"
                  startIcon={<LogoutIcon />}
                >
                  Sign out
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Paper>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            disabled={!profile || !hasChanges || isSaving || isFetchingProfile}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isOffline || !profile || !hasChanges || isSaving || isFetchingProfile}
            onClick={handleSave}
            title={isOffline ? 'Reconnect to save changes' : undefined}
          >
            {isSaving ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </Stack>
      </Stack>

      <Dialog
        open={blockedOverlayOpen}
        onClose={handleCloseBlockedOverlay}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Blocked users</DialogTitle>
        <DialogContent dividers>
          {blockedOverlayStatus ? (
            <Alert
              severity={blockedOverlayStatus.type}
              sx={{ mb: 2 }}
              onClose={() => setBlockedOverlayStatus(null)}
            >
              {blockedOverlayStatus.message}
            </Alert>
          ) : null}
          {isLoadingBlockedUsers ? (
            <Stack alignItems="center" spacing={2} sx={{ py: 3 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Loading blocked users...
              </Typography>
            </Stack>
          ) : blockedUsers.length ? (
            <List disablePadding sx={{ mt: -1 }}>
              {blockedUsers.map((user) => {
                const primary = user.displayName || user.username || user._id;
                const secondary =
                  user.username && user.username !== primary
                    ? `@${user.username}`
                    : user.email || user._id;
                const avatarSource =
                  user?.avatar?.url || user?.avatar?.thumbnailUrl || user?.avatar?.path || null;
                return (
                  <ListItem
                    key={user._id}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<HowToRegIcon />}
                        onClick={() => handleUnblockUser(user._id)}
                        disabled={isOffline || isManagingBlockedUsers}
                        title={isOffline ? 'Reconnect to unblock users' : undefined}
                      >
                        Unblock
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar src={avatarSource || undefined}>
                        {primary?.charAt(0)?.toUpperCase() ?? 'U'}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={primary} secondary={secondary} />
                  </ListItem>
                );
              })}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              You haven&apos;t blocked any users yet. Block someone from their profile to see them here.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBlockedOverlay} disabled={isManagingBlockedUsers}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SettingsPage;
