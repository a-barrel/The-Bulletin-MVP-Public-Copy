/* NOTE: Page exports configuration alongside the component. */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Box,
  Stack,
  Typography,
  Paper,
  Divider,
  Alert,
  Snackbar,
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
  TextField,
  Chip,
  Tabs,
  Tab,
  Select,
  MenuItem
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FeedbackIcon from '@mui/icons-material/FeedbackOutlined';
import DoNotDisturbOnIcon from '@mui/icons-material/DoNotDisturbOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestoreIcon from '@mui/icons-material/Restore';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import BlockIcon from '@mui/icons-material/Block';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { auth } from '../firebase';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import { routes } from '../routes';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { useFriendBadgePreference } from '../contexts/FriendBadgePreferenceContext';
import useSettingsManager, {
  DEFAULT_SETTINGS,
  RADIUS_MAX,
  RADIUS_MIN
} from '../hooks/useSettingsManager';
import { metersToMiles } from '../utils/geo';
import runtimeConfig from '../config/runtime';
import {
  submitAnonymousFeedback,
  requestDataExport,
  fetchApiTokens,
  createApiToken,
  revokeApiToken
} from '../api/mongoDataApi';
import reportClientError from '../utils/reportClientError';
import { formatFriendlyTimestamp } from '../utils/dates';

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

const TabPanel = ({ value, current, children }) => {
  if (value !== current) {
    return null;
  }
  return (
    <Stack spacing={3} sx={{ pt: 3 }}>
      {children}
    </Stack>
  );
};

