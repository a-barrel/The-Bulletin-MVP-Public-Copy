import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';

import useBookmarksManager from '../../src/hooks/useBookmarksManager';

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchBookmarks: jest.fn().mockResolvedValue([
    { _id: 'b1', pinId: 'p1', pin: { _id: 'p1', viewerIsAttending: false } }
  ]),
  fetchBookmarkCollections: jest.fn().mockResolvedValue([]),
  fetchBookmarkHistory: jest.fn().mockResolvedValue([]),
  fetchPinById: jest.fn().mockResolvedValue({ _id: 'p1', viewerIsAttending: false }),
  removeBookmark: jest.fn().mockResolvedValue({}),
  updatePinAttendance: jest.fn().mockResolvedValue({}),
  clearBookmarkHistory: jest.fn().mockResolvedValue({})
}));

const {
  fetchBookmarks,
  fetchBookmarkCollections,
  fetchBookmarkHistory,
  fetchPinById,
  removeBookmark
} = jest.requireMock('../../src/api/mongoDataApi');

function TestHarness({ onReady }) {
  const hook = useBookmarksManager({
    authUser: { uid: 'user-1' },
    authLoading: false,
    isOffline: false,
    hideFullEvents: true
  });

  useEffect(() => {
    onReady(hook);
  }, [hook, onReady]);

  return null;
}

describe('useBookmarksManager caching/guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reuses cached bookmarks/collections within TTL and avoids a second fetch', async () => {
    let api;
    render(
      <TestHarness
        onReady={(hook) => {
          api = hook;
        }}
      />
    );

    await act(async () => {
      // allow initial load
      await Promise.resolve();
    });
    expect(fetchBookmarks).toHaveBeenCalledTimes(1);
    expect(fetchBookmarkCollections).toHaveBeenCalledTimes(1);

    await act(async () => {
      await api.refresh();
    });

    expect(fetchBookmarks).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache after removal so refresh fetches again', async () => {
    let api;
    render(
      <TestHarness
        onReady={(hook) => {
          api = hook;
        }}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchBookmarks).toHaveBeenCalledTimes(1);

    await act(async () => {
      await api.handleRemoveBookmark({ _id: 'b1', pinId: 'p1' });
    });
    expect(removeBookmark).toHaveBeenCalledWith('p1');

    await act(async () => {
      await api.refresh();
    });

    expect(fetchBookmarks).toHaveBeenCalledTimes(2);
  });
});
