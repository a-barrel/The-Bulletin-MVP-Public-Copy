import { act, renderHook, waitFor } from '@testing-library/react';

import useSettingsManager, {
  DEFAULT_SETTINGS
} from '../../src/hooks/useSettingsManager';

jest.mock('../../src/firebase', () => ({
  __esModule: true,
  auth: {}
}));

jest.mock('firebase/auth', () => ({
  signOut: jest.fn(() => Promise.resolve())
}));

const mockApi = {
  fetchCurrentUserProfile: jest.fn(),
  updateCurrentUserProfile: jest.fn(),
  fetchBlockedUsers: jest.fn(),
  unblockUser: jest.fn(),
  revokeCurrentSession: jest.fn()
};

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchCurrentUserProfile: (...args) => mockApi.fetchCurrentUserProfile(...args),
  updateCurrentUserProfile: (...args) => mockApi.updateCurrentUserProfile(...args),
  fetchBlockedUsers: (...args) => mockApi.fetchBlockedUsers(...args),
  unblockUser: (...args) => mockApi.unblockUser(...args),
  revokeCurrentSession: (...args) => mockApi.revokeCurrentSession(...args)
}));

const authUser = { uid: 'user-1', email: 'demo@example.com' };

describe('useSettingsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads profile preferences and toggles notifications', async () => {
    mockApi.fetchCurrentUserProfile.mockResolvedValue({
      _id: 'user-1',
      preferences: {
        theme: 'dark',
        radiusPreferenceMeters: 4000,
        filterCussWords: true,
        statsPublic: false,
        notifications: {
          proximity: true,
          updates: false,
          marketing: false,
          chatTransitions: true
        }
      }
    });
    mockApi.fetchBlockedUsers.mockResolvedValue({ blockedUsers: [] });

    const { result } = renderHook(() =>
      useSettingsManager({ authUser, authLoading: false, isOffline: false })
    );

    await waitFor(() => expect(result.current.isFetchingProfile).toBe(false));
    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.settings.notifications.updates).toBe(false);

    act(() => {
      result.current.handleNotificationToggle('updates');
    });

    expect(result.current.settings.notifications.updates).toBe(true);
  });

  it('prevents saving when offline and surfaces a warning', async () => {
    mockApi.fetchCurrentUserProfile.mockResolvedValue({
      _id: 'user-1',
      preferences: DEFAULT_SETTINGS
    });
    const { result } = renderHook(() =>
      useSettingsManager({ authUser, authLoading: false, isOffline: true })
    );

    await waitFor(() => expect(result.current.isFetchingProfile).toBe(false));

    act(() => {
      result.current.handleThemeChange({ target: { value: 'dark' } });
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.saveStatus?.type).toBe('warning');
    expect(mockApi.updateCurrentUserProfile).not.toHaveBeenCalled();
  });
});
