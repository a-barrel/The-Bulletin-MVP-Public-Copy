import { useCallback, useEffect, useState } from 'react';

import { updateCurrentUserProfile } from '../api/mongoDataApi';

const coerceBoolean = (value, fallback = true) =>
  typeof value === 'boolean' ? value : fallback;

export default function useHideFullEventsPreference({
  profileValue,
  disablePersistence = false,
  defaultValue = true
} = {}) {
  const [hideFullEvents, setHideFullEvents] = useState(() =>
    coerceBoolean(profileValue, defaultValue)
  );
  const [lastPersistedValue, setLastPersistedValue] = useState(() =>
    coerceBoolean(profileValue, defaultValue)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof profileValue === 'boolean') {
      setHideFullEvents(profileValue);
      setLastPersistedValue(profileValue);
    }
  }, [profileValue]);

  const persistPreference = useCallback(
    async (nextValue) => {
      setHideFullEvents(nextValue);
      if (disablePersistence) {
        return;
      }
      setIsSaving(true);
      setError(null);
      try {
        await updateCurrentUserProfile({
          preferences: {
            display: {
              hideFullEventsByDefault: nextValue
            }
          }
        });
        setLastPersistedValue(nextValue);
      } catch (err) {
        console.error('Failed to update hide full events preference:', err);
        setHideFullEvents(lastPersistedValue);
        setError(err?.message || 'Failed to update preference.');
      } finally {
        setIsSaving(false);
      }
    },
    [disablePersistence, lastPersistedValue]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    hideFullEvents,
    setHideFullEvents: persistPreference,
    isSavingPreference: isSaving,
    preferenceError: error,
    clearPreferenceError: clearError
  };
}
