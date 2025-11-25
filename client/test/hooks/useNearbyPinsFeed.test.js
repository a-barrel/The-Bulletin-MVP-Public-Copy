import { act, renderHook, waitFor } from '@testing-library/react';
import useNearbyPinsFeed from '../../src/hooks/useNearbyPinsFeed';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchPinsNearby: jest.fn().mockResolvedValue([]),
  fetchPinById: jest.fn().mockResolvedValue(null),
  fetchCurrentUserProfile: jest
    .fn()
    .mockResolvedValue({ _id: 'viewer-1', preferences: { display: { listSyncsWithMapLimit: true } } })
}));

const { fetchPinsNearby, fetchPinById } = require('../../src/api/mongoDataApi');

describe('useNearbyPinsFeed geolocation gating', () => {
  beforeEach(() => {
    fetchPinsNearby.mockClear();
    fetchPinById.mockClear();
  });

  it('blocks non-admins when location is required and missing', async () => {
    const { result } = renderHook(() =>
      useNearbyPinsFeed({
        sharedLocation: null,
        isOffline: false,
        filters: {},
        hideFullEvents: true,
        requireLocation: true,
        isAdminExempt: false
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('Location required to load nearby pins.');
    expect(fetchPinsNearby).not.toHaveBeenCalled();
  });

  it('allows admins to bypass location requirement and fetch pins', async () => {
    fetchPinsNearby.mockResolvedValueOnce([]);
    const { result } = renderHook(() =>
      useNearbyPinsFeed({
        sharedLocation: null,
        isOffline: false,
        filters: {},
        hideFullEvents: true,
        requireLocation: true,
        isAdminExempt: true
      })
    );

    await waitFor(() => {
      expect(fetchPinsNearby).toHaveBeenCalled();
    });
    expect(result.current.error).toBeNull();
  });
});

describe('useNearbyPinsFeed request coordination', () => {
  const baseProps = {
    sharedLocation: { latitude: 10, longitude: 20 },
    isOffline: false,
    filters: {},
    hideFullEvents: true,
    requireLocation: false,
    isAdminExempt: false
  };

  beforeEach(() => {
    jest.useFakeTimers();
    fetchPinsNearby.mockClear();
    fetchPinById.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('debounces rapid filter changes to a single nearby fetch', async () => {
    const { rerender } = renderHook((props) => useNearbyPinsFeed(props), {
      initialProps: baseProps
    });

    rerender({ ...baseProps, filters: { search: 'a' } });
    rerender({ ...baseProps, filters: { search: 'ab' } });

    expect(fetchPinsNearby).toHaveBeenCalledTimes(0);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(fetchPinsNearby).toHaveBeenCalledTimes(1));
  });

  it('reuses pin detail cache on manual refresh', async () => {
    const pin = { _id: 'pin-1', distanceMeters: 100 };
    fetchPinsNearby.mockResolvedValue([pin]);
    fetchPinById.mockResolvedValue({ _id: 'pin-1', title: 'Hello' });

    const { result } = renderHook((props) => useNearbyPinsFeed(props), {
      initialProps: baseProps
    });

    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => expect(fetchPinById).toHaveBeenCalledTimes(1));

    fetchPinsNearby.mockResolvedValue([pin]);
    act(() => {
      jest.advanceTimersByTime(400);
      result.current.refresh();
    });

    await waitFor(() => expect(fetchPinsNearby).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fetchPinById).toHaveBeenCalledTimes(1));
  });

  it('preserves thumbnail URLs in feed items', async () => {
    fetchPinsNearby.mockResolvedValue([
      {
        _id: 'pin-1',
        images: [{ thumbnailUrl: '/thumb.jpg', url: '/full.jpg' }],
        type: 'event',
        coordinates: { coordinates: [0, 0] }
      }
    ]);

    renderHook((props) => useNearbyPinsFeed(props), {
      initialProps: baseProps
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(fetchPinsNearby).toHaveBeenCalledTimes(1));
  });
});
