import { act, renderHook } from '@testing-library/react';

import { NetworkStatusProvider, useNetworkStatusContext } from '../../src/contexts/NetworkStatusContext';

jest.mock('../../src/hooks/useNetworkStatus', () => ({
  __esModule: true,
  default: jest.fn()
}));

const useNetworkStatusMock = require('../../src/hooks/useNetworkStatus').default;

const wrapper = ({ children }) => <NetworkStatusProvider>{children}</NetworkStatusProvider>;

describe('NetworkStatusContext', () => {
  beforeEach(() => {
    useNetworkStatusMock.mockReturnValue({ isOnline: true, isOffline: false });
    window.localStorage.clear();
  });

  it('exposes override controls and persists selection', () => {
    const { result } = renderHook(() => useNetworkStatusContext(), { wrapper });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);

    act(() => {
      result.current.setNetworkOverride('offline');
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.overrideMode).toBe('offline');
    expect(window.localStorage.getItem('pinpoint:network-override')).toBe('offline');

    act(() => {
      result.current.clearNetworkOverride();
    });

    expect(result.current.overrideMode).toBeNull();
    expect(result.current.isOnline).toBe(true);
    expect(window.localStorage.getItem('pinpoint:network-override')).toBeNull();
  });

  it('hydrates override mode from localStorage', () => {
    window.localStorage.setItem('pinpoint:network-override', 'offline');

    const { result } = renderHook(() => useNetworkStatusContext(), { wrapper });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.overrideMode).toBe('offline');
    expect(result.current.isOverrideEnabled).toBe(true);
  });
});
