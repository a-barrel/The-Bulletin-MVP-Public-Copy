const BLOCKED_HOSTS = ['sentry.io', 'intercom.io', 'statsigapi.net'];

const parseUrl = (input) => {
  try {
    if (input instanceof Request) {
      return new URL(input.url);
    }
    return new URL(String(input), window.location.origin);
  } catch (_) {
    return null;
  }
};

const shouldBlock = (input) => {
  const parsed = parseUrl(input);
  if (!parsed) {
    return false;
  }
  return BLOCKED_HOSTS.some((host) => parsed.hostname.includes(host));
};

const noopResponse = new Response('', {
  status: 204,
  statusText: 'suppressed by Pinpoint telemetry guard',
  headers: {
    'X-Suppressed-Telemetry': 'true'
  }
});

export const installTelemetryGuards = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.__PINPOINT_TELEMETRY_GUARD_INSTALLED__) {
    return;
  }
  window.__PINPOINT_TELEMETRY_GUARD_INSTALLED__ = true;

  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      if (shouldBlock(args[0])) {
        return noopResponse.clone();
      }
      return originalFetch(...args);
    };
  }

  if (typeof window.navigator?.sendBeacon === 'function') {
    const originalSendBeacon = window.navigator.sendBeacon.bind(window.navigator);
    window.navigator.sendBeacon = (url, data) => {
      if (shouldBlock(url)) {
        return true;
      }
      return originalSendBeacon(url, data);
    };
  }

  if (typeof window.XMLHttpRequest !== 'undefined') {
    const OriginalXHR = window.XMLHttpRequest;
    function GuardedXHR() {
      const xhr = new OriginalXHR();
      let targetUrl = null;
      const originalOpen = xhr.open.bind(xhr);
      const originalSend = xhr.send.bind(xhr);

      xhr.open = function open(method, url, ...rest) {
        targetUrl = url;
        return originalOpen(method, url, ...rest);
      };

      xhr.send = function send(body) {
        if (shouldBlock(targetUrl)) {
          setTimeout(() => {
            if (typeof xhr.onreadystatechange === 'function') {
              xhr.readyState = 4;
              xhr.status = 204;
              xhr.onreadystatechange();
            }
          }, 0);
          return;
        }
        return originalSend(body);
      };

      return xhr;
    }
    GuardedXHR.prototype = OriginalXHR.prototype;
    window.XMLHttpRequest = GuardedXHR;
  }

  if (typeof Element !== 'undefined' && typeof Element.prototype.setCapture === 'function') {
    let lastPointerId = null;
    window.addEventListener(
      'pointerdown',
      (event) => {
        lastPointerId = event.pointerId;
      },
      true
    );

    Element.prototype.setCapture = function setCapture() {
      if (typeof this.setPointerCapture === 'function' && lastPointerId !== null) {
        try {
          this.setPointerCapture(lastPointerId);
          return;
        } catch (_) {
          // fall back to no-op
        }
      }
    };

    if (typeof Element.prototype.releaseCapture === 'function') {
      Element.prototype.releaseCapture = function releaseCapture() {
        if (typeof this.releasePointerCapture === 'function' && lastPointerId !== null) {
          try {
            this.releasePointerCapture(lastPointerId);
            return;
          } catch (_) {
            // fall back to no-op
          }
        }
      };
    }
  }
};

export default installTelemetryGuards;
