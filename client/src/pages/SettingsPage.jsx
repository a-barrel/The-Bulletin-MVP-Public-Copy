import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
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
import { routes } from '../routes';
import {
  fetchBlockedUsers,
  fetchCurrentUserProfile,
  revokeCurrentSession,
  unblockUser,
  updateCurrentUserProfile
} from '../api/mongoDataApi';
import { useBadgeSound } from '../contexts/BadgeSoundContext';

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

const RADIUS_MIN = 100;
const RADIUS_MAX = 80467; // 50 miles

const DEFAULT_SETTINGS = {
  theme: 'system',
  radiusPreferenceMeters: 16093,
  locationSharingEnabled: false,
  filterCussWords: false,
  statsPublic: true,
  notifications: {
    proximity: true,
    updates: true,
    marketing: false
  }
};

const roundRadius = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.radiusPreferenceMeters;
  }
  const clamped = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(value)));
  return clamped;
};

function SettingsPage() {
  const navigate = useNavigate();
  const [authUser, authLoading] = useAuthState(auth);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { enabled: badgeSoundEnabled, setEnabled: setBadgeSoundEnabled } = useBadgeSound();
  const [blockedOverlayOpen, setBlockedOverlayOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [isManagingBlockedUsers, setIsManagingBlockedUsers] = useState(false);
  const [blockedOverlayStatus, setBlockedOverlayStatus] = useState(null);

  const theme = settings.theme;
  const notifications = settings.notifications;

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authUser) {
      setProfile(null);
      setProfileError('Sign in to manage your settings.');
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setIsFetchingProfile(true);
      setProfileError(null);
      try {
        const result = await fetchCurrentUserProfile();
        if (cancelled) {
          return;
        }
        setProfile(result);
        setSettings({
          theme: result?.preferences?.theme ?? DEFAULT_SETTINGS.theme,
          radiusPreferenceMeters: roundRadius(result?.preferences?.radiusPreferenceMeters),
          locationSharingEnabled: Boolean(result?.locationSharingEnabled),
          filterCussWords: result?.preferences?.filterCussWords ?? DEFAULT_SETTINGS.filterCussWords,
          statsPublic: result?.preferences?.statsPublic ?? DEFAULT_SETTINGS.statsPublic,
          notifications: {
            proximity:
              result?.preferences?.notifications?.proximity ?? DEFAULT_SETTINGS.notifications.proximity,
            updates:
              result?.preferences?.notifications?.updates ?? DEFAULT_SETTINGS.notifications.updates,
            marketing:
              result?.preferences?.notifications?.marketing ?? DEFAULT_SETTINGS.notifications.marketing
          }
        });
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
          setProfileError(error?.message || 'Failed to load account settings.');
        }
      } finally {
        if (!cancelled) {
          setIsFetchingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authUser]);

  useEffect(() => {
    if (!blockedOverlayOpen) {
      return;
    }

    let cancelled = false;

    const loadBlocked = async () => {
      setIsLoadingBlockedUsers(true);
      setBlockedOverlayStatus(null);
      try {
        const response = await fetchBlockedUsers();
        if (cancelled) {
          return;
        }
        setBlockedUsers(Array.isArray(response?.blockedUsers) ? response.blockedUsers : []);
        if (response?.relationships) {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  relationships: response.relationships
                }
              : prev
          );
        }
      } catch (error) {
        if (!cancelled) {
          setBlockedUsers([]);
          setBlockedOverlayStatus({
            type: 'error',
            message: error?.message || 'Failed to load blocked users.'
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBlockedUsers(false);
        }
      }
    };

    loadBlocked();

    return () => {
      cancelled = true;
    };
  }, [blockedOverlayOpen, setProfile]);

  useEffect(() => {
    if (!blockedOverlayStatus || blockedOverlayStatus.type !== 'success') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBlockedOverlayStatus(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [blockedOverlayStatus]);

  const baselineSettings = useMemo(() => {
    if (!profile) {
      return DEFAULT_SETTINGS;
    }
    return {
      theme: profile?.preferences?.theme ?? DEFAULT_SETTINGS.theme,
      radiusPreferenceMeters: roundRadius(profile?.preferences?.radiusPreferenceMeters),
      locationSharingEnabled: Boolean(profile?.locationSharingEnabled),
      filterCussWords: profile?.preferences?.filterCussWords ?? DEFAULT_SETTINGS.filterCussWords,
      statsPublic: profile?.preferences?.statsPublic ?? DEFAULT_SETTINGS.statsPublic,
      notifications: {
        proximity:
          profile?.preferences?.notifications?.proximity ?? DEFAULT_SETTINGS.notifications.proximity,
        updates: profile?.preferences?.notifications?.updates ?? DEFAULT_SETTINGS.notifications.updates,
        marketing:
          profile?.preferences?.notifications?.marketing ?? DEFAULT_SETTINGS.notifications.marketing
      }
    };
  }, [profile]);

  const hasChanges = useMemo(() => {
    return (
      settings.theme !== baselineSettings.theme ||
      settings.locationSharingEnabled !== baselineSettings.locationSharingEnabled ||
      settings.radiusPreferenceMeters !== baselineSettings.radiusPreferenceMeters ||
      settings.filterCussWords !== baselineSettings.filterCussWords ||
      settings.statsPublic !== baselineSettings.statsPublic ||
      settings.notifications.proximity !== baselineSettings.notifications.proximity ||
      settings.notifications.updates !== baselineSettings.notifications.updates ||
      settings.notifications.marketing !== baselineSettings.notifications.marketing
    );
  }, [baselineSettings, settings]);

  const handleThemeChange = useCallback((event) => {
    const value = event.target.value;
    setSettings((prev) => ({
      ...prev,
      theme: value
    }));
  }, []);

  const handleRadiusChange = useCallback((event, value) => {
    setSettings((prev) => ({
      ...prev,
      radiusPreferenceMeters: roundRadius(Array.isArray(value) ? value[0] : value)
    }));
  }, []);

  const handleNotificationToggle = useCallback((key) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }));
  }, []);

  const handleLocationSharingToggle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      locationSharingEnabled: !prev.locationSharingEnabled
    }));
  }, []);

  const handleStatsVisibilityToggle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      statsPublic: !prev.statsPublic
    }));
  }, []);

  const handleFilterCussWordsToggle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      filterCussWords: !prev.filterCussWords
    }));
  }, []);

  const handleOpenBlockedOverlay = useCallback(() => {
    setBlockedOverlayStatus(null);
    setBlockedOverlayOpen(true);
  }, []);

  const handleCloseBlockedOverlay = useCallback(() => {
    if (isManagingBlockedUsers) {
      return;
    }
    setBlockedOverlayOpen(false);
  }, [isManagingBlockedUsers]);

  const handleUnblockUser = useCallback(
    async (userId) => {
      if (!userId) {
        return;
      }

      const targetUser = blockedUsers.find((user) => user._id === userId);
      setIsManagingBlockedUsers(true);
      setBlockedOverlayStatus(null);
      try {
        const response = await unblockUser(userId);
        setBlockedUsers(Array.isArray(response?.blockedUsers) ? response.blockedUsers : []);
        if (response?.updatedRelationships) {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  relationships: response.updatedRelationships
                }
              : prev
          );
        }
        setBlockedOverlayStatus({
          type: 'success',
          message: targetUser
            ? `Unblocked ${targetUser.displayName || targetUser.username || targetUser._id}.`
            : 'User unblocked.'
        });
      } catch (error) {
        setBlockedOverlayStatus({
          type: 'error',
          message: error?.message || 'Failed to unblock user.'
        });
      } finally {
        setIsManagingBlockedUsers(false);
      }
    },
    [blockedUsers, setProfile]
  );

  const handleReset = useCallback(() => {
    setSettings(baselineSettings);
    setSaveStatus(null);
  }, [baselineSettings]);

  const handleSave = useCallback(async () => {
    if (!authUser || !hasChanges) {
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const payload = {
        preferences: {
          theme: settings.theme,
          radiusPreferenceMeters: settings.radiusPreferenceMeters,
          filterCussWords: settings.filterCussWords,
          statsPublic: settings.statsPublic,
          notifications: {
            proximity: settings.notifications.proximity,
            updates: settings.notifications.updates,
            marketing: settings.notifications.marketing
          }
        },
        locationSharingEnabled: settings.locationSharingEnabled
      };

      const updated = await updateCurrentUserProfile(payload);
      setProfile(updated);
      setSaveStatus({ type: 'success', message: 'Settings saved.' });
    } catch (error) {
      setSaveStatus({
        type: 'error',
        message: error?.message || 'Failed to update settings.'
      });
    } finally {
      setIsSaving(false);
    }
  }, [authUser, hasChanges, settings]);

  const handleSignOut = useCallback(async () => {
    let revokeError = null;
    try {
      await revokeCurrentSession();
    } catch (error) {
      console.error('Failed to revoke server session during sign out.', error);
      revokeError = error;
    }

    try {
      await signOut(auth);
      if (revokeError) {
        setSaveStatus({
          type: 'error',
          message:
            revokeError?.message ||
            'Signed out locally, but failed to invalidate the server session. Please retry if concerned.'
        });
      }
    } catch (error) {
      setSaveStatus({
        type: 'error',
        message: error?.message || 'Failed to sign out.'
      });
    }
  }, [revokeCurrentSession]);

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
          <Stack
            spacing={2}
            alignItems="center"
            justifyContent="center"
            sx={{ py: 6 }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading your settings...
            </Typography>
          </Stack>
        ) : (
        <Paper
          elevation={3}
          sx={{
            borderRadius: 3,
            p: { xs: 2.5, md: 4 },
            display: 'flex',
            flexDirection: 'column',
            gap: 3
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h6">Appearance</Typography>
            <Typography variant="body2" color="text.secondary">
              Choose how Pinpoint should look on this device.
            </Typography>
          </Stack>
          <FormControl>
            <FormLabel>Theme preference</FormLabel>
            <RadioGroup
              row
              value={theme}
              onChange={handleThemeChange}
              sx={{ mt: 1 }}
            >
              <FormControlLabel value="system" control={<Radio />} label="System default" />
              <FormControlLabel value="light" control={<Radio />} label="Light" />
              <FormControlLabel value="dark" control={<Radio />} label="Dark" />
            </RadioGroup>
          </FormControl>

          <Divider />

          <Stack spacing={0.5}>
            <Typography variant="h6">Location & proximity</Typography>
            <Typography variant="body2" color="text.secondary">
              Fine-tune how we share your location and surface nearby activity.
            </Typography>
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={settings.locationSharingEnabled}
                onChange={handleLocationSharingToggle}
                color="primary"
              />
            }
            label="Share my location with nearby features"
          />
          <Box sx={{ px: { xs: 0.5, md: 2 }, py: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Default radius for discovery ({Math.round(settings.radiusPreferenceMeters / 1609.34)} mi)
            </Typography>
            <Slider
              value={settings.radiusPreferenceMeters}
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={100}
              valueLabelDisplay="on"
              valueLabelFormat={(value) => `${Math.round(value / 1609.34)} mi`}
              onChange={handleRadiusChange}
            />
          </Box>

          <Divider />

          <Stack spacing={0.5}>
            <Typography variant="h6">Profile visibility</Typography>
            <Typography variant="body2" color="text.secondary">
              Choose whether others can see your activity stats on your profile.
            </Typography>
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={settings.statsPublic}
                onChange={handleStatsVisibilityToggle}
              />
            }
            label={
              settings.statsPublic
                ? 'Show my stats on my profile'
                : 'Hide my stats from other users'
            }
          />

          <Divider />

          <Stack spacing={0.5}>
            <Typography variant="h6">Audio</Typography>
            <Typography variant="body2" color="text.secondary">
              Decide whether new badges should play a celebration sound.
            </Typography>
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={badgeSoundEnabled}
                onChange={(event) => setBadgeSoundEnabled(event.target.checked)}
              />
            }
            label="Play sound when I earn a badge"
          />
          <Typography variant="body2" color="text.secondary">
            {badgeSoundEnabled
              ? 'The badge chime is enabled and will play the next time you unlock something.'
              : 'Badge chime remains muted. Turn it on here whenever you want to hear it.'}
          </Typography>

          <Divider />

          <Stack spacing={0.5}>
            <Typography variant="h6">Moderation</Typography>
            <Typography variant="body2" color="text.secondary">
              Replace strong language in chats with friendlier wording.
            </Typography>
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={settings.filterCussWords}
                onChange={handleFilterCussWordsToggle}
              />
            }
            label="Swap offensive language for fruit names"
          />
          <Typography variant="body2" color="text.secondary">
            {settings.filterCussWords
              ? 'Chats will show cheerful fruit names whenever someone drops a curse word.'
              : 'Leave chat messages untouched, even if they include colorful language.'}
          </Typography>

          <Divider />

          <Stack spacing={0.5}>
            <Typography variant="h6">Notifications</Typography>
            <Typography variant="body2" color="text.secondary">
              Control when Pinpoint should nudge you.
            </Typography>
          </Stack>
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={notifications.proximity}
                  onChange={() => handleNotificationToggle('proximity')}
                />
              }
              label="Notify me about nearby activity"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={notifications.updates}
                  onChange={() => handleNotificationToggle('updates')}
                />
              }
              label="Send alerts for pin and chat updates"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={notifications.marketing}
                  onChange={() => handleNotificationToggle('marketing')}
                />
              }
              label="Include marketing and tips"
            />
          </Stack>

          <Divider />

          <Stack spacing={0.5}>
            <Typography variant="h6">Account</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your profile and session.
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              onClick={handleOpenBlockedOverlay}
              variant="outlined"
              color="warning"
              startIcon={<BlockIcon />}
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
        </Paper>
        )}

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
            disabled={!profile || !hasChanges || isSaving || isFetchingProfile}
            onClick={handleSave}
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
                        disabled={isManagingBlockedUsers}
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
              You haven't blocked any users yet. Block someone from their profile to see them here.
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
