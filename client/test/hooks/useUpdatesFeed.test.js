import { act, renderHook, waitFor } from '@testing-library/react';

import useUpdatesFeed from '../../src/hooks/useUpdatesFeed';
import UpdatesContext from '../../src/contexts/UpdatesContext';

const mockApi = {
  fetchCurrentUserProfile: jest.fn(),
  fetchUpdates: jest.fn(),
  markUpdateRead: jest.fn(),
  markAllUpdatesRead: jest.fn()
};

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchCurrentUserProfile: (...args) => mockApi.fetchCurrentUserProfile(...args),
  fetchUpdates: (...args) => mockApi.fetchUpdates(...args),
  markUpdateRead: (...args) => mockApi.markUpdateRead(...args),
  markAllUpdatesRead: (...args) => mockApi.markAllUpdatesRead(...args)
}));

jest.mock('react-firebase-hooks/auth', () => ({
  useAuthState: jest.fn(() => [{ uid: 'firebase-user' }, false])
}));

const baseUpdates = [
  {
    _id: 'update-1',
    payload: { type: 'event-reminder', title: 'Event reminder' },
    readAt: null
  },
  {
    _id: 'update-2',
    payload: { type: 'chat-message', title: 'New DM' },
    readAt: null
  },
  {
    _id: 'update-3',
    payload: { type: 'bookmark-update', title: 'Bookmark change' },
    readAt: null
  },
  {
    _id: 'update-4',
    payload: { type: 'system', title: 'System notice' },
    readAt: '2024-01-01T00:00:00.000Z'
  }
];

const createWrapper = ({
  setUnreadCount = jest.fn(),
  setUnreadBookmarkCount = jest.fn(),
  setUnreadDiscussionsCount = jest.fn(),
  setUnreadEventsCount = jest.fn()
} = {}) => {
  const value = {
    unreadCount: 0,
    unreadBookmarkCount: 0,
    unreadDiscussionsCount: 0,
    unreadEventsCount: 0,
    setUnreadCount,
    setUnreadBookmarkCount,
    setUnreadDiscussionsCount,
    setUnreadEventsCount,
    refreshUnreadCount: jest.fn()
  };

  const wrapper = ({ children }) => (
    <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>
  );

  return { wrapper, setUnreadCount, setUnreadBookmarkCount, setUnreadDiscussionsCount, setUnreadEventsCount };
};

describe('useUpdatesFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.fetchCurrentUserProfile.mockResolvedValue({
      _id: 'viewer-id'
    });
    mockApi.fetchUpdates.mockImplementation(() =>
      Promise.resolve(baseUpdates.map((item) => ({ ...item, payload: { ...item.payload } })))
    );
    mockApi.markUpdateRead.mockResolvedValue({
      ...baseUpdates[1],
      readAt: '2025-01-01T00:00:00.000Z'
    });
  });

  it('derives category metrics and updates context counters', async () => {
    const tracking = createWrapper();

    const { result } = renderHook(() => useUpdatesFeed(), { wrapper: tracking.wrapper });

    await waitFor(() => {
      expect(mockApi.fetchUpdates).toHaveBeenCalledWith({ userId: 'viewer-id', limit: 100 });
    });

    await waitFor(() => {
      expect(tracking.setUnreadCount).toHaveBeenLastCalledWith(3);
      expect(tracking.setUnreadBookmarkCount).toHaveBeenLastCalledWith(1);
      expect(tracking.setUnreadDiscussionsCount).toHaveBeenLastCalledWith(1);
      expect(tracking.setUnreadEventsCount).toHaveBeenLastCalledWith(1);
    });

    await waitFor(() => expect(result.current.updates.length).toBe(baseUpdates.length));

    const categories = result.current.updates.map((update) => update.category);
    expect(categories).toEqual(['event', 'discussion', 'other', 'other']);

    act(() => {
      result.current.handleToggleUnreadOnly({ target: { checked: true } });
    });

    expect(result.current.filteredUpdates).toHaveLength(result.current.updates.length);
  });

});
