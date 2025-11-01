import { act, renderHook, waitFor } from '@testing-library/react';

import useBookmarksManager from '../../src/hooks/useBookmarksManager';

const mockBookmarks = [
  {
    _id: 'bookmark-1',
    pinId: 'pin-1',
    createdAt: '2025-01-01T00:00:00Z',
    pin: { _id: 'pin-1', title: 'Morning Run', type: 'event' },
    collectionId: null
  },
  {
    _id: 'bookmark-2',
    pinId: 'pin-2',
    createdAt: '2025-01-02T00:00:00Z',
    pin: { _id: 'pin-2', title: 'Coffee Spots', type: 'discussion' },
    collectionId: 'col-1'
  }
];

const mockCollections = [
  { _id: 'col-1', name: 'Favorites' }
];

const mockFetchBookmarks = jest.fn(() => Promise.resolve(mockBookmarks));
const mockFetchCollections = jest.fn(() => Promise.resolve(mockCollections));
const mockRemoveBookmark = jest.fn(() => Promise.resolve());
const mockExportBookmarks = jest.fn(() =>
  Promise.resolve({ blob: new Blob(['id']), filename: 'bookmarks.csv' })
);

jest.mock('../../src/api/mongoDataApi', () => ({
  fetchBookmarks: (...args) => mockFetchBookmarks(...args),
  fetchBookmarkCollections: (...args) => mockFetchCollections(...args),
  removeBookmark: (...args) => mockRemoveBookmark(...args),
  exportBookmarks: (...args) => mockExportBookmarks(...args)
}));

describe('useBookmarksManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports an error when offline without fetching', async () => {
    const { result } = renderHook(() =>
      useBookmarksManager({ authUser: 'user-123', authLoading: false, isOffline: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/offline/i);
  });

  it('groups bookmarks after successful fetch', async () => {
    const { result } = renderHook(() =>
      useBookmarksManager({ authUser: 'user-123', authLoading: false, isOffline: false })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.groupedBookmarks).toHaveLength(2);
    const favoritesGroup = result.current.groupedBookmarks.find((group) => group.name === 'Favorites');
    expect(favoritesGroup?.items).toHaveLength(1);
  });

  it('removes bookmark and updates state', async () => {
    const { result } = renderHook(() =>
      useBookmarksManager({ authUser: 'user-123', authLoading: false, isOffline: false })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleRemoveBookmark(mockBookmarks[0]);
    });

    expect(mockRemoveBookmark).toHaveBeenCalledWith('pin-1');
    const totals = result.current.totalCount;
    expect(totals).toBe(1);
  });
});
