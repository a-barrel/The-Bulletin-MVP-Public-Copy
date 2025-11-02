import { act, renderHook, waitFor } from '@testing-library/react';

import useDirectMessages from '../../src/hooks/useDirectMessages';

const mockApi = {
  fetchDirectMessageThreads: jest.fn(),
  fetchDirectMessageThread: jest.fn(),
  sendDirectMessage: jest.fn(),
  createDirectMessageThread: jest.fn()
};

jest.mock('../../src/api/mongoDataApi', () => ({
  __esModule: true,
  fetchDirectMessageThreads: (...args) => mockApi.fetchDirectMessageThreads(...args),
  fetchDirectMessageThread: (...args) => mockApi.fetchDirectMessageThread(...args),
  sendDirectMessage: (...args) => mockApi.sendDirectMessage(...args),
  createDirectMessageThread: (...args) => mockApi.createDirectMessageThread(...args)
}));

describe('useDirectMessages (shared)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.fetchDirectMessageThreads.mockResolvedValue({
      viewer: { id: 'viewer-1' },
      threads: [{ id: 'thread-1', participantCount: 2, participants: [] }]
    });
    mockApi.fetchDirectMessageThread.mockResolvedValue({
      thread: {
        id: 'thread-1',
        participants: [{ id: 'viewer-1' }],
        messages: []
      }
    });
    mockApi.sendDirectMessage.mockResolvedValue({
      message: { id: 'msg-1' }
    });
    mockApi.createDirectMessageThread.mockResolvedValue({
      thread: { id: 'thread-2' }
    });
  });

  it('loads threads and sends messages', async () => {
    const { result } = renderHook(() => useDirectMessages({ autoLoad: true }));

    await waitFor(() => expect(mockApi.fetchDirectMessageThreads).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.selectThread('thread-1');
    });

    await waitFor(() => expect(mockApi.fetchDirectMessageThread).toHaveBeenCalledWith('thread-1'));

    await act(async () => {
      await result.current.sendMessage({
        threadId: 'thread-1',
        body: 'Hello world',
        attachments: [],
        sender: { id: 'viewer-1' }
      });
    });

    expect(mockApi.sendDirectMessage).toHaveBeenCalledWith('thread-1', {
      body: 'Hello world',
      attachments: []
    });

    await waitFor(() => expect(result.current.sendStatus?.type).toBe('success'));
  });

  it('exposes errors when sending without a thread', async () => {
    const { result } = renderHook(() => useDirectMessages({ autoLoad: false }));
    let captured;
    await act(async () => {
      try {
        await result.current.sendMessage({
          threadId: '',
          body: 'No thread',
          attachments: []
        });
      } catch (error) {
        captured = error;
      }
    });

    expect(captured).toEqual(expect.any(Error));
    await waitFor(() => expect(result.current.sendStatus?.type).toBe('error'));
  });
});
