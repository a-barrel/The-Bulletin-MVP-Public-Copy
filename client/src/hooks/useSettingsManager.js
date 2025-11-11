import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';

import {
  fetchBlockedUsers,
  fetchCurrentUserProfile,
  revokeCurrentSession,
  unblockUser,
  updateCurrentUserProfile
} from '../api/mongoDataApi';
import { auth } from '../firebase';
import reportClientError from '../utils/reportClientError';

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
    celebrationSounds: true
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
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [blockedOverlayOpen, setBlockedOverlayOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [isManagingBlockedUsers, setIsManagingBlockedUsers] = useState(false);
  const [blockedOverlayStatus, setBlockedOverlayStatus] = useState(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authUser) {
      setProfile(null);
      setSettings(DEFAULT_SETTINGS);
      setProfileError('Sign in to manage your settings.');
      return;
    }

    if (isOffline) {
      setIsFetchingProfile(false);
      setProfileError((prev) => prev ?? 'You are offline. Connect to update your settings.');
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
          dmPermission: result?.preferences?.dmPermission ?? DEFAULT_SETTINGS.dmPermission,
          digestFrequency: result?.preferences?.digestFrequency ?? DEFAULT_SETTINGS.digestFrequency,
          autoExportReminders:
            result?.preferences?.data?.autoExportReminders ?? DEFAULT_SETTINGS.autoExportReminders,
          notificationsMutedUntil: result?.preferences?.notificationsMutedUntil ?? null,
          notifications: {
            proximity:
              result?.preferences?.notifications?.proximity ?? DEFAULT_SETTINGS.notifications.proximity,
            updates:
              result?.preferences?.notifications?.updates ?? DEFAULT_SETTINGS.notifications.updates,
            pinCreated:
              result?.preferences?.notifications?.pinCreated ?? DEFAULT_SETTINGS.notifications.pinCreated,
            pinUpdates:
              result?.preferences?.notifications?.pinUpdates ?? DEFAULT_SETTINGS.notifications.pinUpdates,
            eventReminders:
              result?.preferences?.notifications?.eventReminders ??
              DEFAULT_SETTINGS.notifications.eventReminders,
            discussionReminders:
              result?.preferences?.notifications?.discussionReminders ??
              DEFAULT_SETTINGS.notifications.discussionReminders,
            bookmarkReminders:
              result?.preferences?.notifications?.bookmarkReminders ??
              DEFAULT_SETTINGS.notifications.bookmarkReminders,
            chatMessages:
              result?.preferences?.notifications?.chatMessages ??
              DEFAULT_SETTINGS.notifications.chatMessages,
            marketing:
              result?.preferences?.notifications?.marketing ?? DEFAULT_SETTINGS.notifications.marketing,
            chatTransitions:
              result?.preferences?.notifications?.chatTransitions ??
              DEFAULT_SETTINGS.notifications.chatTransitions,
            friendRequests:
              result?.preferences?.notifications?.friendRequests ??
              DEFAULT_SETTINGS.notifications.friendRequests,
            badgeUnlocks:
              result?.preferences?.notifications?.badgeUnlocks ??
              DEFAULT_SETTINGS.notifications.badgeUnlocks,
            moderationAlerts:
              result?.preferences?.notifications?.moderationAlerts ??
              DEFAULT_SETTINGS.notifications.moderationAlerts,
            dmMentions:
              result?.preferences?.notifications?.dmMentions ??
              DEFAULT_SETTINGS.notifications.dmMentions,
            emailDigests:
              result?.preferences?.notifications?.emailDigests ??
              DEFAULT_SETTINGS.notifications.emailDigests
          },
          display: {
            textScale: result?.preferences?.display?.textScale ?? DEFAULT_SETTINGS.display.textScale,
            reduceMotion:
              result?.preferences?.display?.reduceMotion ?? DEFAULT_SETTINGS.display.reduceMotion,
            highContrast:
              result?.preferences?.display?.highContrast ?? DEFAULT_SETTINGS.display.highContrast,
            mapDensity:
              result?.preferences?.display?.mapDensity ?? DEFAULT_SETTINGS.display.mapDensity,
            celebrationSounds:
              result?.preferences?.display?.celebrationSounds ??
              DEFAULT_SETTINGS.display.celebrationSounds
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
  }, [authLoading, authUser, isOffline]);

  useEffect(() => {
    if (!blockedOverlayOpen) {
      return;
    }

    if (isOffline) {
      setIsLoadingBlockedUsers(false);
      setBlockedOverlayStatus((prev) =>
        prev?.type === 'warning'
          ? prev
          : {
              type: 'warning',
              message: 'Blocked users cannot be managed while offline.'
            }
      );
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
  }, [blockedOverlayOpen, isOffline]);

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
      dmPermission: profile?.preferences?.dmPermission ?? DEFAULT_SETTINGS.dmPermission,
      digestFrequency: profile?.preferences?.digestFrequency ?? DEFAULT_SETTINGS.digestFrequency,
      autoExportReminders:
        profile?.preferences?.data?.autoExportReminders ?? DEFAULT_SETTINGS.autoExportReminders,
      notificationsMutedUntil: profile?.preferences?.notificationsMutedUntil ?? null,
      notifications: {
        proximity:
          profile?.preferences?.notifications?.proximity ?? DEFAULT_SETTINGS.notifications.proximity,
        updates:
          profile?.preferences?.notifications?.updates ?? DEFAULT_SETTINGS.notifications.updates,
        pinCreated:
          profile?.preferences?.notifications?.pinCreated ?? DEFAULT_SETTINGS.notifications.pinCreated,
        pinUpdates:
          profile?.preferences?.notifications?.pinUpdates ?? DEFAULT_SETTINGS.notifications.pinUpdates,
        eventReminders:
          profile?.preferences?.notifications?.eventReminders ??
          DEFAULT_SETTINGS.notifications.eventReminders,
        discussionReminders:
          profile?.preferences?.notifications?.discussionReminders ??
          DEFAULT_SETTINGS.notifications.discussionReminders,
        bookmarkReminders:
          profile?.preferences?.notifications?.bookmarkReminders ??
          DEFAULT_SETTINGS.notifications.bookmarkReminders,
        chatMessages:
          profile?.preferences?.notifications?.chatMessages ?? DEFAULT_SETTINGS.notifications.chatMessages,
        marketing:
          profile?.preferences?.notifications?.marketing ?? DEFAULT_SETTINGS.notifications.marketing,
        chatTransitions:
          profile?.preferences?.notifications?.chatTransitions ??
          DEFAULT_SETTINGS.notifications.chatTransitions,
        friendRequests:
          profile?.preferences?.notifications?.friendRequests ??
          DEFAULT_SETTINGS.notifications.friendRequests,
        badgeUnlocks:
          profile?.preferences?.notifications?.badgeUnlocks ??
          DEFAULT_SETTINGS.notifications.badgeUnlocks,
        moderationAlerts:
          profile?.preferences?.notifications?.moderationAlerts ??
          DEFAULT_SETTINGS.notifications.moderationAlerts,
        dmMentions:
          profile?.preferences?.notifications?.dmMentions ?? DEFAULT_SETTINGS.notifications.dmMentions,
        emailDigests:
          profile?.preferences?.notifications?.emailDigests ??
          DEFAULT_SETTINGS.notifications.emailDigests
      },
      display: {
        textScale: profile?.preferences?.display?.textScale ?? DEFAULT_SETTINGS.display.textScale,
        reduceMotion:
          profile?.preferences?.display?.reduceMotion ?? DEFAULT_SETTINGS.display.reduceMotion,
        highContrast:
          profile?.preferences?.display?.highContrast ?? DEFAULT_SETTINGS.display.highContrast,
        mapDensity: profile?.preferences?.display?.mapDensity ?? DEFAULT_SETTINGS.display.mapDensity,
        celebrationSounds:
          profile?.preferences?.display?.celebrationSounds ?? DEFAULT_SETTINGS.display.celebrationSounds
      }
    };
  }, [profile]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(baselineSettings);
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
  }, [setSaveStatus]);

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
  }, [setSaveStatus]);

  const handleTextScaleChange = useCallback((event, value) => {
    const next = Array.isArray(value) ? value[0] : value;
    setSettings((prev) => ({
      ...prev,
      display: {
        ...prev.display,
        textScale: Math.min(1.4, Math.max(0.8, Number(next) || DEFAULT_SETTINGS.display.textScale))
      }
    }));
  }, []);

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
  }, []);

  const handleMapDensityChange = useCallback((event) => {
    const value = event.target.value;
    setSettings((prev) => ({
      ...prev,
      display: {
        ...prev.display,
        mapDensity: value
      }
    }));
  }, []);

  const handleDmPermissionChange = useCallback((event) => {
    const value = event.target.value;
    setSettings((prev) => ({
      ...prev,
      dmPermission: value
    }));
  }, []);

  const handleDigestFrequencyChange = useCallback((event) => {
    const value = event.target.value;
    setSettings((prev) => ({
      ...prev,
      digestFrequency: value
    }));
  }, []);

  const handleAutoExportRemindersToggle = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      autoExportReminders: !prev.autoExportReminders
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
    if (isOffline) {
      setBlockedOverlayStatus({
        type: 'warning',
        message: 'Reconnect to manage blocked users.'
      });
      return;
    }
    setBlockedOverlayStatus(null);
    setBlockedOverlayOpen(true);
  }, [isOffline]);

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

      if (isOffline) {
        setBlockedOverlayStatus({
          type: 'warning',
          message: 'Reconnect to unblock users.'
        });
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
    [blockedUsers, isOffline]
  );

  const handleReset = useCallback(() => {
    setSettings(baselineSettings);
    setSaveStatus(null);
  }, [baselineSettings]);

  const handleSave = useCallback(async () => {
    if (!authUser || !hasChanges) {
      return;
    }

    if (isOffline) {
      setSaveStatus({ type: 'warning', message: 'You are offline. Connect to save your changes.' });
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
          dmPermission: settings.dmPermission,
          digestFrequency: settings.digestFrequency,
          notifications: {
            proximity: settings.notifications.proximity,
            updates: settings.notifications.updates,
            pinCreated: settings.notifications.pinCreated,
            pinUpdates: settings.notifications.pinUpdates,
            eventReminders: settings.notifications.eventReminders,
            discussionReminders: settings.notifications.discussionReminders,
            bookmarkReminders: settings.notifications.bookmarkReminders,
            chatMessages: settings.notifications.chatMessages,
            marketing: settings.notifications.marketing,
            chatTransitions: settings.notifications.chatTransitions,
            friendRequests: settings.notifications.friendRequests,
            badgeUnlocks: settings.notifications.badgeUnlocks,
            moderationAlerts: settings.notifications.moderationAlerts,
            dmMentions: settings.notifications.dmMentions,
            emailDigests: settings.notifications.emailDigests
          },
          notificationsMutedUntil: settings.notificationsMutedUntil ?? null,
          display: {
            textScale: settings.display.textScale,
            reduceMotion: settings.display.reduceMotion,
            highContrast: settings.display.highContrast,
            mapDensity: settings.display.mapDensity,
            celebrationSounds: settings.display.celebrationSounds
          },
          data: {
            autoExportReminders: settings.autoExportReminders
          }
        },
        locationSharingEnabled: settings.locationSharingEnabled
      };

      const updated = await updateCurrentUserProfile(payload);
      setProfile(updated);
      setSaveStatus({ type: 'success', message: 'Settings saved.' });
    } catch (error) {
      reportClientError(error, 'Failed to update user settings.', {
        source: 'useSettingsManager.saveSettings'
      });
      setSaveStatus({
        type: 'error',
        message: error?.message || 'Failed to update settings.'
      });
    } finally {
      setIsSaving(false);
    }
  }, [authUser, hasChanges, isOffline, settings]);

  const handleSignOut = useCallback(async () => {
    let revokeError = null;
    try {
      await revokeCurrentSession();
    } catch (error) {
      reportClientError(error, 'Failed to revoke server session during sign out.', {
        source: 'useSettingsManager.signOut'
      });
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
      reportClientError(error, 'Failed to complete sign out.', {
        source: 'useSettingsManager.signOut.final'
      });
      setSaveStatus({
        type: 'error',
        message: error?.message || 'Failed to sign out.'
      });
    }
  }, []);

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
