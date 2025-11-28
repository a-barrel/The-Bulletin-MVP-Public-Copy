import { act, renderHook } from '@testing-library/react';
import useChatReporting from '../../src/hooks/useChatReporting';
import { createContentReport } from '../../src/api';

jest.mock('../../src/api', () => ({
  createContentReport: jest.fn()
}));

describe('useChatReporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens and primes report dialog with target', () => {
    const { result } = renderHook(() => useChatReporting());
    act(() => {
      result.current.openReportDialog({
        contentType: 'chat-message',
        contentId: 'msg-1',
        summary: 'Hello',
        context: 'Room'
      });
    });

    expect(result.current.reportDialogOpen).toBe(true);
    expect(result.current.reportTarget).toMatchObject({ contentId: 'msg-1' });
    expect(result.current.reportReason).toBe('');
    expect(result.current.reportSelectedOffenses).toEqual([]);
  });

  it('submits a report and closes dialog on success', async () => {
    createContentReport.mockResolvedValue({});
    const { result } = renderHook(() => useChatReporting());
    act(() => {
      result.current.openReportDialog({
        contentType: 'chat-message',
        contentId: 'abc123',
        context: 'Room'
      });
      result.current.setReportReason('spam');
    });

    await act(async () => {
      await result.current.submitReport();
    });

    expect(createContentReport).toHaveBeenCalledWith({
      contentType: 'chat-message',
      contentId: 'abc123',
      reason: 'spam',
      context: 'Room',
      offenses: []
    });
    expect(result.current.reportDialogOpen).toBe(false);
    expect(result.current.reportStatus?.type).toBe('success');
  });

  it('captures errors when submit fails', async () => {
    createContentReport.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useChatReporting());
    act(() => {
      result.current.openReportDialog({
        contentType: 'chat-message',
        contentId: 'abc123'
      });
    });

    await act(async () => {
      await result.current.submitReport();
    });

    expect(result.current.reportError).toBe('boom');
  });
});
