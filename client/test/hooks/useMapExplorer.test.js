import { act, renderHook, waitFor } from '@testing-library/react';

import useMapExplorer, { SPOOF_MAX_MILES } from '../../src/hooks/useMapExplorer';

const mockApi = {
  fetchPinsNearby: jest.fn(),
  fetchNearbyUsers: jest.fn(),
  fetchChatRooms: jest.fn(),
  insertLocationUpdate: jest.fn(),
  fetchCurrentUserProfile: jest.fn()
};

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchPinsNearby: (...args) => mockApi.fetchPinsNearby(...args),
  fetchNearbyUsers: (...args) => mockApi.fetchNearbyUsers(...args),
  fetchChatRooms: (...args) => mockApi.fetchChatRooms(...args),
  insertLocationUpdate: (...args) => mockApi.insertLocationUpdate(...args),
  fetchCurrentUserProfile: (...args) => mockApi.fetchCurrentUserProfile(...args)
}));

jest.mock('react-firebase-hooks/auth', () => ({
  useAuthState: jest.fn(() => [null, false])
}));

describe('useMapExplorer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.fetchPinsNearby.mockResolvedValue([]);
    mockApi.fetchNearbyUsers.mockResolvedValue([]);
    mockApi.fetchChatRooms.mockResolvedValue([]);
    mockApi.insertLocationUpdate.mockResolvedValue({});
    mockApi.fetchCurrentUserProfile.mockResolvedValue({ _id: 'viewer-1' });
  });

  it('limits spoof moves that exceed the allowed radius', async () => {
    const sharedLocation = { latitude: 33.8, longitude: -118.1 };
    const setSharedLocation = jest.fn();

    let renderResult;
    await act(async () => {
      renderResult = renderHook(() =>
        useMapExplorer({
          sharedLocation,
          setSharedLocation,
          isOffline: false
        })
      );
    });
    const { result } = renderResult;

    await waitFor(() => expect(mockApi.fetchPinsNearby).toHaveBeenCalled());

    await act(async () => {
      result.current.setSpoofStepMiles(SPOOF_MAX_MILES * 10);
    });

    await waitFor(() => {
      expect(result.current.spoofStepMiles).toBeCloseTo(SPOOF_MAX_MILES * 10);
    });

    await act(async () => {
      result.current.handleSpoofMove('north');
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toEqual(expect.stringMatching(/Spoofing limited/i));
  });
});
