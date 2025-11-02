import { renderHook, waitFor } from '@testing-library/react';

import useNearbyPinsFeed from '../../src/hooks/useNearbyPinsFeed';

const mockPins = [
  {
    _id: 'pin-1',
    title: 'Community Cleanup',
    distanceMeters: 1609.34,
    type: 'event',
    creator: { displayName: 'Alex' },
    tags: ['Cleanup'],
    replyCount: 2
  }
];

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchPinsNearby: jest.fn(() => Promise.resolve(mockPins)),
  fetchPinById: jest.fn((id) =>
    Promise.resolve({
      _id: id,
      title: 'Community Cleanup',
      type: 'event',
      creator: { displayName: 'Alex' },
      tags: ['Cleanup']
    })
  )
}));

describe('useNearbyPinsFeed', () => {
  it('loads nearby pins and maps them into feed items', async () => {
    const { result } = renderHook(() =>
      useNearbyPinsFeed({
        sharedLocation: { latitude: 33.8, longitude: -118.1 },
        isOffline: false
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.feedItems).toHaveLength(1);
    expect(result.current.feedItems[0]).toMatchObject({
      title: 'Community Cleanup',
      tag: 'Cleanup',
      authorName: 'Alex'
    });
  });

  it('surfaces offline notice without fetching', async () => {
    const { result } = renderHook(() =>
      useNearbyPinsFeed({
        sharedLocation: { latitude: 33.8, longitude: -118.1 },
        isOffline: true
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/offline/i);
  });
});
