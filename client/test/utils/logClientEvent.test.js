import { logClientEvent } from '../../src/api/mongoDataApi';
import { auth } from '../../src/firebase';

jest.mock('../../src/firebase', () => ({
  auth: { currentUser: null }
}));

jest.mock('../../src/config/runtime', () => ({
  __esModule: true,
  default: {
    apiBaseUrl: '',
    defaultNearbyRadius: 10,
    isOffline: false,
    isOnline: false,
    firebase: { config: {}, authEmulatorUrl: undefined },
    roles: {},
    moderation: {}
  }
}));

describe('logClientEvent', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    auth.currentUser = null;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips logging when no authenticated user', async () => {
    await logClientEvent({ message: 'Test without auth' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('attempts logging when authenticated and handles non-OK responses gracefully', async () => {
    auth.currentUser = {
      getIdToken: jest.fn().mockResolvedValue('token')
    };
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({})
    });

    await logClientEvent({ message: 'Test with auth' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/api/dev-logs');
  });
});
