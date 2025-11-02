import { act, renderHook, waitFor } from '@testing-library/react';

import usePinAttendees, { clearPinAttendeesCache } from '../../src/hooks/usePinAttendees';
import { fetchPinAttendees } from '../../src/api/mongoDataApi';

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchPinAttendees: jest.fn()
}));

describe('usePinAttendees', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPinAttendeesCache();
  });

  it('skips fetching when disabled or missing pin id', () => {
    const { result } = renderHook(() =>
      usePinAttendees({
        pinId: null,
        enabled: false,
        participantCount: null,
        attendeeSignature: null
      })
    );

    expect(fetchPinAttendees).not.toHaveBeenCalled();
    expect(result.current.attendees).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches and normalizes attendees for an event pin', async () => {
    fetchPinAttendees.mockResolvedValue([
      {
        userId: 'abc123',
        displayName: 'Ada Lovelace',
        avatar: 'https://example.com/avatar.png'
      },
      {
        user: {
          _id: 'def456',
          avatar: null
        },
        profile: {
          username: 'grace'
        }
      }
    ]);

    const { result } = renderHook(() =>
      usePinAttendees({
        pinId: '64f8ab2c9c1d4b0012345678',
        enabled: true,
        participantCount: 2,
        attendeeSignature: null
      })
    );

    expect(fetchPinAttendees).toHaveBeenCalledWith('64f8ab2c9c1d4b0012345678');

    await waitFor(() => {
      expect(result.current.attendees.length).toBe(2);
    });

    const [first, second] = result.current.attendees;
    expect(first).toMatchObject({
      userId: 'abc123',
      name: 'Ada Lovelace',
      avatar: 'https://example.com/avatar.png'
    });
    expect(second).toMatchObject({
      userId: 'def456',
      name: 'grace'
    });
    expect(result.current.error).toBeNull();
  });
});
