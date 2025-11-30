import { useCallback } from 'react';
import useSettingsProfile from './settings/useSettingsProfile';
import useBlockedUsersManager from './settings/useBlockedUsersManager';
import useSettingsPersistence from './settings/useSettingsPersistence';
import { logClientEvent } from '../api';

export const RADIUS_MIN = 100;
export const RADIUS_MAX = 80467; // 50 miles
export const SUPPORTED_THEMES = [
  'light',
  'dark',
  'neon',
  'sunset',
  'forest',
  'ocean',
  'candy',
  'glitch',
  'plasma',
  'rainbow',
  'aurora',
  'rainbow-animated'
];

export const DEFAULT_SETTINGS = {
  theme: 'light',
  radiusPreferenceMeters: 16093,
  filterCussWords: false,
  statsPublic: true,
  betaOptIn: false,
  dmPermission: 'everyone',
  digestFrequency: 'weekly',
  autoExportReminders: false,
  notifications: {
    quietHours: [],
    proximity: true,
    updates: true,
    pinCreated: true,
    pinUpdates: true,
    eventReminders: true,
    discussionReminders: true,
    bookmarkReminders: true,
    chatMessages: true,
    marketing: false,
    chatTransitions: true,
    friendRequests: true,
    badgeUnlocks: true,
    moderationAlerts: true,
    dmMentions: true,
    emailDigests: false
  },
  notificationsVerbosity: {
    chat: 'highlights'
  },
  notificationsMutedUntil: null,
  display: {
    textScale: 1,
    reduceMotion: false,
    highContrast: false,
    mapDensity: 'balanced',
    celebrationSounds: true,
    showFriendBadges: true,
    listSyncsWithMapLimit: true
  }
};

export const roundRadius = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SETTINGS.radiusPreferenceMeters;
  }
  const clamped = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(value)));
  return clamped;
};

