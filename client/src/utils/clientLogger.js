import { logClientEvent } from '../api';

let listenersInstalled = false;

const toError = (value) => {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  return new Error(value ? JSON.stringify(value) : 'Unknown client error');
};

export async function logClientError(error, context = {}, overrides = {}) {
  try {
    const normalized = toError(error);
    await logClientEvent({
      category: overrides.category ?? 'client-errors',
      severity: overrides.severity ?? 'error',
      message: normalized.message,
      stack: normalized.stack,
      context
    });
  } catch (logError) {
    if (import.meta.env.DEV) {
      console.warn('Failed to send client log event', logError);
    }
  }
}

export function installClientErrorListeners() {
  if (typeof window === 'undefined' || listenersInstalled) {
    return;
  }

  const handleError = (event) => {
    logClientError(event.error || event.message || 'Client error event', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: 'window.error'
    });
  };

  const handleRejection = (event) => {
    const reasonError = toError(event.reason);
    logClientError(reasonError, {
      type: 'unhandledrejection'
    });
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  listenersInstalled = true;
}
