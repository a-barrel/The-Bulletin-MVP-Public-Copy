import { useCallback } from 'react';
import useSettingsProfile from './settings/useSettingsProfile';
import useBlockedUsersManager from './settings/useBlockedUsersManager';
import useSettingsPersistence from './settings/useSettingsPersistence';

export const RADIUS_MIN = 100;
export const RADIUS_MAX = 80467; // 50 miles

export const DEFAULT_SETTINGS = {
  theme: 'system',
  radiusPreferenceMeters: 16093,
  locationSharingEnabled: false,
  filterCussWords: false,
  statsPublic: true,
  dmPermission: 'everyone',
  digestFrequency: 'weekly',
  autoExportReminders: false,
  notifications: {
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

  const handleReset = useCallback(() => {
    setSettings(baselineSettings);
    setSaveStatus(null);
  }, [baselineSettings, setSaveStatus, setSettings]);

  const handleThemeChange = useCallback((event) => {
    const value = event.target.value;
    setSettings((prev) => ({
      ...prev,
      theme: value
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

  const handleQuickMuteNotifications = useCallback((hours = 4) => {
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
  }, [setSaveStatus, setSettings]);

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
  }, [setSaveStatus, setSettings]);

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

  const handleLocationSharingToggle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      locationSharingEnabled: !prev.locationSharingEnabled
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
  };
}