export default function useSettingsManager({ authUser, authLoading, isOffline }) {
  const {
    profile,
    setProfile,
    settings,
    setSettings,
    profileError,
    isFetchingProfile,
    baselineSettings,
    hasChanges
  } = useSettingsProfile({ authUser, authLoading, isOffline });

  const {
    blockedOverlayOpen,
    blockedUsers,
    isLoadingBlockedUsers,
    isManagingBlockedUsers,
    blockedOverlayStatus,
    setBlockedOverlayStatus,
    handleOpenBlockedOverlay,
    handleCloseBlockedOverlay,
    handleUnblockUser
  } = useBlockedUsersManager({ isOffline, setProfile });

  const {
    isSaving,
    saveStatus,
    setSaveStatus,
    handleSave,
    handleSignOut
  } = useSettingsPersistence({
    authUser,
    settings,
    hasChanges,
    isOffline,
    setProfile
  });

  const logSettingsEvent = useCallback((message, context = {}) => {
    logClientEvent({
      category: 'settings-notifications',
      severity: 'info',
      message,
      context
    });
  }, []);

  const handleReset = useCallback(() => {
    setSettings(baselineSettings);
    setSaveStatus(null);
    logSettingsEvent('settings-reset', {});
  }, [baselineSettings, logSettingsEvent, setSaveStatus, setSettings]);

  const handleThemeChange = useCallback((event) => {
    const value = event.target.value;
    const nextTheme = SUPPORTED_THEMES.includes(value) ? value : 'light';
    setSettings((prev) => ({
      ...prev,
      theme: nextTheme
    }));
  }, [setSettings]);

  const handleRadiusChange = useCallback((event, value) => {
    setSettings((prev) => ({
      ...prev,
      radiusPreferenceMeters: roundRadius(Array.isArray(value) ? value[0] : value)
    }));
  }, [setSettings]);

  const handleNotificationToggle = useCallback((key, nextValue) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: typeof nextValue === 'boolean' ? nextValue : !prev.notifications[key]
      }
    }));
  }, [setSettings]);

  const handleQuietHoursChange = useCallback(
    (nextSchedule) => {
      setSettings((prev) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          quietHours: Array.isArray(nextSchedule) ? nextSchedule : []
        }
      }));
      const enabledCount = Array.isArray(nextSchedule)
        ? nextSchedule.filter((entry) => entry?.enabled !== false).length
        : 0;
      logSettingsEvent('quiet-hours-updated', { enabledCount });
    },
    [logSettingsEvent, setSettings]
  );

  const handleNotificationVerbosityChange = useCallback(
    (key, value) => {
      if (typeof key !== 'string' || !key.trim()) {
        return;
      }
      setSettings((prev) => ({
        ...prev,
        notificationsVerbosity: {
          ...(prev.notificationsVerbosity || DEFAULT_SETTINGS.notificationsVerbosity),
          [key]: value
        }
      }));
      logSettingsEvent('notification-verbosity-updated', { channel: key, value });
    },
    [logSettingsEvent, setSettings]
  );

  const handleApplyNotificationBundle = useCallback(
    (bundle) => {
      if (!bundle || typeof bundle !== 'object') {
        return;
      }
      const toggles =
        bundle.toggles && typeof bundle.toggles === 'object' ? bundle.toggles : bundle;
      setSettings((prev) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          ...toggles
        }
      }));
      setSaveStatus({
        type: 'info',
        message: 'Notification bundle applied. Review toggles, then save to keep the changes.'
      });
      const bundleId = typeof bundle.id === 'string' ? bundle.id : 'custom';
      logSettingsEvent('notification-bundle-applied', { bundleId });
    },
    [logSettingsEvent, setSaveStatus, setSettings]
  );

  const handleBetaToggle = useCallback(
    (value) => {
      setSettings((prev) => ({
        ...prev,
        betaOptIn: typeof value === 'boolean' ? value : !prev.betaOptIn
      }));
      logSettingsEvent('beta-opt-toggle', { enabled: value });
    },
    [logSettingsEvent, setSettings]
  );

  const handleQuickMuteNotifications = useCallback(
    (hours = 4) => {
      const duration = Math.max(0.5, Number(hours) || 4);
      const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
      setSettings((prev) => ({
        ...prev,
        notificationsMutedUntil: expiresAt
      }));
      setSaveStatus({
        type: 'info',
        message: `Notifications muted until ${new Date(expiresAt).toLocaleString()}. Save to apply.`
      });
      logSettingsEvent('notification-quick-mute', { durationHours: duration });
    },
    [logSettingsEvent, setSaveStatus, setSettings]
  );

  const handleClearNotificationMute = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      notificationsMutedUntil: null
    }));
    setSaveStatus((prev) =>
      prev?.type === 'info'
        ? prev
        : { type: 'info', message: 'Notification mute cleared. Save to apply.' }
    );
    logSettingsEvent('notification-mute-cleared', {});
  }, [logSettingsEvent, setSaveStatus, setSettings]);

  const handleTextScaleChange = useCallback((event, value) => {
    const next = Array.isArray(value) ? value[0] : value;
    setSettings((prev) => ({
      ...prev,
      display: {
        ...prev.display,
        textScale: Math.min(1.4, Math.max(0.8, Number(next) || DEFAULT_SETTINGS.display.textScale))
      }
    }));
  }, [setSettings]);

  const handleDisplayToggle = useCallback((key, nextValue) => {
    setSettings((prev) => {
      const currentValue = Boolean(prev.display?.[key]);
      const resolvedValue = typeof nextValue === 'boolean' ? nextValue : !currentValue;
      return {
        ...prev,
        display: {
          ...prev.display,
          [key]: resolvedValue
        }
      };
    });
  }, [setSettings]);

  const handleMapDensityChange = useCallback((event) => {
    const value = event.target.value;
    setSettings((prev) => ({
      ...prev,
      display: {
        ...prev.display,
        mapDensity: value
      }
    }));
  }, [setSettings]);

  const handleDmPermissionChange = useCallback((event) => {
    const value = event.target.value;
    setSettings((prev) => ({
      ...prev,
      dmPermission: value
    }));
  }, [setSettings]);

  const handleDigestFrequencyChange = useCallback((event) => {
    const value = event.target.value;
    setSettings((prev) => ({
      ...prev,
      digestFrequency: value
    }));
  }, [setSettings]);

  const handleAutoExportRemindersToggle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      autoExportReminders: !prev.autoExportReminders
    }));
  }, [setSettings]);

  const handleStatsVisibilityToggle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      statsPublic: !prev.statsPublic
    }));
  }, [setSettings]);

  const handleFilterCussWordsToggle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      filterCussWords: !prev.filterCussWords
    }));
  }, [setSettings]);

  return {
    profile,
    setProfile,
    profileError,
    isFetchingProfile,
    settings,
    setSettings,
    saveStatus,
    setSaveStatus,
    isSaving,
    baselineSettings,
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
    handleQuietHoursChange,
    handleNotificationVerbosityChange,
    handleApplyNotificationBundle,
    handleQuickMuteNotifications,
    handleClearNotificationMute,
    handleTextScaleChange,
    handleDisplayToggle,
    handleMapDensityChange,
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
  };
}
