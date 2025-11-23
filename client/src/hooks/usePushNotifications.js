import { useCallback, useMemo, useState } from 'react';

import { registerPushToken } from '../api/mongoDataApi';
import { registerMessagingServiceWorker, requestPushToken } from '../firebaseMessaging';
import usePushPromptDismissal from './usePushPromptDismissal';

export default function usePushNotifications() {
  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator;

  const [status, setStatus] = useState(null);
  const [isEnabling, setIsEnabling] = useState(false);

  const permission = useMemo(() => {
    if (!isSupported) {
      return 'unsupported';
    }
    return Notification.permission;
  }, [isSupported]);

  const [promptDismissed, dismissPrompt] = usePushPromptDismissal(
    'pinpoint:pushPromptDismissed',
    permission
  );

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
      dismissPrompt();
      return token;
    } catch (error) {
      const message = error?.message || 'Failed to enable notifications.';
      setStatus({ type: 'error', message });
      throw error;
    } finally {
      setIsEnabling(false);
    }
  }, [dismissPrompt, isSupported, permission]);

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
