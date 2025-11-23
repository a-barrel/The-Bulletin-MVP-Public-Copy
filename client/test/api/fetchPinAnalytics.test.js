import { fetchPinAnalytics } from '../../src/api/mongoDataApi';

describe('fetchPinAnalytics', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns early without calling fetch when disabled', async () => {
    const spy = jest.fn();
    global.fetch = spy;
    const result = await fetchPinAnalytics('pin-1', { enabled: false });
    expect(result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
