/* global firebase */

let firebaseInitialized = false;

const initializeFirebase = (config) => {
  if (firebaseInitialized) {
    return firebase.messaging();
  }
  importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');
  firebase.initializeApp(config);
  firebaseInitialized = true;
  return firebase.messaging();
};

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'FIREBASE_INIT') {
    return;
  }
  initializeFirebase(event.data.config);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let messaging;
  if (firebaseInitialized) {
    messaging = firebase.messaging();
  }

  const payload = event.data.json();

  const title = payload.notification?.title || 'Pinpoint';
  const options = {
    body: payload.notification?.body,
    icon: payload.notification?.icon || '/icons/icon-192.png',
    badge: payload.notification?.badge,
    data: payload.data || {}
  };

  if (messaging) {
    messaging.onBackgroundMessage(() => {});
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

