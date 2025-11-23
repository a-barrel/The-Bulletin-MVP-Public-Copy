import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';

import usePinDetails from '../../src/hooks/usePinDetails';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchPinById: jest.fn().mockResolvedValue({
    _id: 'p1',
    creatorId: 'user-1',
    type: 'event',
    title: 'Test pin'
  }),
  fetchReplies: jest.fn().mockResolvedValue([]),
  fetchPinAttendees: jest.fn().mockResolvedValue([]),
  updatePinAttendance: jest.fn(),
  createPinBookmark: jest.fn(),
  deletePinBookmark: jest.fn(),
  createPinReply: jest.fn(),
  fetchCurrentUserProfile: jest.fn().mockResolvedValue({ _id: 'user-1' }),
  sharePin: jest.fn()
}));

const { fetchPinById } = jest.requireMock('../../src/api/mongoDataApi');

function TestHarness({ onReady }) {
  const hook = usePinDetails({ pinId: 'p1', location: { search: '' }, isOffline: false });

  useEffect(() => {
    onReady(hook);
  }, [hook, onReady]);

  return null;
}

describe('usePinDetails cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reuses cached pin within TTL and avoids extra fetch', async () => {
    let api;
    render(
      <TestHarness
        onReady={(hook) => {
          api = hook;
        }}
      />
    );

    await act(async () => {
      // allow initial fetch
      await Promise.resolve();
    });

    expect(fetchPinById).toHaveBeenCalledTimes(1);

    await act(async () => {
      await api.reloadPin();
      await api.reloadPin();
    });

    expect(fetchPinById).toHaveBeenCalledTimes(1);
  });
});
