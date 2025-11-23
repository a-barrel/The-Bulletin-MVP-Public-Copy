import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';

import useChatRoomsData from '../../src/hooks/chat/useChatRoomsData';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchChatRooms: jest.fn().mockResolvedValue([]),
  createChatRoom: jest.fn().mockResolvedValue(null)
}));

const { fetchChatRooms } = jest.requireMock('../../src/api/mongoDataApi');

function TestHarness({ onReady }) {
  const hook = useChatRoomsData({
    authUser: { uid: 'user-1' },
    authLoading: false,
    viewerLatitude: 10,
    viewerLongitude: 20,
    pinId: null
  });

  useEffect(() => {
    onReady(hook);
  }, [hook, onReady]);

  return null;
}

describe('useChatRoomsData', () => {
  beforeEach(() => {
    fetchChatRooms.mockClear();
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
});
