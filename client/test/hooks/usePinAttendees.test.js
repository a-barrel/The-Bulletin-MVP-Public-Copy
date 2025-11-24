import { act, renderHook, waitFor } from '@testing-library/react';
import usePinAttendees, { clearPinAttendeesCache } from '../../src/hooks/usePinAttendees';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchPinAttendees: jest.fn().mockResolvedValue([])
}));

const { fetchPinAttendees } = require('../../src/api/mongoDataApi');

describe('usePinAttendees', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fetchPinAttendees.mockClear();
    clearPinAttendeesCache();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('dedupes concurrent fetches for the same pin', async () => {
    let resolveFetch;
    fetchPinAttendees.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    renderHook(() =>
      usePinAttendees({
        pinId: 'pin-1',
        enabled: true
      })
    );

    renderHook(() =>
      usePinAttendees({
        pinId: 'pin-1',
        enabled: true
      })
    );

    expect(fetchPinAttendees).toHaveBeenCalledTimes(1);

    act(() => {
      resolveFetch([]);
    });
  });

  it('returns cached attendees for fresh entries', async () => {
    fetchPinAttendees.mockResolvedValue([{ userId: 'user-1' }]);

    const { result } = renderHook(() =>
      usePinAttendees({
        pinId: 'pin-2',
        enabled: true
      })
    );

    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => expect(fetchPinAttendees).toHaveBeenCalledTimes(1));

    const second = renderHook(() =>
      usePinAttendees({
        pinId: 'pin-2',
        enabled: true
      })
    );

    act(() => {
      jest.runAllTimers();
    });

    await waitFor(() => expect(fetchPinAttendees).toHaveBeenCalledTimes(1));
    expect(second.result.current.attendees.length).toBeGreaterThanOrEqual(1);
  });
});
