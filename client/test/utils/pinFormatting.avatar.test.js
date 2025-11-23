jest.mock('../../src/config/runtime', () => ({
  __esModule: true,
  default: {
    apiBaseUrl: 'https://cdn.example.com',
    isOffline: false
  }
}));

import { resolveUserAvatarUrl, DEFAULT_AVATAR_PATH } from '../../src/utils/pinFormatting';

describe('resolveUserAvatarUrl (host avatars)', () => {
  it('prefers explicit avatar url', () => {
    const url = 'https://images.example.com/host.png';
    expect(resolveUserAvatarUrl({ avatar: { url } })).toBe(url);
  });

  it('handles avatar path objects by prefixing base url', () => {
    const result = resolveUserAvatarUrl({ avatar: { path: '/uploads/host.png' } });
    expect(result).toBe('https://cdn.example.com/uploads/host.png');
  });

  it('falls back to default avatar path when missing', () => {
    expect(resolveUserAvatarUrl({ username: 'test-user' })).toBe(
      `https://cdn.example.com${DEFAULT_AVATAR_PATH}`
    );
  });
});
