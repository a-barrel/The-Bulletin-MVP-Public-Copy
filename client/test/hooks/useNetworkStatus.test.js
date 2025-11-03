import { act, renderHook } from '@testing-library/react';

import useNetworkStatus from '../../src/hooks/useNetworkStatus';

describe('useNetworkStatus', () => {
  const originalNavigatorOnline = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

  afterEach(() => {
    if (originalNavigatorOnline) {
      Object.defineProperty(window.navigator, 'onLine', originalNavigatorOnline);
    } else {
      Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    }
  });

  it('initializes with the navigator online state', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('responds to online and offline events', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });
});