function SettingsPage() {
  const navigate = useNavigate();
  const [authUser, authLoading] = useAuthState(auth);
  const { enabled: badgeSoundEnabled, setEnabled: setBadgeSoundEnabled } = useBadgeSound();
  const { enabled: friendBadgesEnabled, setEnabled: setFriendBadgesEnabled } =
    useFriendBadgePreference();
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
    handleQuickMuteNotifications,
    handleClearNotificationMute,
    handleTextScaleChange,
    handleDisplayToggle,
    handleMapDensityChange,
    handleLocationSharingToggle,
    handleStatsVisibilityToggle,
    handleFilterCussWordsToggle,
    handleDmPermissionChange,
    handleDigestFrequencyChange,
    handleAutoExportRemindersToggle,
    handleOpenBlockedOverlay,
    handleCloseBlockedOverlay,
    handleUnblockUser,
    handleReset,
    handleSave,
    handleSignOut
  } = useSettingsManager({ authUser, authLoading, isOffline });

  const theme = settings.theme;
  const notifications = {
    ...DEFAULT_SETTINGS.notifications,
    ...(settings.notifications || {})
  };
  const radiusMeters = settings.radiusPreferenceMeters ?? DEFAULT_SETTINGS.radiusPreferenceMeters;
  const rawRadiusMiles = metersToMiles(radiusMeters);
  const radiusMiles = rawRadiusMiles === null ? null : Math.round(rawRadiusMiles * 10) / 10;
  const displaySettings = {
    ...DEFAULT_SETTINGS.display,
    ...(settings.display || {})
  };
  const textScale = displaySettings.textScale;
  const reduceMotion = displaySettings.reduceMotion;
  const highContrast = displaySettings.highContrast;
  const mapDensity = displaySettings.mapDensity;
  const celebrationSounds =
    displaySettings.celebrationSounds ?? DEFAULT_SETTINGS.display.celebrationSounds;
  const showFriendBadges =
    displaySettings.showFriendBadges ?? DEFAULT_SETTINGS.display.showFriendBadges;
  const dmPermission = settings.dmPermission ?? DEFAULT_SETTINGS.dmPermission;
  const digestFrequency = settings.digestFrequency ?? DEFAULT_SETTINGS.digestFrequency;
  const autoExportReminders =
    settings.autoExportReminders ?? DEFAULT_SETTINGS.autoExportReminders;

  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackError, setFeedbackError] = useState(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('appearance');
  const [dataStatus, setDataStatus] = useState(null);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [apiTokens, setApiTokens] = useState([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [tokenLabel, setTokenLabel] = useState('');

  const notificationToggleConfig = [
    { key: 'proximity', label: 'Nearby pin alerts', helper: 'Alerts when new pins appear within your radius.' },
    { key: 'pinCreated', label: 'New pin posts', helper: 'Notify me when people I follow publish new pins.' },
    { key: 'pinUpdates', label: 'Pin edits & replies', helper: 'Changes to pins you saved, including edits, replies, and attendance updates.' },
    { key: 'eventReminders', label: 'Event reminders', helper: 'Heads-up before events you are attending begin.' },
    { key: 'discussionReminders', label: 'Discussion closing reminders', helper: 'Warn me when discussions or polls I joined are about to end.' },
    { key: 'bookmarkReminders', label: 'Bookmark reminders', helper: 'Activity triggered by pins you bookmarked.' },
    { key: 'chatMessages', label: 'Chat message highlights', helper: 'Notify me about high-signal chat messages in rooms I am part of.' },
    { key: 'friendRequests', label: 'Friend request updates', helper: 'Approvals, declines, and invites.' },
    { key: 'badgeUnlocks', label: 'Badge achievements', helper: 'Celebrate new milestones.' },
    { key: 'dmMentions', label: 'Direct message mentions', helper: 'Notifications for direct mentions or replies.' },
    { key: 'moderationAlerts', label: 'Moderation/reports', helper: 'Warnings, appeals, and report outcomes.' },
    { key: 'chatTransitions', label: 'Chatroom join/leave events', helper: 'Heads-up when friends enter or leave rooms.' },
    { key: 'updates', label: 'Product updates', helper: 'Release notes, outages, and roadmap news.' },
    { key: 'marketing', label: 'Experiments & promotions', helper: 'Beta features, surveys, and offers.' },
    { key: 'emailDigests', label: 'Email digests', helper: 'Allow digests outside the app.' }
  ];

  const notificationsMutedUntil = settings.notificationsMutedUntil;
  const muteUntilDate = notificationsMutedUntil ? new Date(notificationsMutedUntil) : null;
  const isMuteActive = Boolean(muteUntilDate && muteUntilDate.getTime() > Date.now());
  const muteStatusLabel = isMuteActive
    ? `Muted until ${formatFriendlyTimestamp(notificationsMutedUntil)}`
    : 'Notifications active';

  const loadApiTokens = useCallback(async () => {
    setIsLoadingTokens(true);
    try {
      const response = await fetchApiTokens();
      setApiTokens(Array.isArray(response?.tokens) ? response.tokens : []);
    } catch (error) {
      reportClientError(error, 'Failed to load API tokens', {
        source: 'SettingsPage.loadApiTokens'
      });
      setTokenStatus({
        type: 'error',
        message: error?.message || 'Failed to load API tokens.'
      });
    } finally {
      setIsLoadingTokens(false);
    }
  }, []);

  const handleDataExport = async () => {
    if (isOffline) {
      setDataStatus({ type: 'warning', message: 'Reconnect to request a data export.' });
      return;
    }
    setDataStatus({ type: 'info', message: 'Submitting export request...' });
    try {
      const response = await requestDataExport();
      const duplicate = Boolean(response?.duplicate);
      setDataStatus({
        type: 'success',
        message: duplicate
          ? 'You already have an export queued. We’ll email you when it\'s ready.'
          : 'Export queued. We’ll email you a download link shortly.'
      });
    } catch (error) {
      reportClientError(error, 'Failed to request data export', {
        source: 'SettingsPage.requestDataExport'
      });
      setDataStatus({
        type: 'error',
        message: error?.message || 'Failed to request data export.'
      });
    }
  };

  const handleGenerateToken = async () => {
    if (isOffline) {
      setTokenStatus({ type: 'warning', message: 'Reconnect to generate API tokens.' });
      return;
    }
    setTokenStatus({ type: 'info', message: 'Generating token...' });
    try {
      const response = await createApiToken({
        label: tokenLabel.trim() || undefined
      });
      setTokenLabel('');
      if (response?.token) {
        setApiTokens((prev) => [response.token, ...prev]);
      }
      const secret = response?.secret;
      setGeneratedToken(secret || null);

      if (secret && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(secret);
        setTokenStatus({
          type: 'success',
          message: 'Token created and copied to your clipboard. Store it securely.'
        });
      } else {
        setTokenStatus({
          type: 'info',
          message: secret ? `Token generated: ${secret}` : 'Token created.'
        });
      }
    } catch (error) {
      reportClientError(error, 'Failed to generate API token', {
        source: 'SettingsPage.createApiToken'
      });
      setTokenStatus({
        type: 'error',
        message: error?.message || 'Failed to generate API token.'
      });
    }
  };

  const handleRevokeToken = async (tokenId) => {
    if (!tokenId) {
      return;
    }
    if (isOffline) {
      setTokenStatus({ type: 'warning', message: 'Reconnect to revoke API tokens.' });
      return;
    }
    try {
      await revokeApiToken(tokenId);
      setApiTokens((prev) => prev.filter((token) => token.id !== tokenId));
      setTokenStatus({
        type: 'success',
        message: 'Token revoked.'
      });
    } catch (error) {
      reportClientError(error, 'Failed to revoke API token', {
        source: 'SettingsPage.revokeApiToken',
        tokenId
      });
      setTokenStatus({
        type: 'error',
        message: error?.message || 'Failed to revoke API token.'
      });
    }
  };

  const moderationRoleAllowlist = (runtimeConfig.moderation?.allowedRoles ?? [
    'admin',
    'moderator',
    'super-admin',
    'system-admin'
  ]).map((role) => role.toLowerCase());
  const moderationRoleChecksEnabled = runtimeConfig.moderation?.roleChecksEnabled !== false;
  const bypassModerationRoleChecks = runtimeConfig.isOffline || !moderationRoleChecksEnabled;
  const canAccessAdminDashboard =
    bypassModerationRoleChecks ||
    (Array.isArray(profile?.roles) &&
      profile.roles.some(
        (role) =>
          typeof role === 'string' && moderationRoleAllowlist.includes(role.trim().toLowerCase())
      ));

  const handleOpenFeedbackDialog = () => {
    setFeedbackDialogOpen(true);
    setFeedbackMessage('');
    setFeedbackContact('');
    setFeedbackError(null);
  };

  const handleCloseFeedbackDialog = () => {
    if (isSubmittingFeedback) {
      return;
    }
    setFeedbackDialogOpen(false);
    setFeedbackMessage('');
    setFeedbackContact('');
    setFeedbackError(null);
  };

  const handleSubmitFeedback = async () => {
    const trimmedMessage = feedbackMessage.trim();
    if (trimmedMessage.length < 10) {
      setFeedbackError('Please share at least 10 characters.');
      return;
    }
    if (isSubmittingFeedback) {
      return;
    }
    setIsSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await submitAnonymousFeedback({
        message: trimmedMessage,
        contact: feedbackContact.trim() || undefined,
        category: 'settings-feedback'
      });
      setFeedbackStatus({
        type: 'success',
        message: 'Thanks for the feedback! We received it safely.'
      });
      setFeedbackDialogOpen(false);
      setFeedbackMessage('');
      setFeedbackContact('');
    } catch (error) {
      setFeedbackError(error?.message || 'Failed to send feedback. Please try again later.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleFeedbackStatusClose = () => {
    setFeedbackStatus(null);
  };

  useEffect(() => {
    if (celebrationSounds === badgeSoundEnabled) {
      return;
    }
    setBadgeSoundEnabled(celebrationSounds);
  }, [badgeSoundEnabled, celebrationSounds, setBadgeSoundEnabled]);

  useEffect(() => {
    if (showFriendBadges === friendBadgesEnabled) {
      return;
    }
    setFriendBadgesEnabled(showFriendBadges);
  }, [friendBadgesEnabled, setFriendBadgesEnabled, showFriendBadges]);

  useEffect(() => {
    loadApiTokens().catch(() => {});
  }, [loadApiTokens]);

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
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => navigate(-1)}
          sx={{
            alignSelf: 'flex-start',
            color: '#1f1336',
            backgroundColor: '#ECF8FE',
            borderRadius: 999,
            border: '1px solid #9B5DE5',
            px: 2,
            '&:hover': {
              backgroundColor: '#d1edff'
            }
          }}
        >
          Back
        </Button>

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ color: '#1f1336' }}
        >
          <SettingsIcon color="primary" />
          <Typography variant="h4" component="h1" sx={{ color: 'inherit' }}>
            Settings
          </Typography>
          {authUser ? (
            <Chip
              variant="outlined"
              icon={<ManageAccountsIcon />}
              label={authUser.email ?? 'Authenticated'}
              size="small"
              sx={{
                backgroundColor: '#ecf8fe',
                borderColor: '#9B5DE5',
                color: '#1f1336',
                fontWeight: 600,
                '.MuiChip-icon': { color: '#5D3889' }
              }}
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
            <Tabs
              value={activeTab}
              onChange={(event, value) => setActiveTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab label="Appearance" value="appearance" />
              <Tab label="Notifications" value="notifications" />
              <Tab label="Privacy" value="privacy" />
              <Tab label="Data & Integrations" value="data" />
            </Tabs>

            <Divider />

            <TabPanel value="appearance" current={activeTab}>
              <Stack spacing={1.5}>
                <Typography variant="h6">Theme & typography</Typography>
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
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Adjust text size to improve readability.
                  </Typography>
                  <Slider
                    min={0.8}
                    max={1.4}
                    step={0.05}
                    value={textScale}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                    onChange={handleTextScaleChange}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={reduceMotion}
                        onChange={() => handleDisplayToggle('reduceMotion')}
                      />
                    }
                    label="Reduce motion & animations"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={highContrast}
                        onChange={() => handleDisplayToggle('highContrast')}
                      />
                    }
                    label="High contrast mode"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={celebrationSounds}
                        onChange={(_, value) => {
                          handleDisplayToggle('celebrationSounds', value);
                          setBadgeSoundEnabled(value);
                        }}
                      />
                    }
                    label="Play celebration sounds"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showFriendBadges}
                        onChange={(_, value) => {
                          handleDisplayToggle('showFriendBadges', value);
                          setFriendBadgesEnabled(value);
                        }}
                      />
                    }
                    label="Show friend badges next to names"
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Celebration sounds follow this setting everywhere in the app.
                </Typography>
                <FormControl component="fieldset" sx={{ mt: 1 }}>
                  <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>
                    Map density
                  </FormLabel>
                  <RadioGroup row value={mapDensity} onChange={handleMapDensityChange}>
                    <FormControlLabel value="compact" control={<Radio />} label="Compact" />
                    <FormControlLabel value="balanced" control={<Radio />} label="Balanced" />
                    <FormControlLabel value="detailed" control={<Radio />} label="Detailed" />
                  </RadioGroup>
                </FormControl>
              </Stack>
              <Divider flexItem />
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
            </TabPanel>

            <TabPanel value="notifications" current={activeTab}>
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
                    <Typography variant="subtitle2" fontWeight={600}>Quick actions</Typography>
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
                      onClick={() => handleQuickMuteNotifications(2)}
                      disabled={isOffline || isFetchingProfile}
                    >
                      Mute 2h
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<DoNotDisturbOnIcon />}
                      onClick={() => handleQuickMuteNotifications(8)}
                      disabled={isOffline || isFetchingProfile}
                    >
                      Mute 8h
                    </Button>
                    <Button
                      variant="text"
                      color="inherit"
                      startIcon={<RestoreIcon />}
                      onClick={handleClearNotificationMute}
                      disabled={!notificationsMutedUntil}
                    >
                      Clear mute
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Muting pauses delivery without changing the toggles below. Save after applying changes.
                  </Typography>
                </Stack>
              </Paper>
              <Stack spacing={1.5}>
                {notificationToggleConfig.map((item) => (
                  <FormControlLabel
                    key={item.key}
                    control={
                      <Switch
                        checked={notifications[item.key]}
                        onChange={() => handleNotificationToggle(item.key)}
                      />
                    }
                    label={
                      <Stack spacing={0.5}>
                        <Typography variant="body2">{item.label}</Typography>
                        {item.helper ? (
                          <Typography variant="caption" color="text.secondary">
                            {item.helper}
                          </Typography>
                        ) : null}
                      </Stack>
                    }
                  />
                ))}
              </Stack>
              <Stack spacing={1}>
                <FormControl size="small" sx={{ maxWidth: 320 }}>
                  <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 0.5 }}>
                    Digest frequency
                  </FormLabel>
                  <Select value={digestFrequency} onChange={handleDigestFrequencyChange}>
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
            </TabPanel>

            <TabPanel value="privacy" current={activeTab}>
              <Stack spacing={2}>
                <Typography variant="h6">Privacy &amp; sharing</Typography>
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
                <FormControl component="fieldset" sx={{ mt: 1 }}>
                  <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>
                    Who can DM me?
                  </FormLabel>
                  <RadioGroup value={dmPermission} onChange={handleDmPermissionChange}>
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
                    onClick={handleOpenBlockedOverlay}
                    variant="outlined"
                    color="warning"
                    startIcon={<BlockIcon />}
                    disabled={isOffline || isManagingBlockedUsers}
                    title={isOffline ? 'Reconnect to manage blocked users' : undefined}
                  >
                    Manage blocked users
                  </Button>
                  {canAccessAdminDashboard ? (
                    <Button
                      component={Link}
                      to={routes.admin.base}
                      variant="outlined"
                      startIcon={<AdminPanelSettingsIcon />}
                    >
                      Admin dashboard
                    </Button>
                  ) : null}
                  <Button
                    component={Link}
                    to={routes.profile.me}
                    variant="outlined"
                    startIcon={<ManageAccountsIcon />}
                  >
                    View profile
                  </Button>
                </Stack>
              </Stack>
            </TabPanel>

            <TabPanel value="data" current={activeTab}>
              <Stack spacing={2}>
                <Typography variant="h6">Data &amp; integrations</Typography>
                <Typography variant="body2" color="text.secondary">
                  Export your account data or generate personal access tokens for scripts. We’ll email you a link
                  whenever an export finishes.
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoExportReminders}
                      onChange={handleAutoExportRemindersToggle}
                    />
                  }
                  label="Remind me to export my data each month"
                />
                <Typography variant="caption" color="text.secondary">
                  We’ll send a gentle nudge inside the app when it’s time for your next export.
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Data export</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button
                      variant="contained"
                      onClick={handleDataExport}
                      disabled={isOffline}
                      title={isOffline ? 'Reconnect to request an export' : undefined}
                    >
                      Request data export
                    </Button>
                  </Stack>
                  {dataStatus ? (
                    <Alert severity={dataStatus.type} onClose={() => setDataStatus(null)}>
                      {dataStatus.message}
                    </Alert>
                  ) : null}
                </Stack>
                <Divider />
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">API tokens</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      label="Token label"
                      value={tokenLabel}
                      onChange={(event) => setTokenLabel(event.target.value)}
                      placeholder="e.g., CLI client"
                      size="small"
                      sx={{ maxWidth: 320 }}
                      disabled={isOffline}
                    />
                    <Button
                      variant="outlined"
                      onClick={handleGenerateToken}
                      disabled={isOffline}
                      title={isOffline ? 'Reconnect to generate tokens' : undefined}
                    >
                      Generate API token
                    </Button>
                  </Stack>
                  {tokenStatus ? (
                    <Alert severity={tokenStatus.type} onClose={() => setTokenStatus(null)}>
                      {tokenStatus.message}
                      {generatedToken && tokenStatus.type !== 'warning' ? (
                        <Typography variant="caption" component="div">
                          Last token: <code>{generatedToken}</code>
                        </Typography>
                      ) : null}
                    </Alert>
                  ) : null}
                  <Typography variant="caption" color="text.secondary">
                    API tokens behave like passwords. Revoke any token you no longer use.
                  </Typography>
                  {isLoadingTokens ? (
                    <Stack alignItems="center" spacing={1}>
                      <CircularProgress size={20} />
                      <Typography variant="body2" color="text.secondary">
                        Loading tokens...
                      </Typography>
                    </Stack>
                  ) : apiTokens.length ? (
                    <List dense disablePadding>
                      {apiTokens.map((token) => (
                        <ListItem
                          key={token.id}
                          secondaryAction={
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleRevokeToken(token.id)}
                              disabled={isOffline}
                              title={isOffline ? 'Reconnect to revoke tokens' : undefined}
                            >
                              Revoke
                            </Button>
                          }
                        >
                          <ListItemText
                            primary={token.label || 'Untitled token'}
                            secondary={
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5}>
                                <Typography component="span" variant="caption" color="text.secondary">
                                  Preview: {token.preview ? `${token.preview}••••` : '••••••'}
                                </Typography>
                                {token.createdAt ? (
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    Created {new Date(token.createdAt).toLocaleString()}
                                  </Typography>
                                ) : null}
                              </Stack>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No active tokens yet.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </TabPanel>
          </Stack>
        </Paper>

        <Paper elevation={3} sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="h6">Anonymous feedback</Typography>
            <Typography variant="body2" color="text.secondary">
              Share suggestions or bugs with the team. Add contact info if you’d like a follow-up.
            </Typography>
            <Button
              type="button"
              variant="contained"
              color="secondary"
              startIcon={<FeedbackIcon />}
              onClick={handleOpenFeedbackDialog}
              disabled={isOffline}
              title={isOffline ? 'Reconnect to share feedback' : undefined}
            >
              Send feedback
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={3} sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Account tools</Typography>
            <Typography variant="body2" color="text.secondary">
              Review who you&apos;ve blocked or sign out of the app.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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
        open={feedbackDialogOpen}
        onClose={handleCloseFeedbackDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Send anonymous feedback</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              We read every message. Please avoid sharing personal details unless you want us to reach out.
            </Typography>
            <TextField
              label="Your feedback"
              multiline
              minRows={4}
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              disabled={isSubmittingFeedback}
              helperText="At least 10 characters."
            />
            <TextField
              label="Contact (optional)"
              value={feedbackContact}
              onChange={(event) => setFeedbackContact(event.target.value)}
              disabled={isSubmittingFeedback}
              placeholder="Email or @username"
            />
            {feedbackError ? (
              <Alert severity="error" onClose={() => setFeedbackError(null)}>
                {feedbackError}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFeedbackDialog} disabled={isSubmittingFeedback}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitFeedback}
            variant="contained"
            color="secondary"
            disabled={isSubmittingFeedback || isOffline}
            title={isOffline ? 'Reconnect to send feedback' : undefined}
          >
            {isSubmittingFeedback ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
            {isSubmittingFeedback ? 'Sending...' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

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

      <Snackbar
        open={Boolean(feedbackStatus)}
        autoHideDuration={4000}
        onClose={(event, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          handleFeedbackStatusClose();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {feedbackStatus ? (
          <Alert
            elevation={6}
            variant="filled"
            severity={feedbackStatus.type}
            onClose={handleFeedbackStatusClose}
          >
            {feedbackStatus.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  );
}

export default SettingsPage;
