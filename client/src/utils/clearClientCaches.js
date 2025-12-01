/**
 * Clears service worker registrations and Cache Storage so users pick up new assets
 * after logging out/in without needing a hard refresh.
 */
export default async function clearClientCaches() {
  if (typeof window === 'undefined') {
    return;
  }

  const jobs = [];

  if ('caches' in window) {
    jobs.push(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
  }

  if ('serviceWorker' in navigator) {
    jobs.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    );
  }

  try {
    await Promise.all(jobs);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('clearClientCaches: failed to clear caches or service workers', error);
    }
  }
}
