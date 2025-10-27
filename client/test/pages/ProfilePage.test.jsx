import { pageConfig } from '../../src/pages/ProfilePage';

jest.mock('../../src/config/runtime', () => ({
  __esModule: true,
  default: {
    apiBaseUrl: '',
    isOffline: true,
    isOnline: false,
    firebase: { config: {}, authEmulatorUrl: undefined }
  }
}));

jest.mock('../../src/api/mongoDataApi', () => ({}));

describe('ProfilePage pageConfig.resolveNavTarget', () => {
  const { resolveNavTarget } = pageConfig;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns current path when the prompt is cancelled', () => {
    jest.spyOn(window, 'prompt').mockReturnValue(null);
    const result = resolveNavTarget({ currentPath: '/profile/me' });
    expect(result).toBe('/profile/me');
  });

  it('defaults to the viewer profile when prompt is blank or "me"', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('   ');
    expect(resolveNavTarget()).toBe('/profile/me');

    jest.spyOn(window, 'prompt').mockReturnValue('Me');
    expect(resolveNavTarget()).toBe('/profile/me');
  });

  it('returns already-prefixed profile routes untouched', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('/profile/alex');
    expect(resolveNavTarget()).toBe('/profile/alex');
  });

  it('normalizes relative profile segments by prefixing a slash', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('profile/team-42');
    expect(resolveNavTarget()).toBe('/profile/team-42');
  });

  it('sanitizes arbitrary input by trimming leading slashes', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('///guest-user');
    expect(resolveNavTarget()).toBe('/profile/guest-user');
  });
});
