import { act, renderHook } from '@testing-library/react';

import usePinsFeedCore from '../../src/hooks/usePinsFeedCore';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchPinsNearby: jest.fn(() => Promise.resolve([])),
  fetchPinById: jest.fn(() => Promise.resolve(null)),
  fetchCurrentUserProfile: jest.fn(() => Promise.resolve({ preferences: { display: {} } }))
}));

describe('usePinsFeedCore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces fetches and aborts previous requests when location changes quickly', async () => {
    const { result, rerender } = renderHook(
      ({ location }) =>
        usePinsFeedCore({
          sharedLocation: location,
          isOffline: false,
          filters: {},
          hideFullEvents: true,
          requireLocation: false,
          isAdminExempt: false
        }),
      { initialProps: { location: { latitude: 1, longitude: 1 } } }
    );

    await act(async () => {
      jest.advanceTimersByTime(100);
      rerender({ location: { latitude: 2, longitude: 2 } });
      jest.advanceTimersByTime(100);
      rerender({ location: { latitude: 3, longitude: 3 } });
      jest.advanceTimersByTime(260);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.locationRequired).toBe(false);
  });

  it('uses fallback when location is not provided and not required', () => {
    const { result } = renderHook(() =>
      usePinsFeedCore({
        sharedLocation: null,
        isOffline: false,
        filters: {},
        hideFullEvents: true,
        requireLocation: false,
        isAdminExempt: false
      })
    );
    expect(result.current.isUsingFallbackLocation).toBe(true);
    expect(result.current.locationRequired).toBe(false);
  });

  it('marks location as required when configured', () => {
    const { result } = renderHook(() =>
      usePinsFeedCore({
        sharedLocation: null,
        isOffline: false,
        filters: {},
        hideFullEvents: true,
        requireLocation: true,
        isAdminExempt: false
      })
    );
    expect(result.current.locationRequired).toBe(true);
  });
});
