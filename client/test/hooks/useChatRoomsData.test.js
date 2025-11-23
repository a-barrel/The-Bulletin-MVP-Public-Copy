import { renderHook, waitFor } from '@testing-library/react';
import useChatRoomsData from '../../src/hooks/chat/useChatRoomsData';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchChatRooms: jest.fn(),
  createChatRoom: jest.fn()
}));

const { fetchChatRooms, createChatRoom } = require('../../src/api/mongoDataApi');

describe('useChatRoomsData', () => {
  beforeEach(() => {
    fetchChatRooms.mockReset();
    createChatRoom.mockReset();
  });

  it('selects existing pin room without creating a new one', async () => {
    fetchChatRooms.mockResolvedValueOnce([{ _id: 'pin-1', pinId: 'pin-1', name: 'Pin room' }]);

    const { result } = renderHook(() =>
      useChatRoomsData({
        authUser: { uid: 'user-1' },
        authLoading: false,
        viewerLatitude: null,
        viewerLongitude: null,
        pinId: 'pin-1'
      })
    );

    await waitFor(() => expect(result.current.rooms.length).toBe(1));
    expect(result.current.selectedRoomId).toBe('pin-1');
    expect(createChatRoom).not.toHaveBeenCalled();
  });

  it('creates pin room when none exist for pinId', async () => {
    fetchChatRooms.mockResolvedValueOnce([]);
    createChatRoom.mockResolvedValueOnce({ _id: 'pin-2', pinId: 'pin-2', name: 'Pin room' });

    const { result } = renderHook(() =>
      useChatRoomsData({
        authUser: { uid: 'user-1' },
        authLoading: false,
        viewerLatitude: null,
        viewerLongitude: null,
        pinId: 'pin-2'
      })
    );

    await waitFor(() => expect(result.current.rooms.length).toBe(1));
    expect(result.current.selectedRoomId).toBe('pin-2');
    expect(createChatRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        pinId: 'pin-2',
        name: expect.stringContaining('Pin')
      })
    );
  });

  it('falls back to first room when no pinId is provided', async () => {
    fetchChatRooms.mockResolvedValueOnce([
      { _id: 'room-a', name: 'Room A' },
      { _id: 'room-b', name: 'Room B' }
    ]);

    const { result } = renderHook(() =>
      useChatRoomsData({
        authUser: { uid: 'user-1' },
        authLoading: false,
        viewerLatitude: null,
        viewerLongitude: null,
        pinId: null
      })
    );

    await waitFor(() => expect(result.current.selectedRoomId).toBe('room-a'));
    expect(createChatRoom).not.toHaveBeenCalled();
  });

  it('surfaces expired message on 404/410', async () => {
    const expiredError = new Error('Not found');
    expiredError.status = 404;
    fetchChatRooms.mockRejectedValueOnce(expiredError);

    const { result } = renderHook(() =>
      useChatRoomsData({
        authUser: { uid: 'user-1' },
        authLoading: false,
        viewerLatitude: null,
        viewerLongitude: null,
        pinId: 'pin-expired'
      })
    );

    await waitFor(() => expect(result.current.roomsError).toMatch(/expired/i));
    expect(result.current.selectedRoomId).toBe(null);
  });
});
