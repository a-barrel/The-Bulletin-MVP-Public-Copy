import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

import { app } from './firebase';
import runtimeConfig from './config/runtime';

let messagingInstance = null;

const ensureMessaging = async () => {
  if (!(await isSupported())) {
    return null;
  }
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
};

export async function registerMessagingServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
  if (!registration) {
    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
  }

  await navigator.serviceWorker.ready;

  const sendConfig = () => {
    const controller =
      navigator.serviceWorker.controller || registration.active || registration.installing;
    if (controller) {
      controller.postMessage({
        type: 'FIREBASE_INIT',
        config: runtimeConfig.firebase.config
      });
    }
  };

  sendConfig();

  return registration;
}

export async function requestPushToken() {
  const messaging = await ensureMessaging();
  if (!messaging) {
    throw new Error('Push messaging is not supported in this browser.');
  }

  const vapidKey = runtimeConfig.firebase.vapidKey;
  if (!vapidKey) {
    throw new Error('Missing Firebase VAPID key configuration.');
  }

  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error('Failed to retrieve push token.');
  }

  return token;
}

export async function onForegroundMessage(callback) {
  const messaging = await ensureMessaging();
  if (!messaging) {
    return () => {};
  }
  return onMessage(messaging, callback);
}

