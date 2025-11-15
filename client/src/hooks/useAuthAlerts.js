import { useEffect, useMemo } from 'react';

export default function useAuthAlerts({
  error,
  message,
  onErrorClear,
  onMessageClear,
  errorAutoHideMs = 3000,
  messageAutoHideMs = 3000,
  errorOverlayClassName,
  errorBoxClassName,
  messageOverlayClassName,
  messageBoxClassName
}) {
  useEffect(() => {
    if (!error || !errorAutoHideMs) {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (typeof onErrorClear === 'function') {
        onErrorClear();
      }
    }, errorAutoHideMs);
    return () => clearTimeout(timer);
  }, [error, errorAutoHideMs, onErrorClear]);

  useEffect(() => {
    if (!message || !messageAutoHideMs) {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (typeof onMessageClear === 'function') {
        onMessageClear();
      }
    }, messageAutoHideMs);
    return () => clearTimeout(timer);
  }, [message, messageAutoHideMs, onMessageClear]);

  return useMemo(() => {
    const list = [];
    if (error) {
      list.push({
        id: 'error',
        type: 'error',
        content: error,
        overlayClassName: errorOverlayClassName,
        boxClassName: errorBoxClassName,
        onClose: () => {
          if (typeof onErrorClear === 'function') {
            onErrorClear();
          }
        }
      });
    }
    if (message) {
      list.push({
        id: 'message',
        type: 'info',
        content: message,
        overlayClassName: messageOverlayClassName,
        boxClassName: messageBoxClassName,
        onClose: () => {
          if (typeof onMessageClear === 'function') {
            onMessageClear();
          }
        }
      });
    }
    return list;
  }, [
    error,
    message,
    errorOverlayClassName,
    errorBoxClassName,
    messageOverlayClassName,
    messageBoxClassName,
    onErrorClear,
    onMessageClear
  ]);
}
