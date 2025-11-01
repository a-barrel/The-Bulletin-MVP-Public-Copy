import { act, renderHook, waitFor } from '@testing-library/react';

import useFriendGraph from '../../src/hooks/useFriendGraph';

const mockApi = {
  fetchFriendOverview: jest.fn(),
  sendFriendRequest: jest.fn(),
  respondToFriendRequest: jest.fn(),
  removeFriendRelationship: jest.fn()
};

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchFriendOverview: (...args) => mockApi.fetchFriendOverview(...args),
  sendFriendRequest: (...args) => mockApi.sendFriendRequest(...args),
  respondToFriendRequest: (...args) => mockApi.respondToFriendRequest(...args),
  removeFriendRelationship: (...args) => mockApi.removeFriendRelationship(...args)
}));

describe('useFriendGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.fetchFriendOverview.mockResolvedValue({
      viewer: { id: 'viewer-1' },
      friends: [],
      incomingRequests: [],
      outgoingRequests: []
    });
    mockApi.sendFriendRequest.mockResolvedValue({ request: { id: 'req-1' } });
    mockApi.respondToFriendRequest.mockResolvedValue({ request: { id: 'req-1' } });
    mockApi.removeFriendRelationship.mockResolvedValue({ removed: { id: 'friend-1' } });
  });

  it('sends friend requests and refreshes the graph', async () => {
    const { result } = renderHook(() => useFriendGraph({ autoLoad: true }));

    await waitFor(() => expect(mockApi.fetchFriendOverview).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.sendFriendRequest({ targetUserId: 'user-2', message: 'Hey there' });
    });

    expect(mockApi.sendFriendRequest).toHaveBeenCalledWith({
      targetUserId: 'user-2',
      message: 'Hey there'
    });
    await waitFor(() => expect(result.current.requestStatus?.type).toBe('success'));
  });

  it('surfaces errors when removing a friend fails', async () => {
    mockApi.removeFriendRelationship.mockRejectedValueOnce(new Error('cannot remove'));
    const { result } = renderHook(() => useFriendGraph({ autoLoad: false }));

    let captured;
    await act(async () => {
      try {
        await result.current.removeFriend('friend-1');
      } catch (error) {
        captured = error;
      }
    });

    expect(captured).toEqual(expect.any(Error));
    await waitFor(() => expect(result.current.queueStatus?.type).toBe('error'));
  });
});
