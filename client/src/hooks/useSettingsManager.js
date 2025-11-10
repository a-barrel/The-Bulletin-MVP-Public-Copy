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
  notifications: {
    proximity: true,
    updates: true,
    marketing: false,
    chatTransitions: true
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
          notifications: {
            proximity:
              result?.preferences?.notifications?.proximity ?? DEFAULT_SETTINGS.notifications.proximity,
            updates:
              result?.preferences?.notifications?.updates ?? DEFAULT_SETTINGS.notifications.updates,
            marketing:
              result?.preferences?.notifications?.marketing ?? DEFAULT_SETTINGS.notifications.marketing,
            chatTransitions:
              result?.preferences?.notifications?.chatTransitions ??
              DEFAULT_SETTINGS.notifications.chatTransitions
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
      notifications: {
        proximity:
          profile?.preferences?.notifications?.proximity ?? DEFAULT_SETTINGS.notifications.proximity,
        updates:
          profile?.preferences?.notifications?.updates ?? DEFAULT_SETTINGS.notifications.updates,
        marketing:
          profile?.preferences?.notifications?.marketing ?? DEFAULT_SETTINGS.notifications.marketing,
        chatTransitions:
          profile?.preferences?.notifications?.chatTransitions ??
          DEFAULT_SETTINGS.notifications.chatTransitions
      }
    };
  }, [profile]);

  const hasChanges = useMemo(
    () =>
      settings.theme !== baselineSettings.theme ||
      settings.locationSharingEnabled !== baselineSettings.locationSharingEnabled ||
      settings.radiusPreferenceMeters !== baselineSettings.radiusPreferenceMeters ||
      settings.filterCussWords !== baselineSettings.filterCussWords ||
      settings.statsPublic !== baselineSettings.statsPublic ||
      settings.notifications.proximity !== baselineSettings.notifications.proximity ||
      settings.notifications.updates !== baselineSettings.notifications.updates ||
      settings.notifications.marketing !== baselineSettings.notifications.marketing ||
      settings.notifications.chatTransitions !== baselineSettings.notifications.chatTransitions,
    [baselineSettings, settings]
  );

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
          notifications: {
            proximity: settings.notifications.proximity,
            updates: settings.notifications.updates,
            marketing: settings.notifications.marketing,
            chatTransitions: settings.notifications.chatTransitions
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
    handleLocationSharingToggle,
    handleStatsVisibilityToggle,
    handleFilterCussWordsToggle,
    handleOpenBlockedOverlay,
    handleCloseBlockedOverlay,
    handleUnblockUser,
    handleReset,
    handleSave,
    handleSignOut
  };
}
