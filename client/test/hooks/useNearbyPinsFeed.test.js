import { renderHook, waitFor } from '@testing-library/react';
import useNearbyPinsFeed from '../../src/hooks/useNearbyPinsFeed';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchPinsNearby: jest.fn().mockResolvedValue([]),
  fetchPinById: jest.fn().mockResolvedValue(null),
  fetchCurrentUserProfile: jest
    .fn()
    .mockResolvedValue({ _id: 'viewer-1', preferences: { display: { listSyncsWithMapLimit: true } } })
}));

const { fetchPinsNearby } = require('../../src/api/mongoDataApi');

describe('useNearbyPinsFeed geolocation gating', () => {
  beforeEach(() => {
    fetchPinsNearby.mockClear();
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
