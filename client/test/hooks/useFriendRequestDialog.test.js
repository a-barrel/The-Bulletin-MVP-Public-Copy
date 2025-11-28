import { act, renderHook } from '@testing-library/react';
import useFriendRequestDialog from '../../src/hooks/useFriendRequestDialog';

describe('useFriendRequestDialog', () => {
  it('opens and closes the dialog', () => {
    const respondToFriendRequest = jest.fn();
    const { result } = renderHook(() =>
      useFriendRequestDialog({ respondToFriendRequest, refreshFriendGraph: jest.fn(), refreshNotifications: jest.fn() })
    );

    act(() => {
      result.current.openFriendDialog();
    });
    expect(result.current.isFriendDialogOpen).toBe(true);

    act(() => {
      result.current.closeFriendDialog();
    });
    expect(result.current.isFriendDialogOpen).toBe(false);
  });

  it('responds to friend requests and updates status', async () => {
    const respondToFriendRequest = jest.fn().mockResolvedValue({});
    const refreshFriendGraph = jest.fn().mockResolvedValue({});
    const refreshNotifications = jest.fn().mockResolvedValue({});
    const { result } = renderHook(() =>
      useFriendRequestDialog({ respondToFriendRequest, refreshFriendGraph, refreshNotifications })
    );

    await act(async () => {
      await result.current.handleRespondToFriendRequest('req-1', 'accept');
    });

    expect(respondToFriendRequest).toHaveBeenCalledWith({ requestId: 'req-1', decision: 'accept' });
    expect(refreshFriendGraph).toHaveBeenCalled();
    expect(refreshNotifications).toHaveBeenCalled();
    expect(result.current.friendActionStatus?.type).toBe('success');
    expect(result.current.respondingRequestId).toBe(null);
  });
});
