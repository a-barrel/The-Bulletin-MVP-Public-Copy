import { act, renderHook } from '@testing-library/react';

import useAttachmentManager from '../useAttachmentManager';

const createFile = (name, type = 'image/png') =>
  new File(['dummy'], name, { type });

describe('useAttachmentManager', () => {
  it('uploads supported files and appends attachments', async () => {
    const uploadFn = jest.fn(async (file) => ({ url: `https://cdn.example/${file.name}` }));

    const { result } = renderHook(() => useAttachmentManager({ uploadFn, maxAttachments: 3 }));

    await act(async () => {
      await result.current.handleFiles([createFile('photo-1.png')]);
    });

    expect(uploadFn).toHaveBeenCalledTimes(1);
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].asset.url).toContain('photo-1.png');
    expect(result.current.status).toBeNull();
  });

  it('records failures and exposes a retry action', async () => {
    const uploadFn = jest
      .fn()
      .mockResolvedValueOnce({ url: 'https://cdn.example/ok.png' })
      .mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useAttachmentManager({ uploadFn, maxAttachments: 3 }));

    await act(async () => {
      await result.current.handleFiles([
        createFile('ok.png'),
        createFile('fail.png')
      ]);
    });

    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.status).toMatchObject({ type: 'error' });
    expect(result.current.canRetry).toBe(true);

    uploadFn.mockResolvedValueOnce({ url: 'https://cdn.example/retry.png' });

    await act(async () => {
      await result.current.retryFailed();
    });

    expect(uploadFn).toHaveBeenCalledTimes(3);
    expect(result.current.attachments).toHaveLength(2);
    expect(result.current.canRetry).toBe(false);
  });

  it('limits attachments and surfaces overflow messaging', async () => {
    const uploadFn = jest.fn(async (file) => ({ url: `https://cdn.example/${file.name}` }));

    const { result } = renderHook(() => useAttachmentManager({ uploadFn, maxAttachments: 1 }));

    await act(async () => {
      await result.current.handleFiles([
        createFile('first.png'),
        createFile('second.png')
      ]);
    });

    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.status).toMatchObject({ type: 'info' });
  });
});
