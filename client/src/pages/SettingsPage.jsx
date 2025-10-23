import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { auth } from '../firebase';
import { fetchCurrentUserProfile, updateCurrentUserProfile } from '../api/mongoDataApi';

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
  const [authUser, authLoading] = useAuthState(auth);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const baselineSettings = useMemo(() => {
    if (!profile) {
      return DEFAULT_SETTINGS;
    }
    return {
      theme: profile?.preferences?.theme ?? DEFAULT_SETTINGS.theme,
      radiusPreferenceMeters: roundRadius(profile?.preferences?.radiusPreferenceMeters),
      locationSharingEnabled: Boolean(profile?.locationSharingEnabled),
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
    try {
      await signOut(auth);
    } catch (error) {
      setSaveStatus({
        type: 'error',
        message: error?.message || 'Failed to sign out.'
      });
    }
  }, []);

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
              component={Link}
              to="/profile/me"
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
    </Box>
  );
}

export default SettingsPage;
