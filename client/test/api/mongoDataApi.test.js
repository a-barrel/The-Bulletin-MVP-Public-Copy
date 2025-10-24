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

let fetchReplies;

beforeAll(() => {
  const modulePath = path.resolve(__dirname, '../../src/api/mongoDataApi.js');
  const rawSource = fs.readFileSync(modulePath, 'utf8');
  const source = rawSource
    .replace(/import\.meta\.env\.DEV/g, 'false')
    .replace(/import\.meta\.env/g, '{}')
    .replace(/import\.meta/g, '{}');
  const { code } = transformSync(source, {
    filename: 'mongoDataApi.js',
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
    plugins: ['babel-plugin-transform-import-meta'],
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
  fetchReplies = module.exports.fetchReplies;
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
    await expect(fetchReplies()).rejects.toThrow('Pin id is required to load replies');
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

    const result = await fetchReplies('pin-123');

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

    await expect(fetchReplies('pin-999')).rejects.toThrow('Server unavailable');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/pins/pin-999/replies',
      expect.any(Object)
    );
  });
});
