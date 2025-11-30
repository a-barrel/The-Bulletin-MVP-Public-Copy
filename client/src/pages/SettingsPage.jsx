/* NOTE: Page exports configuration alongside the component. */
import React, { useCallback, useEffect, useState, memo } from 'react';
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
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FeedbackIcon from '@mui/icons-material/FeedbackOutlined';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PageNavHeader from '../components/PageNavHeader';
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
import { requestDataExport } from '../api';
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
import settingsPalette, { settingsButtonStyles } from '../components/settings/settingsPalette';
import canAccessModerationTools from '../utils/accessControl';
import { useTranslation } from 'react-i18next';
import HelpAbout from '../components/settings/HelpAbout';
import useApiTokensManager from '../hooks/settings/useApiTokensManager';
import useFeedbackForm from '../hooks/settings/useFeedbackForm';
import { useThemePreference } from '../contexts/ThemePreferenceContext';

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
  const { t } = useTranslation();
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
    setSettings,
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
    handleNotificationVerbosityChange,
    handleApplyNotificationBundle,
    handleStatsVisibilityToggle,
    handleFilterCussWordsToggle,
    handleDmPermissionChange,
    handleDigestFrequencyChange,
    handleAutoExportRemindersToggle,
    handleOpenBlockedOverlay,
    handleCloseBlockedOverlay,
    handleUnblockUser,
    handleBetaToggle,
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
  const notificationsVerbosity = {
    ...DEFAULT_SETTINGS.notificationsVerbosity,
    ...(settings.notificationsVerbosity || {})
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
  const listSyncsWithMapLimit =
    displaySettings.listSyncsWithMapLimit ?? DEFAULT_SETTINGS.display.listSyncsWithMapLimit;
  const dmPermission = settings.dmPermission ?? DEFAULT_SETTINGS.dmPermission;
  const digestFrequency = settings.digestFrequency ?? DEFAULT_SETTINGS.digestFrequency;
  const autoExportReminders =
    settings.autoExportReminders ?? DEFAULT_SETTINGS.autoExportReminders;
  const betaOptIn = settings.betaOptIn ?? DEFAULT_SETTINGS.betaOptIn;
  const [activeTab, setActiveTab] = useState('appearance');
  const [dataStatus, setDataStatus] = useState(null);

  const {
    feedbackDialogOpen,
    feedbackMessage,
    feedbackContact,
    feedbackError,
    isSubmittingFeedback,
    feedbackStatus,
    handleFeedbackMessageChange,
    handleFeedbackContactChange,
    handleClearFeedbackError,
    handleOpenFeedbackDialog,
    handleCloseFeedbackDialog,
    handleSubmitFeedback,
    handleFeedbackStatusClose
  } = useFeedbackForm();
  const { theme: themePreference, setTheme: setThemePreference } = useThemePreference();

  const {
    tokenStatus,
    setTokenStatus,
    generatedToken,
    setGeneratedToken,
    apiTokens,
    isLoadingTokens,
    tokenLabel,
    setTokenLabel,
    loadApiTokens,
    handleGenerateToken,
    handleRevokeToken
  } = useApiTokensManager({ isOffline });

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
  useEffect(() => {
    if (themePreference && themePreference !== settings.theme) {
      setSettings((prev) => ({ ...prev, theme: themePreference }));
    }
  }, [setSettings, settings.theme, themePreference]);

  const handleThemeChangeSynced = useCallback(
    (event) => {
      handleThemeChange(event);
      const value = event?.target?.value;
      if (value) {
        setThemePreference(value);
      }
    },
    [handleThemeChange, setThemePreference]
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
  const notificationsMutedUntil = settings.notificationsMutedUntil;
  const muteUntilDate = notificationsMutedUntil ? new Date(notificationsMutedUntil) : null;
  const isMuteActive = Boolean(muteUntilDate && muteUntilDate.getTime() > Date.now());
  const muteStatusLabel = isMuteActive
    ? `Muted until ${formatFriendlyTimestamp(notificationsMutedUntil)}`
    : 'Notifications active';
  const muteCountdownLabel = isMuteActive
    ? `Ends ${formatRelativeTime(notificationsMutedUntil, { fallback: 'soon' })}`
    : '';

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

  const canAccessAdminDashboard = canAccessModerationTools(profile);

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
        minHeight: '100vh',
        background: 'var(--page-bg)',
        py: 0,
        px: 0
      }}
    >
      <Box
        sx={{
          width: '100%',
          py: 0,
          px: 0
        }}
      >
      <Stack spacing={3}>
        <PageNavHeader
          title="Settings"
          rightSlot={
            authUser ? (
              <Chip
                variant="outlined"
                icon={<ManageAccountsIcon />}
                label={authUser.email ?? 'Authenticated'}
                size="small"
                sx={{
                  backgroundColor: settingsPalette.pastelBlue,
                  borderColor: settingsPalette.accentLight,
                  color: settingsPalette.textPrimary,
                  fontWeight: 600,
                  '.MuiChip-icon': { color: settingsPalette.accent }
                }}
              />
            ) : null
          }
        />

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

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 4,
            backgroundColor: 'var(--color-surface)',
            border: `1px solid ${settingsPalette.borderSubtle}`,
            boxShadow: '0 25px 65px rgba(93, 56, 137, 0.15)'
          }}
        >
          <Stack spacing={3}>
            <Tabs
              value={activeTab}
              onChange={(event, value) => setActiveTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{
                backgroundColor: settingsPalette.pastelLavender,
                borderRadius: 999,
                px: 0.5,
                '& .MuiTabs-indicator': { display: 'none' },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  minHeight: 44,
                  borderRadius: 999,
                  color: settingsPalette.accent,
                  opacity: 1
                },
                '& .Mui-selected': {
                  backgroundColor: settingsPalette.accent,
                  color: 'var(--color-text-on-accent) !important'
                }
              }}
            >
              <Tab label={t('settings.tabs.appearance')} value="appearance" />
              <Tab label={t('settings.tabs.notifications')} value="notifications" />
              <Tab label={t('settings.tabs.privacy')} value="privacy" />
              <Tab label={t('settings.tabs.data')} value="data" />
              <Tab label={t('settings.tabs.help', 'Help/About')} value="help" />
            </Tabs>

            <Divider />

            <TabPanel value="appearance" current={activeTab}>
              <AppearanceSettings
                theme={theme}
                onThemeChange={handleThemeChangeSynced}
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
                notificationVerbosity={notificationsVerbosity}
                onVerbosityChange={handleNotificationVerbosityChange}
                onApplyBundle={handleApplyNotificationBundle}
                onToggleNotification={handleNotificationToggle}
                digestFrequency={digestFrequency}
                onDigestFrequencyChange={handleDigestFrequencyChange}
              />
            </TabPanel>

            <TabPanel value="privacy" current={activeTab}>
              <PrivacySettings
                settings={settings}
                onStatsVisibilityToggle={handleStatsVisibilityToggle}
                onFilterCussWordsToggle={handleFilterCussWordsToggle}
                dmPermission={dmPermission}
                onDmPermissionChange={handleDmPermissionChange}
                onManageBlockedUsers={handleOpenBlockedOverlay}
                canAccessAdminDashboard={canAccessAdminDashboard}
                adminRoute={routes.admin.base}
                profileRoute={routes.profile.me}
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
                onTokenLabelChange={setTokenLabel}
                onGenerateToken={handleGenerateToken}
                tokenStatus={tokenStatus}
                onDismissTokenStatus={() => setTokenStatus(null)}
                generatedToken={generatedToken}
                apiTokens={apiTokens}
                isLoadingTokens={isLoadingTokens}
                onRevokeToken={handleRevokeToken}
              />
              <Box
                sx={{
                  mt: 3,
                  p: 2.5,
                  borderRadius: 3,
                  border: `1px solid ${settingsPalette.borderSubtle}`,
                  backgroundColor: 'var(--color-surface)'
                }}
              >
                <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700, mb: 1 }}>
                  Beta features
                </Typography>
                <Typography variant="body2" sx={{ color: settingsPalette.textPrimary, mb: 1.5 }}>
                  Opt in to preview experimental features. Turn off anytime if you prefer stable features only.
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={betaOptIn}
                      onChange={(event) => handleBetaToggle(event.target.checked)}
                      color="primary"
                    />
                  }
                  label="Enable beta features"
                  sx={{ color: settingsPalette.textPrimary }}
                />
              </Box>
            </TabPanel>

            <TabPanel value="help" current={activeTab}>
              <HelpAbout routes={routes} onNavigate={(path) => navigate(path)} />
            </TabPanel>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 4,
            backgroundColor: settingsPalette.pastelLavender,
            border: `1px solid ${settingsPalette.borderSubtle}`,
            boxShadow: settingsPalette.shadowSoft
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700 }}>
              Anonymous feedback
            </Typography>
            <Typography variant="body2" sx={{ color: settingsPalette.textPrimary }}>
              Share suggestions or bugs with the team. Add contact info if you’d like a follow-up.
            </Typography>
            <Button
              type="button"
              variant="contained"
              startIcon={<FeedbackIcon />}
              onClick={handleOpenFeedbackDialog}
              disabled={isOffline}
              title={isOffline ? 'Reconnect to share feedback' : undefined}
              sx={{ ...settingsButtonStyles.contained, alignSelf: { xs: 'stretch', sm: 'flex-start' }, px: 3 }}
            >
              Send feedback
            </Button>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 4,
            backgroundColor: 'var(--color-surface)',
            border: `1px solid ${settingsPalette.borderSubtle}`,
            boxShadow: '0 12px 30px rgba(93, 56, 137, 0.1)'
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700 }}>
              Account tools
            </Typography>
            <Typography variant="body2" sx={{ color: settingsPalette.textPrimary }}>
              Review who you&apos;ve blocked or sign out of the app.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                onClick={handleSignOut}
                variant="outlined"
                startIcon={<LogoutIcon />}
                sx={{
                  borderColor: 'var(--danger)',
                  color: 'var(--danger)',
                  borderRadius: 999,
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: 'color-mix(in srgb, var(--danger) 80%, transparent)',
                    backgroundColor: 'color-mix(in srgb, var(--danger) 16%, transparent)',
                    color: 'var(--danger)'
                  }
                }}
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
            sx={settingsButtonStyles.outlined}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isOffline || !profile || !hasChanges || isSaving || isFetchingProfile}
            onClick={handleSave}
            title={isOffline ? 'Reconnect to save changes' : undefined}
            sx={settingsButtonStyles.contained}
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
    </Box>
  );
}

export default memo(SettingsPage);
