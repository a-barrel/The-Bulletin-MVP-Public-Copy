import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';

import useMapNearbyData from '../../src/hooks/useMapNearbyData';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchPinsNearby: jest.fn().mockResolvedValue([])
}));

const { fetchPinsNearby } = jest.requireMock('../../src/api/mongoDataApi');

function TestHarness({ onReady }) {
  const hook = useMapNearbyData({
    userLocation: { latitude: 10, longitude: 20 },
    isOffline: false,
    pinFetchLimit: 10,
    currentProfileId: 'viewer-1',
    setGlobalError: () => {},
    hideFullEvents: true
  });

  useEffect(() => {
    onReady(hook);
  }, [hook, onReady]);

  return null;
}

describe('useMapNearbyData', () => {
  beforeEach(() => {
    fetchPinsNearby.mockClear();
  });

  it('avoids overlapping fetches when refreshPins is called while in flight', async () => {
    let apiResolve;
    fetchPinsNearby.mockImplementation(
      () =>
        new Promise((resolve) => {
          apiResolve = resolve;
        })
    );

    let refreshPins;
    render(
      <TestHarness
        onReady={(hook) => {
          refreshPins = hook.refreshPins;
        }}
      />
    );

    await act(async () => {
      const first = refreshPins();
      const second = refreshPins();
      apiResolve([]);
      await Promise.all([first, second]);
    });

    expect(fetchPinsNearby).toHaveBeenCalledTimes(1);
  });

  it('throttles rapid consecutive refreshPins calls', async () => {
    fetchPinsNearby.mockResolvedValue([]);

    let refreshPins;
    render(
      <TestHarness
        onReady={(hook) => {
          refreshPins = hook.refreshPins;
        }}
      />
    );

    await act(async () => {
      await refreshPins();
      await refreshPins();
    });

    expect(fetchPinsNearby).toHaveBeenCalledTimes(1);
  });
});
