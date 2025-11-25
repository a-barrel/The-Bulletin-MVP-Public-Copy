import { fetchPinAnalytics } from '../../src/api/mongoDataApi';

describe('fetchPinAnalytics', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('returns early without calling fetch when disabled', async () => {
    const spy = jest.fn();
    global.fetch = spy;
    const result = await fetchPinAnalytics('pin-1', { enabled: false });
    expect(result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('propagates permission errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ message: 'forbidden' })
    });

    await expect(fetchPinAnalytics('pin-1')).rejects.toMatchObject({ status: 403 });
  });

  it('times out long-running requests', async () => {
    global.fetch = jest.fn().mockImplementation((_url, options) => {
      return new Promise((resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
        // never resolve to simulate hang
      });
    });

    await expect(fetchPinAnalytics('pin-1', { timeoutMs: 5 })).rejects.toMatchObject({
      status: 'timeout',
      isTimeout: true
    });
  });
});
