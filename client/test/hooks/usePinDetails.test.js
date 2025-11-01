import { act, renderHook, waitFor } from '@testing-library/react';

import usePinDetails from '../../src/hooks/usePinDetails';

const mockApi = {
  fetchPinById: jest.fn(),
  fetchReplies: jest.fn(),
  fetchPinAttendees: jest.fn(),
  updatePinAttendance: jest.fn(),
  createPinBookmark: jest.fn(),
  deletePinBookmark: jest.fn(),
  createPinReply: jest.fn(),
  fetchCurrentUserProfile: jest.fn()
};

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchPinById: (...args) => mockApi.fetchPinById(...args),
  fetchReplies: (...args) => mockApi.fetchReplies(...args),
  fetchPinAttendees: (...args) => mockApi.fetchPinAttendees(...args),
  updatePinAttendance: (...args) => mockApi.updatePinAttendance(...args),
  createPinBookmark: (...args) => mockApi.createPinBookmark(...args),
  deletePinBookmark: (...args) => mockApi.deletePinBookmark(...args),
  createPinReply: (...args) => mockApi.createPinReply(...args),
  fetchCurrentUserProfile: (...args) => mockApi.fetchCurrentUserProfile(...args)
}));

jest.mock('../../src/contexts/BadgeSoundContext', () => ({
  __esModule: true,
  useBadgeSound: jest.fn(() => ({
    announceBadgeEarned: jest.fn()
  }))
}));

const createLocation = (overrides = {}) => ({
  pathname: '/pin/pin-1',
  search: '',
  hash: '',
  state: {},
  ...overrides
});

describe('usePinDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads pin data, replies, and attendees on mount', async () => {
    mockApi.fetchCurrentUserProfile.mockResolvedValue({ _id: 'viewer-1' });
    mockApi.fetchPinById.mockResolvedValue({
      _id: 'pin-1',
      title: 'Festival',
      type: 'event',
      viewerHasBookmarked: false,
      viewerIsAttending: false,
      coverPhoto: '/cover.jpg',
      coordinates: { coordinates: [-118.12, 33.8] },
      bookmarkCount: 3,
      participantCount: 1,
      stats: { replyCount: 2 },
      creator: { displayName: 'Alex' }
    });
    mockApi.fetchReplies.mockResolvedValue([
      {
        _id: 'reply-1',
        message: 'Looking forward to it!',
        createdAt: '2024-02-01T10:00:00.000Z',
        author: { displayName: 'Jamie' }
      },
      {
        _id: 'reply-0',
        message: 'First!',
        createdAt: '2024-01-01T10:00:00.000Z',
        author: { displayName: 'Taylor' }
      }
    ]);
    mockApi.fetchPinAttendees.mockResolvedValue([
      { _id: 'user-1', displayName: 'Casey' },
      { _id: 'user-2', displayName: 'Morgan' }
    ]);

    const { result } = renderHook(() =>
      usePinDetails({
        pinId: 'pin-1',
        location: createLocation(),
        isOffline: false
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApi.fetchPinById).toHaveBeenCalledWith('pin-1', expect.objectContaining({ previewMode: '' }));
    expect(result.current.pin?.title).toBe('Festival');
    expect(result.current.replyItems[0].message).toBe('Looking forward to it!');
    expect(result.current.replyItems[0].createdLabel).toBeTruthy();

    await act(async () => {
      result.current.openAttendeeOverlay();
    });
    await waitFor(() => expect(result.current.isLoadingAttendees).toBe(false));
    expect(result.current.attendeeItems).toHaveLength(2);
    expect(result.current.creatorProfileLink?.pathname).toBe('/profile/Alex');
  });

  it('surfaces offline messaging when attempting actions without connectivity', async () => {
    mockApi.fetchCurrentUserProfile.mockResolvedValue({ _id: 'viewer-1' });
    mockApi.fetchPinById.mockResolvedValue({
      _id: 'pin-2',
      title: 'Offline Preview',
      type: 'discussion',
      viewerHasBookmarked: false,
      viewerIsAttending: false
    });
    mockApi.fetchReplies.mockResolvedValue([]);
    mockApi.fetchPinAttendees.mockResolvedValue([]);

    const { result } = renderHook(() =>
      usePinDetails({
        pinId: 'pin-2',
        location: createLocation(),
        isOffline: true
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleToggleBookmark();
    });
    expect(result.current.bookmarkError).toMatch(/offline/i);

    act(() => {
      result.current.openReplyComposer();
    });
    expect(result.current.submitReplyError).toMatch(/offline/i);

    await act(async () => {
      await result.current.handleSubmitReply();
    });
    expect(result.current.submitReplyError).toMatch(/offline/i);
  });
});
