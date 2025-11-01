import { act, renderHook, waitFor } from '@testing-library/react';

import useProfileDetail from '../../src/hooks/useProfileDetail';

const mockApi = {
  fetchCurrentUserProfile: jest.fn(),
  fetchUserProfile: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  updateCurrentUserProfile: jest.fn(),
  uploadImage: jest.fn()
};

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchCurrentUserProfile: (...args) => mockApi.fetchCurrentUserProfile(...args),
  fetchUserProfile: (...args) => mockApi.fetchUserProfile(...args),
  blockUser: (...args) => mockApi.blockUser(...args),
  unblockUser: (...args) => mockApi.unblockUser(...args),
  updateCurrentUserProfile: (...args) => mockApi.updateCurrentUserProfile(...args),
  uploadImage: (...args) => mockApi.uploadImage(...args)
}));

describe('useProfileDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prevents editing while offline and surfaces a warning', async () => {
    const targetUser = {
      _id: '507f1f77bcf86cd799439021',
      displayName: 'Offline Target',
      preferences: {}
    };

    const { result } = renderHook(() =>
      useProfileDetail({
        userIdParam: targetUser._id,
        locationState: { user: targetUser },
        isOffline: true
      })
    );

    await waitFor(() =>
      expect(result.current.effectiveUser?._id).toBe(targetUser._id)
    );

    act(() => {
      result.current.handleBeginEditing();
    });

    expect(result.current.updateStatus).toMatchObject({
      type: 'warning',
      message: expect.stringMatching(/Reconnect/i)
    });
    expect(result.current.isEditing).toBe(false);
  });

  it('blocks and unblocks a target user while updating relationship status', async () => {
    const viewerProfile = {
      _id: '507f1f77bcf86cd799439030',
      displayName: 'Viewer',
      relationships: { blockedUserIds: [] }
    };
    const targetProfile = {
      _id: '507f1f77bcf86cd799439031',
      displayName: 'Target User'
    };

    mockApi.fetchCurrentUserProfile.mockResolvedValue(viewerProfile);
    mockApi.fetchUserProfile.mockResolvedValue(targetProfile);
    mockApi.blockUser.mockResolvedValue({
      updatedRelationships: { blockedUserIds: [targetProfile._id] }
    });
    mockApi.unblockUser.mockResolvedValue({
      updatedRelationships: { blockedUserIds: [] }
    });

    const { result } = renderHook(() =>
      useProfileDetail({
        userIdParam: targetProfile._id,
        locationState: {},
        isOffline: false
      })
    );

    await waitFor(() => expect(result.current.isFetchingProfile).toBe(false));
    await waitFor(() => expect(result.current.effectiveUser?._id).toBe(targetProfile._id));
    await waitFor(() => expect(result.current.canManageBlock).toBe(true));

    act(() => {
      result.current.handleRequestBlock();
    });
    expect(result.current.blockDialogMode).toBe('block');

    await act(async () => {
      await result.current.handleConfirmBlockDialog();
    });

    expect(mockApi.blockUser).toHaveBeenCalledWith(targetProfile._id);
    await waitFor(() => expect(result.current.isBlocked).toBe(true));
    expect(result.current.relationshipStatus).toMatchObject({
      type: 'success',
      message: expect.stringMatching(/blocked/i)
    });

    act(() => {
      result.current.handleRequestUnblock();
    });
    expect(result.current.blockDialogMode).toBe('unblock');

    await act(async () => {
      await result.current.handleConfirmBlockDialog();
    });

    expect(mockApi.unblockUser).toHaveBeenCalledWith(targetProfile._id);
    await waitFor(() => expect(result.current.isBlocked).toBe(false));
    expect(result.current.relationshipStatus).toMatchObject({
      type: 'success',
      message: expect.stringMatching(/unblocked/i)
    });
  });
});
