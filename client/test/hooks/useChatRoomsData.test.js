import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';

import useChatRoomsData from '../../src/hooks/chat/useChatRoomsData';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchChatRooms: jest.fn().mockResolvedValue([]),
  createChatRoom: jest.fn().mockResolvedValue(null)
}));

const { fetchChatRooms, createChatRoom } = jest.requireMock('../../src/api/mongoDataApi');

function TestHarness({ onReady, pinId = null }) {
  const hook = useChatRoomsData({
    authUser: { uid: 'user-1' },
    authLoading: false,
    viewerLatitude: 10,
    viewerLongitude: 20,
    pinId
  });

  useEffect(() => {
    onReady(hook);
  }, [hook, onReady]);

  return null;
}

describe('useChatRoomsData', () => {
  beforeEach(() => {
    fetchChatRooms.mockClear();
    createChatRoom.mockClear();
  });

  it('does not issue overlapping room fetches', async () => {
    let resolveCall;
    fetchChatRooms.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        })
    );

    let loadRooms;
    render(
      <TestHarness
        onReady={(hook) => {
          loadRooms = hook.loadRooms;
        }}
      />
    );

    await act(async () => {
      const first = loadRooms();
      const second = loadRooms();
      resolveCall([]);
      await Promise.all([first, second]);
    });

    expect(fetchChatRooms).toHaveBeenCalledTimes(1);
  });

  it('selects pin room by id and exposes selectedRoom', async () => {
    fetchChatRooms.mockResolvedValue([
      { _id: 'room-1', pinId: 'pin-123' },
      { _id: 'room-2' }
    ]);

    let hookResult;
    render(
      <TestHarness
        onReady={(hook) => {
          hookResult = hook;
        }}
        pinId="pin-123"
      />
    );

    await act(async () => {
      await hookResult.loadRooms();
    });

    expect(hookResult.selectedRoomId).toBe('room-1');
    expect(hookResult.selectedRoom?._id).toBe('room-1');
  });

  it('creates pin room once when missing and sets selection', async () => {
    fetchChatRooms.mockResolvedValue([]);
    createChatRoom.mockResolvedValue({ _id: 'new-room', pinId: 'pin-999' });

    let hookResult;
    render(
      <TestHarness
        onReady={(hook) => {
          hookResult = hook;
        }}
        pinId="pin-999"
      />
    );

    await act(async () => {
      await hookResult.loadRooms();
    });

    expect(createChatRoom).toHaveBeenCalledTimes(1);
    expect(hookResult.selectedRoomId).toBe('new-room');
    expect(hookResult.selectedRoom?._id).toBe('new-room');
  });

  it('updates selectedRoom when selecting another room', async () => {
    fetchChatRooms.mockResolvedValue([
      { _id: 'room-1' },
      { _id: 'room-2' }
    ]);

    let hookResult;
    render(
      <TestHarness
        onReady={(hook) => {
          hookResult = hook;
        }}
      />
    );

    await act(async () => {
      await hookResult.loadRooms();
      hookResult.handleSelectRoom('room-2');
    });

    expect(hookResult.selectedRoomId).toBe('room-2');
    expect(hookResult.selectedRoom?._id).toBe('room-2');
  });
});
