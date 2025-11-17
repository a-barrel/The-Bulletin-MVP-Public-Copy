/* NOTE: Page exports configuration alongside the component. */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Chip,
  Tabs,
  Tab
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FeedbackIcon from '@mui/icons-material/FeedbackOutlined';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GlobalNavMenu from '../components/GlobalNavMenu';
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
import { formatFriendlyTimestamp, formatRelativeTime } from '../utils/dates';
import { PIN_DENSITY_LEVELS } from '../utils/pinDensity';
import TabPanel from '../components/settings/TabPanel';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import PrivacySettings from '../components/settings/PrivacySettings';
import DataIntegrationsSettings from '../components/settings/DataIntegrationsSettings';
import FeedbackDialog from '../components/settings/FeedbackDialog';
import BlockedUsersDialog from '../components/settings/BlockedUsersDialog';

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
    handleQuietHoursChange,
    handleApplyNotificationBundle,
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
  const quietHours = Array.isArray(notifications.quietHours) ? notifications.quietHours : [];
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
  const listSyncsWithMapLimit =
    displaySettings.listSyncsWithMapLimit ?? DEFAULT_SETTINGS.display.listSyncsWithMapLimit;
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

  const handleReduceMotionToggle = useCallback(
    (value) => handleDisplayToggle('reduceMotion', value),
    [handleDisplayToggle]
  );
  const handleHighContrastToggle = useCallback(
    (value) => handleDisplayToggle('highContrast', value),
    [handleDisplayToggle]
  );
  const handleCelebrationSoundsPreference = useCallback(
    (value) => {
      handleDisplayToggle('celebrationSounds', value);
      setBadgeSoundEnabled(value);
    },
    [handleDisplayToggle, setBadgeSoundEnabled]
  );
  const handleFriendBadgesPreference = useCallback(
    (value) => {
      handleDisplayToggle('showFriendBadges', value);
      setFriendBadgesEnabled(value);
    },
    [handleDisplayToggle, setFriendBadgesEnabled]
  );
  const handleListSyncsToggle = useCallback(
    (value) => handleDisplayToggle('listSyncsWithMapLimit', value),
    [handleDisplayToggle]
  );
  const handleTokenLabelChange = useCallback(
    (event) => setTokenLabel(event.target.value),
    [setTokenLabel]
  );
  const handleFeedbackMessageChange = useCallback(
    (event) => setFeedbackMessage(event.target.value),
    [setFeedbackMessage]
  );
  const handleFeedbackContactChange = useCallback(
    (event) => setFeedbackContact(event.target.value),
    [setFeedbackContact]
  );
  const handleClearFeedbackError = useCallback(() => setFeedbackError(null), [setFeedbackError]);


  const notificationsMutedUntil = settings.notificationsMutedUntil;
  const muteUntilDate = notificationsMutedUntil ? new Date(notificationsMutedUntil) : null;
  const isMuteActive = Boolean(muteUntilDate && muteUntilDate.getTime() > Date.now());
  const muteStatusLabel = isMuteActive
    ? `Muted until ${formatFriendlyTimestamp(notificationsMutedUntil)}`
    : 'Notifications active';
  const muteCountdownLabel = isMuteActive
    ? `Ends ${formatRelativeTime(notificationsMutedUntil, { fallback: 'soon' })}`
    : '';

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
        <Stack direction="row" alignItems="center" spacing={1.25}>
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
          <GlobalNavMenu
            triggerClassName="gnm-trigger-btn"
            iconClassName="gnm-trigger-btn__icon"
          />
        </Stack>

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
              <AppearanceSettings
                theme={theme}
                onThemeChange={handleThemeChange}
                textScale={textScale}
                onTextScaleChange={handleTextScaleChange}
                reduceMotion={reduceMotion}
                onReduceMotionToggle={handleReduceMotionToggle}
                highContrast={highContrast}
                onHighContrastToggle={handleHighContrastToggle}
                celebrationSounds={celebrationSounds}
                onCelebrationSoundsToggle={handleCelebrationSoundsPreference}
                showFriendBadges={showFriendBadges}
                onShowFriendBadgesToggle={handleFriendBadgesPreference}
                mapDensity={mapDensity}
                pinDensityOptions={PIN_DENSITY_LEVELS}
                onMapDensityChange={handleMapDensityChange}
                listSyncsWithMapLimit={listSyncsWithMapLimit}
                onListSyncsToggle={handleListSyncsToggle}
                radiusMeters={radiusMeters}
                radiusMiles={radiusMiles}
                onRadiusChange={handleRadiusChange}
                radiusMin={RADIUS_MIN}
                radiusMax={RADIUS_MAX}
                formatMetersToMiles={metersToMiles}
              />
            </TabPanel>

            <TabPanel value="notifications" current={activeTab}>
              <NotificationSettings
                isOffline={isOffline}
                isFetchingProfile={isFetchingProfile}
                isMuteActive={isMuteActive}
                muteStatusLabel={muteStatusLabel}
                muteCountdownLabel={muteCountdownLabel}
                hasMuteTimer={Boolean(notificationsMutedUntil)}
                onQuickMute={handleQuickMuteNotifications}
                onClearMute={handleClearNotificationMute}
                notifications={notifications}
                quietHours={quietHours}
                onQuietHoursChange={handleQuietHoursChange}
                onApplyBundle={handleApplyNotificationBundle}
                onToggleNotification={handleNotificationToggle}
                digestFrequency={digestFrequency}
                onDigestFrequencyChange={handleDigestFrequencyChange}
              />
            </TabPanel>

            <TabPanel value="privacy" current={activeTab}>
              <PrivacySettings
                settings={settings}
                onLocationSharingToggle={handleLocationSharingToggle}
                onStatsVisibilityToggle={handleStatsVisibilityToggle}
                onFilterCussWordsToggle={handleFilterCussWordsToggle}
                dmPermission={dmPermission}
                onDmPermissionChange={handleDmPermissionChange}
                onManageBlockedUsers={handleOpenBlockedOverlay}
                canAccessAdminDashboard={canAccessAdminDashboard}
                adminRoute={routes.admin.base}
                profileRoute={routes.profile.me}
                isOffline={isOffline}
                isManagingBlockedUsers={isManagingBlockedUsers}
              />
            </TabPanel>

            <TabPanel value="data" current={activeTab}>
              <DataIntegrationsSettings
                isOffline={isOffline}
                autoExportReminders={autoExportReminders}
                onAutoExportRemindersToggle={handleAutoExportRemindersToggle}
                onDataExport={handleDataExport}
                dataStatus={dataStatus}
                onDismissDataStatus={() => setDataStatus(null)}
                tokenLabel={tokenLabel}
                onTokenLabelChange={handleTokenLabelChange}
                onGenerateToken={handleGenerateToken}
                tokenStatus={tokenStatus}
                onDismissTokenStatus={() => setTokenStatus(null)}
                generatedToken={generatedToken}
                apiTokens={apiTokens}
                isLoadingTokens={isLoadingTokens}
                onRevokeToken={handleRevokeToken}
              />
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

      <FeedbackDialog
        open={feedbackDialogOpen}
        message={feedbackMessage}
        contact={feedbackContact}
        error={feedbackError}
        isSubmitting={isSubmittingFeedback}
        isOffline={isOffline}
        onClose={handleCloseFeedbackDialog}
        onSubmit={handleSubmitFeedback}
        onMessageChange={handleFeedbackMessageChange}
        onContactChange={handleFeedbackContactChange}
        onClearError={handleClearFeedbackError}
      />

      <BlockedUsersDialog
        open={blockedOverlayOpen}
        status={blockedOverlayStatus}
        onClearStatus={() => setBlockedOverlayStatus(null)}
        isLoading={isLoadingBlockedUsers}
        users={blockedUsers}
        onUnblock={handleUnblockUser}
        isOffline={isOffline}
        isManaging={isManagingBlockedUsers}
        onClose={handleCloseBlockedOverlay}
      />

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
