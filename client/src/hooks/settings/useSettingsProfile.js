import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUserProfile } from '../../api/mongoDataApi';
import reportClientError from '../../utils/reportClientError';
import { DEFAULT_SETTINGS, roundRadius } from '../useSettingsManager';

const hydrateSettingsFromProfile = (result) => ({
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
    proximity: result?.preferences?.notifications?.proximity ?? DEFAULT_SETTINGS.notifications.proximity,
    updates: result?.preferences?.notifications?.updates ?? DEFAULT_SETTINGS.notifications.updates,
    pinCreated: result?.preferences?.notifications?.pinCreated ?? DEFAULT_SETTINGS.notifications.pinCreated,
    pinUpdates: result?.preferences?.notifications?.pinUpdates ?? DEFAULT_SETTINGS.notifications.pinUpdates,
    eventReminders: result?.preferences?.notifications?.eventReminders ?? DEFAULT_SETTINGS.notifications.eventReminders,
    discussionReminders: result?.preferences?.notifications?.discussionReminders ?? DEFAULT_SETTINGS.notifications.discussionReminders,
    bookmarkReminders: result?.preferences?.notifications?.bookmarkReminders ?? DEFAULT_SETTINGS.notifications.bookmarkReminders,
    chatMessages: result?.preferences?.notifications?.chatMessages ?? DEFAULT_SETTINGS.notifications.chatMessages,
    marketing: result?.preferences?.notifications?.marketing ?? DEFAULT_SETTINGS.notifications.marketing,
    chatTransitions: result?.preferences?.notifications?.chatTransitions ?? DEFAULT_SETTINGS.notifications.chatTransitions,
    friendRequests: result?.preferences?.notifications?.friendRequests ?? DEFAULT_SETTINGS.notifications.friendRequests,
    badgeUnlocks: result?.preferences?.notifications?.badgeUnlocks ?? DEFAULT_SETTINGS.notifications.badgeUnlocks,
    moderationAlerts: result?.preferences?.notifications?.moderationAlerts ?? DEFAULT_SETTINGS.notifications.moderationAlerts,
    dmMentions: result?.preferences?.notifications?.dmMentions ?? DEFAULT_SETTINGS.notifications.dmMentions,
    emailDigests: result?.preferences?.notifications?.emailDigests ?? DEFAULT_SETTINGS.notifications.emailDigests
  },
  display: {
    textScale: result?.preferences?.display?.textScale ?? DEFAULT_SETTINGS.display.textScale,
    reduceMotion: result?.preferences?.display?.reduceMotion ?? DEFAULT_SETTINGS.display.reduceMotion,
    highContrast: result?.preferences?.display?.highContrast ?? DEFAULT_SETTINGS.display.highContrast,
    mapDensity: result?.preferences?.display?.mapDensity ?? DEFAULT_SETTINGS.display.mapDensity,
    celebrationSounds:
      result?.preferences?.display?.celebrationSounds ?? DEFAULT_SETTINGS.display.celebrationSounds,
    showFriendBadges:
      result?.preferences?.display?.showFriendBadges ?? DEFAULT_SETTINGS.display.showFriendBadges,
    listSyncsWithMapLimit:
      result?.preferences?.display?.listSyncsWithMapLimit ?? DEFAULT_SETTINGS.display.listSyncsWithMapLimit
  }
});

export default function useSettingsProfile({ authUser, authLoading, isOffline }) {
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [profileError, setProfileError] = useState(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  const loadProfile = useCallback(async () => {
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

    const fetchProfile = async () => {
      setIsFetchingProfile(true);
      setProfileError(null);
      try {
        const result = await fetchCurrentUserProfile();
        if (cancelled) {
          return;
        }
        setProfile(result);
        setSettings(hydrateSettingsFromProfile(result));
      } catch (error) {
        reportClientError(error, 'Failed to load settings profile.', {
          source: 'useSettingsProfile'
        });
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

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authUser, isOffline]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const baselineSettings = useMemo(() => {
    if (!profile) {
      return DEFAULT_SETTINGS;
    }
    return hydrateSettingsFromProfile(profile);
  }, [profile]);

  const hasChanges = useMemo(() => JSON.stringify(settings) !== JSON.stringify(baselineSettings), [baselineSettings, settings]);

  return {
    profile,
    setProfile,
    settings,
    setSettings,
    profileError,
    isFetchingProfile,
    baselineSettings,
    hasChanges,
    reloadProfile: loadProfile
  };
}
