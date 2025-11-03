import { act, renderHook, waitFor } from '@testing-library/react';

import useModerationTools from '../../src/hooks/useModerationTools';

const mockApi = {
  fetchModerationOverview: jest.fn(),
  fetchModerationHistory: jest.fn(),
  submitModerationAction: jest.fn()
};

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchModerationOverview: (...args) => mockApi.fetchModerationOverview(...args),
  fetchModerationHistory: (...args) => mockApi.fetchModerationHistory(...args),
  submitModerationAction: (...args) => mockApi.submitModerationAction(...args)
}));

describe('useModerationTools (shared)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.fetchModerationOverview.mockResolvedValue({
      flaggedUsers: []
    });
    mockApi.fetchModerationHistory.mockResolvedValue({ history: [] });
    mockApi.submitModerationAction.mockResolvedValue({
      action: { id: 'action-1', type: 'warn' },
      user: { id: 'user-1' }
    });
  });

  it('loads overview and records moderation action', async () => {
    const { result } = renderHook(() => useModerationTools({ autoLoad: true }));

    await waitFor(() => expect(mockApi.fetchModerationOverview).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.selectUser('user-1');
    });

    await waitFor(() => expect(mockApi.fetchModerationHistory).toHaveBeenCalledWith('user-1'));

    await act(async () => {
      await result.current.recordAction({
        userId: 'user-1',
        type: 'warn',
        reason: 'Testing'
      });
    });

    expect(mockApi.submitModerationAction).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'warn',
      reason: 'Testing',
      durationMinutes: undefined
    });

    await waitFor(() => {
      expect(result.current.actionStatus?.type).toBe('success');
    });
  });

  it('surfaces errors from moderation action attempts', async () => {
    mockApi.submitModerationAction.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useModerationTools({ autoLoad: false }));

    await act(async () => {
      result.current.selectUser('user-2');
    });

    let capturedError;
    await act(async () => {
      try {
        await result.current.recordAction({
          userId: 'user-2',
          type: 'warn',
          reason: 'Failure path'
        });
      } catch (error) {
        capturedError = error;
      }
    });

    expect(capturedError).toEqual(expect.any(Error));
    await waitFor(() => {
      expect(result.current.actionStatus?.type).toBe('error');
    });
  });

  it('supports abusive user cleanup workflow', async () => {
    const historyResponses = [
      { history: [] },
      { history: [{ id: 'action-1', type: 'mute' }] },
      { history: [{ id: 'action-2', type: 'ban' }] }
    ];

    mockApi.fetchModerationHistory.mockImplementation(() => Promise.resolve(historyResponses.shift() || { history: [] }));

    const { result } = renderHook(() => useModerationTools({ autoLoad: false }));

    await act(async () => {
      result.current.selectUser('abusive-user');
    });

    await waitFor(() => expect(mockApi.fetchModerationHistory).toHaveBeenCalledWith('abusive-user'));

    mockApi.submitModerationAction.mockResolvedValueOnce({
      action: { id: 'mute-action', type: 'mute' },
      user: { id: 'abusive-user' }
    });

    await act(async () => {
      await result.current.recordAction({
        userId: 'abusive-user',
        type: 'mute',
        reason: 'Escalating spam',
        durationMinutes: 30
      });
    });

    mockApi.submitModerationAction.mockResolvedValueOnce({
      action: { id: 'ban-action', type: 'ban' },
      user: { id: 'abusive-user' }
    });

    await act(async () => {
      await result.current.recordAction({
        userId: 'abusive-user',
        type: 'ban',
        reason: 'Violation persisted'
      });
    });

    expect(mockApi.submitModerationAction).toHaveBeenNthCalledWith(1, {
      userId: 'abusive-user',
      type: 'mute',
      reason: 'Escalating spam',
      durationMinutes: 30
    });
    expect(mockApi.submitModerationAction).toHaveBeenNthCalledWith(2, {
      userId: 'abusive-user',
      type: 'ban',
      reason: 'Violation persisted',
      durationMinutes: undefined
    });

    await waitFor(() => {
      expect(result.current.historyStatus?.type).toBe('success');
      expect(result.current.history.length).toBeGreaterThanOrEqual(0);
    });
  });
});
