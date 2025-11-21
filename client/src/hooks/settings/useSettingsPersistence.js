import { useCallback, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  revokeCurrentSession,
  updateCurrentUserProfile
} from '../../api/mongoDataApi';
import reportClientError from '../../utils/reportClientError';
import { auth } from '../../firebase';
import { DEFAULT_SETTINGS } from '../useSettingsManager';

export default function useSettingsPersistence({
  authUser,
  settings,
  hasChanges,
  isOffline,
  setProfile
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const handleSave = useCallback(async () => {
    if (!authUser) {
      setSaveStatus({ type: 'error', message: 'Sign in to update settings.' });
      return;
    }
    if (isOffline) {
      setSaveStatus({ type: 'error', message: 'Reconnect to save your settings.' });
      return;
    }
    if (!hasChanges) {
      setSaveStatus({ type: 'info', message: 'No changes to save.' });
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
          notifications: { ...(settings.notifications || DEFAULT_SETTINGS.notifications) },
          notificationsVerbosity: {
            ...(settings.notificationsVerbosity || DEFAULT_SETTINGS.notificationsVerbosity)
          },
          notificationsMutedUntil: settings.notificationsMutedUntil ?? null,
          display: { ...settings.display },
          data: {
            autoExportReminders: settings.autoExportReminders
          }
        }
      };

      const updated = await updateCurrentUserProfile(payload);
      setProfile(updated);
      setSaveStatus({ type: 'success', message: 'Settings saved.' });
    } catch (error) {
      reportClientError(error, 'Failed to update user settings.', {
        source: 'useSettingsPersistence.save'
      });
      setSaveStatus({
        type: 'error',
        message: error?.message || 'Failed to update settings.'
      });
    } finally {
      setIsSaving(false);
    }
  }, [authUser, hasChanges, isOffline, setProfile, settings]);

  const handleSignOut = useCallback(async () => {
    let revokeError = null;
    try {
      await revokeCurrentSession();
    } catch (error) {
      reportClientError(error, 'Failed to revoke server session during sign out.', {
        source: 'useSettingsPersistence.signOut'
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
        source: 'useSettingsPersistence.signOut.final'
      });
      setSaveStatus({
        type: 'error',
        message: error?.message || 'Failed to sign out.'
      });
    }
  }, []);

  return {
    isSaving,
    saveStatus,
    setSaveStatus,
    handleSave,
    handleSignOut
  };
}
