import { act, renderHook } from '@testing-library/react';

import usePushNotifications from '../usePushNotifications';

jest.mock('../../firebaseMessaging', () => ({
  registerMessagingServiceWorker: jest.fn(),
  requestPushToken: jest.fn()
}));

jest.mock('../../api/mongoDataApi', () => ({
  registerPushToken: jest.fn()
}));

const messaging = require('../../firebaseMessaging');
const api = require('../../api/mongoDataApi');

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {});
    jest.spyOn(window.localStorage.__proto__, 'getItem').mockReturnValue(null);
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {},
      configurable: true
    });

    global.Notification = {
      permission: 'default',
      requestPermission: jest.fn()
    };

    messaging.registerMessagingServiceWorker.mockResolvedValue(undefined);
    messaging.requestPushToken.mockResolvedValue('push-token');
    api.registerPushToken.mockResolvedValue({ token: 'push-token' });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    delete global.navigator.serviceWorker;
  });

  it('enables push notifications when permission granted', async () => {
    global.Notification.requestPermission.mockResolvedValue('granted');

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(messaging.registerMessagingServiceWorker).toHaveBeenCalled();
    expect(messaging.requestPushToken).toHaveBeenCalled();
    expect(api.registerPushToken).toHaveBeenCalledWith('push-token', { platform: 'web' });
    expect(result.current.status).toMatchObject({ type: 'success' });
    expect(window.localStorage.setItem).toHaveBeenCalledWith('pinpoint:pushPromptDismissed', 'true');
  });

  it('throws when permission is denied', async () => {
    global.Notification.requestPermission.mockResolvedValue('denied');

    const { result } = renderHook(() => usePushNotifications());

    await expect(
      act(async () => {
        await result.current.requestPermission();
      })
    ).rejects.toThrow('Notification permission not granted');

    expect(api.registerPushToken).not.toHaveBeenCalled();
  });

  it('marks the prompt as dismissed when dismissPrompt is called', () => {
    const { result } = renderHook(() => usePushNotifications());

    act(() => {
      result.current.dismissPrompt();
    });

    expect(result.current.promptDismissed).toBe(true);
    expect(window.localStorage.setItem).toHaveBeenCalledWith('pinpoint:pushPromptDismissed', 'true');
  });
});
