import { useCallback, useMemo, useState } from 'react';

import { registerPushToken } from '../api/mongoDataApi';
import { registerMessagingServiceWorker, requestPushToken } from '../firebaseMessaging';

const PUSH_PROMPT_DISMISS_KEY = 'pinpoint:pushPromptDismissed';

const getInitialDismissedState = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(PUSH_PROMPT_DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
};

export default function usePushNotifications() {
  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator;

  const [status, setStatus] = useState(null);
  const [isEnabling, setIsEnabling] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(getInitialDismissedState);

  const permission = useMemo(() => {
    if (!isSupported) {
      return 'unsupported';
    }
    return Notification.permission;
  }, [isSupported]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Push notifications are not supported in this browser.');
    }

    if (permission === 'denied') {
      throw new Error('Notifications are blocked in browser settings.');
    }

    setIsEnabling(true);
    setStatus(null);

    try {
      await registerMessagingServiceWorker();

      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        throw new Error('Notification permission not granted.');
      }

      const token = await requestPushToken();
      await registerPushToken(token, { platform: 'web' });
      setStatus({ type: 'success', message: 'Push notifications enabled.' });
      try {
        window.localStorage.setItem(PUSH_PROMPT_DISMISS_KEY, 'true');
      } catch {
        // ignore storage errors
      }
      setPromptDismissed(true);
      return token;
    } catch (error) {
      const message = error?.message || 'Failed to enable notifications.';
      setStatus({ type: 'error', message });
      throw error;
    } finally {
      setIsEnabling(false);
    }
  }, [isSupported, permission]);

  const dismissPrompt = useCallback(() => {
    setPromptDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(PUSH_PROMPT_DISMISS_KEY, 'true');
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    isSupported,
    permission,
    isEnabling,
    status,
    setStatus,
    requestPermission,
    promptDismissed,
    dismissPrompt
  };
}

