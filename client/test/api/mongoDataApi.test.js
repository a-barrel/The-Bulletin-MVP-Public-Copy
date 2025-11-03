import fs from 'fs';
import path from 'path';
import { transformSync } from '@babel/core';

const runtimeMock = {
  __esModule: true,
  default: {
    apiBaseUrl: 'https://api.example.com',
    isOffline: false,
    isOnline: true,
    firebase: { config: {}, authEmulatorUrl: undefined }
  }
};

const mockAuth = {
  currentUser: null
};

let apiModule;

beforeAll(() => {
  const modulePath = path.resolve(__dirname, '../../src/api/mongoDataApi.js');
  const rawSource = fs.readFileSync(modulePath, 'utf8');
  const source = rawSource
    .replace(/import\.meta\.env\.DEV/g, 'false')
    .replace(/import\.meta\.env/g, '{}')
    .replace(/import\.meta/g, '{}');
  const { code } = transformSync(source, {
    filename: modulePath,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
    plugins: ['babel-plugin-transform-import-meta', 'babel-plugin-istanbul'],
    sourceMaps: 'inline',
    sourceFileName: modulePath,
    babelrc: false,
    configFile: false
  });

  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === '../config/runtime') {
      return runtimeMock;
    }
    if (request === '../firebase') {
      return { auth: mockAuth };
    }
    const resolved = path.resolve(path.dirname(modulePath), request);
    return jest.requireActual(resolved);
  };

  const factory = new Function('require', 'module', 'exports', code);
  factory(localRequire, module, module.exports);
  apiModule = module.exports;
});

describe('mongoDataApi.fetchReplies', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
    mockAuth.currentUser = null;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('throws when no pin id is provided', async () => {
    await expect(apiModule.fetchReplies()).rejects.toThrow('Pin id is required to load replies');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches replies with authorization headers when a user token is available', async () => {
    const token = 'token-123';
    const mockJson = jest.fn().mockResolvedValue([{ _id: 'reply-1' }]);
    mockAuth.currentUser = {
      getIdToken: jest.fn().mockResolvedValue(token)
    };
    global.fetch.mockResolvedValue({
      ok: true,
      json: mockJson
    });

    const result = await apiModule.fetchReplies('pin-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/pins/pin-123/replies',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );
    expect(result).toEqual([{ _id: 'reply-1' }]);
  });

  it('surface server error messages when the API responds with a failure', async () => {
    const mockJson = jest.fn().mockResolvedValue({ message: 'Server unavailable' });
    global.fetch.mockResolvedValue({
      ok: false,
      json: mockJson
    });

    await expect(apiModule.fetchReplies('pin-999')).rejects.toThrow('Server unavailable');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/pins/pin-999/replies',
      expect.any(Object)
    );
  });
});

describe('mongoDataApi additional endpoints', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
    mockAuth.currentUser = null;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('builds query params when fetching nearby pins', async () => {
    const json = jest.fn().mockResolvedValue([]);
    global.fetch.mockResolvedValue({ ok: true, json });
    await apiModule.fetchPinsNearby({
      latitude: 33.7,
      longitude: -118.1,
      distanceMiles: 5,
      limit: 25,
      search: '  cleanup ',
      types: ['event', 'discussion', ''],
      categories: ['Community', '', 'Outdoors'],
      status: 'active',
      startDate: '2025-03-01',
      endDate: '2025-03-15'
    });

    expect(global.fetch).toHaveBeenCalled();
    const [url, options] = global.fetch.mock.calls[0];
    expect(options).toMatchObject({ method: 'GET' });

    const parsed = new URL(url, 'https://example.com');
    const params = parsed.searchParams;
    expect(params.get('latitude')).toBe('33.7');
    expect(params.get('longitude')).toBe('-118.1');
    expect(params.get('distanceMiles')).toBe('5');
    expect(params.get('limit')).toBe('25');
    expect(params.get('search')).toBe('cleanup');
    expect(params.get('types')).toBe('event,discussion');
    expect(params.get('categories')).toBe('Community,Outdoors');
    expect(params.get('status')).toBe('active');
    expect(params.get('startDate')).toBe('2025-03-01');
    expect(params.get('endDate')).toBe('2025-03-15');
  });

  it('lists pins with filters applied', async () => {
    const json = jest.fn().mockResolvedValue([{ _id: 'pin-1' }]);
    global.fetch.mockResolvedValue({ ok: true, json });

    await apiModule.listPins({
      search: ' farmers market ',
      types: ['event'],
      categories: ['Food', 'Community'],
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      status: 'active',
      sort: 'distance',
      limit: 10,
      latitude: 10,
      longitude: 20
    });

    const [url] = global.fetch.mock.calls[0];
    const parsed = new URL(url, 'https://example.com');
    const params = parsed.searchParams;
    expect(params.get('search')).toBe('farmers market');
    expect(params.get('types')).toBe('event');
    expect(params.get('categories')).toBe('Food,Community');
    expect(params.get('startDate')).toBe('2025-01-01');
    expect(params.get('endDate')).toBe('2025-01-31');
    expect(params.get('status')).toBe('active');
    expect(params.get('sort')).toBe('distance');
    expect(params.get('limit')).toBe('10');
    expect(params.get('latitude')).toBe('10');
    expect(params.get('longitude')).toBe('20');
  });

  it('creates updates and surfaces structured errors', async () => {
    const successJson = jest.fn().mockResolvedValue({ _id: 'update-1' });
    global.fetch.mockResolvedValueOnce({ ok: true, json: successJson });

    await apiModule.createUpdate({
      userId: 'user-1',
      payload: { type: 'badge-earned', title: 'Congrats' }
    });

    expect(global.fetch).toHaveBeenCalled();
    const [createUrl, createOptions] = global.fetch.mock.calls[0];
    expect(createUrl).toBe('https://api.example.com/api/debug/updates');
    expect(createOptions).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        userId: 'user-1',
        payload: { type: 'badge-earned', title: 'Congrats' }
      })
    });

    const errorJson = jest.fn().mockResolvedValue({
      message: 'Invalid update payload',
      issues: [{ path: ['payload', 'title'], message: 'Required' }]
    });
    global.fetch.mockResolvedValueOnce({ ok: false, json: errorJson });

    await expect(
      apiModule.createUpdate({
        userId: 'user-2',
        payload: { type: 'badge-earned' }
      })
    ).rejects.toThrow('Invalid update payload: payload.title Required');
  });

  it('fetches updates for a user', async () => {
    const json = jest.fn().mockResolvedValue([{ _id: 'update-1' }]);
    global.fetch.mockResolvedValue({ ok: true, json });

    await apiModule.fetchUpdates({ userId: 'viewer-1', limit: 5 });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/updates?userId=viewer-1&limit=5');
  });

  it('marks updates as read', async () => {
    const json = jest.fn().mockResolvedValue({ _id: 'update-1', readAt: '2025-01-01T00:00:00.000Z' });
    global.fetch.mockResolvedValue({ ok: true, json });

    await apiModule.markUpdateRead('update-1');

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/updates/update-1/read');
    expect(global.fetch.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      headers: expect.any(Object)
    });
  });

  it('registers push tokens with optional platform metadata', async () => {
    const json = jest.fn().mockResolvedValue({ ok: true });
    global.fetch.mockResolvedValue({ ok: true, json });

    await apiModule.registerPushToken('abc123', { platform: 'web' });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/users/me/push-tokens');
    expect(global.fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ token: 'abc123', platform: 'web' })
    });
  });
});
