import { act, renderHook, waitFor } from '@testing-library/react';

import useLiveChatSimulationTools from '../../src/pages/DebugConsole/hooks/useLiveChatSimulationTools';
import { LIVE_CHAT_ROOM_PRESETS } from '../../src/pages/DebugConsole/constants';

var mockApi;

jest.mock('../../src/api/mongoDataApi', () => {
  if (!mockApi) {
    mockApi = {};
  }
  Object.assign(mockApi, {
    createProximityChatMessage: jest.fn(),
    createProximityChatPresence: jest.fn(),
    createProximityChatRoom: jest.fn(),
    fetchChatMessages: jest.fn(),
    fetchChatPresence: jest.fn(),
    fetchChatRooms: jest.fn(),
    fetchCurrentUserProfile: jest.fn(),
    insertLocationUpdate: jest.fn()
  });

  return {
    __esModule: true,
    ...mockApi
  };
});

var mockViewerLocation;

jest.mock('../../src/pages/DebugConsole/hooks/useViewerLocation', () => {
  if (!mockViewerLocation) {
    mockViewerLocation = {};
  }
  Object.assign(mockViewerLocation, {
    location: { latitude: 33.81, longitude: -118.15, accuracy: 5 },
    setLocation: jest.fn(),
    refresh: jest.fn()
  });

  return {
    __esModule: true,
    default: jest.fn(() => mockViewerLocation)
  };
});

jest.mock('../../src/firebase', () => ({
  auth: {}
}));

var mockAuthUser = { uid: '64f0d3c2b5f0d3c2b5f0d3c2' };

jest.mock('react-firebase-hooks/auth', () => ({
  useAuthState: jest.fn(() => [mockAuthUser, false])
}));

const buildPresetRooms = () =>
  LIVE_CHAT_ROOM_PRESETS.map((preset, index) => ({
    _id: `507f1f77bcf86cd7994390${index.toString(16).padStart(2, '0')}`,
    presetKey: preset.key,
    name: preset.name,
    coordinates: { coordinates: [preset.longitude, preset.latitude] },
    radiusMeters: preset.radiusMeters ?? 100
  }));

describe('useLiveChatSimulationTools', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((message, ...rest) => {
      if (typeof message === 'string' && message.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(message, ...rest);
    });

    jest.clearAllMocks();

    mockViewerLocation.location = { latitude: 33.81, longitude: -118.15, accuracy: 5 };
    if (typeof mockViewerLocation.setLocation?.mockClear === 'function') {
      mockViewerLocation.setLocation.mockClear();
    }
    if (typeof mockViewerLocation.refresh?.mockClear === 'function') {
      mockViewerLocation.refresh.mockClear();
    }

    mockApi.fetchCurrentUserProfile.mockResolvedValue({
      _id: '64f0d3c2b5f0d3c2b5f0d3c2',
      displayName: 'Tester',
      username: 'tester'
    });
    mockApi.fetchChatRooms.mockResolvedValue(buildPresetRooms());
    mockApi.fetchChatMessages.mockResolvedValue([]);
    mockApi.fetchChatPresence.mockResolvedValue([]);
    mockApi.insertLocationUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('updates location status after teleporting to a preset', async () => {
    let renderResult;
    await act(async () => {
      renderResult = renderHook(() => useLiveChatSimulationTools());
    });
    const { result } = renderResult;

    await waitFor(() => {
      expect(mockApi.fetchCurrentUserProfile).toHaveBeenCalled();
      expect(result.current.currentProfile).toEqual(
        expect.objectContaining({ _id: '64f0d3c2b5f0d3c2b5f0d3c2', displayName: 'Tester' })
      );
    });

    const preset = {
      key: 'demo-spot',
      label: 'Demo Spot',
      latitude: 34.05,
      longitude: -118.24,
      accuracy: 7,
      statusMessage: 'Teleported to Demo Spot'
    };

    await act(async () => {
      await result.current.handleTeleport(preset);
    });

    expect(mockApi.insertLocationUpdate).toHaveBeenCalledWith({
      userId: '64f0d3c2b5f0d3c2b5f0d3c2',
      coordinates: {
        type: 'Point',
        coordinates: [-118.24, 34.05],
        accuracy: 7
      },
      isPublic: true,
      source: 'web'
    });
    expect(result.current.locationStatus).toEqual({
      type: 'success',
      message: 'Teleported to Demo Spot'
    });
  });

  it('surfaces a warning when refreshing messages without an active room', () => {
    let renderResult;
    act(() => {
      renderResult = renderHook(() => useLiveChatSimulationTools());
    });
    const { result } = renderResult;

    act(() => {
      result.current.handleRefreshMessages();
    });

    expect(result.current.status).toEqual({
      type: 'warning',
      message: 'Select a chat room before refreshing messages.'
    });
  });

  it('logs a warning when presence updates fail after sending a message', async () => {
    const preset = LIVE_CHAT_ROOM_PRESETS[0];
    mockViewerLocation.location = {
      latitude: preset.latitude,
      longitude: preset.longitude,
      accuracy: 5
    };

    mockApi.createProximityChatMessage.mockResolvedValue({
      _id: 'msg-1',
      authorId: '64f0d3c2b5f0d3c2b5f0d3c2',
      message: 'Hello world'
    });
    mockApi.createProximityChatPresence.mockRejectedValue(new Error('presence-failed'));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useLiveChatSimulationTools());

    await waitFor(() => expect(mockApi.fetchChatRooms).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current.currentProfile?._id).toBe('64f0d3c2b5f0d3c2b5f0d3c2')
    );
    await waitFor(() => expect(result.current.activeRoom).not.toBeNull());

    act(() => {
      result.current.handleSelectRoom(preset.key);
    });

    await waitFor(() => expect(result.current.activeRoom?.presetKey).toBe(preset.key));

    await act(async () => {
      await result.current.handleTeleport({
        key: 'preset',
        label: 'Preset',
        latitude: preset.latitude,
        longitude: preset.longitude,
        accuracy: 5,
        statusMessage: 'Teleported'
      });
    });

    await waitFor(() => expect(result.current.roomAccess?.allowed).toBe(true));

    act(() => {
      result.current.setMessageInput('Hello world');
    });

    await act(async () => {
      await result.current.handleSendMessage({ preventDefault: jest.fn() });
    });

    await waitFor(() => expect(mockApi.createProximityChatPresence).toHaveBeenCalled());
    await waitFor(() => expect(warnSpy).toHaveBeenCalled());

    warnSpy.mockRestore();
  });
});
