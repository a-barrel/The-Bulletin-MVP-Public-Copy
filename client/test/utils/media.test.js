jest.mock('../../src/config/runtime', () => ({
  __esModule: true,
  default: {
    apiBaseUrl: 'https://cdn.example.com',
    isOffline: false
  }
}));

import resolveAssetUrl from '../../src/utils/media';

describe('utils/media', () => {
  test('returns fallback for empty values', () => {
    expect(resolveAssetUrl(null, { fallback: '/placeholder.png' })).toBe('/placeholder.png');
  });

  test('returns absolute URLs unchanged', () => {
    const url = 'https://example.com/image.jpg';
    expect(resolveAssetUrl(url)).toBe(url);
  });

  test('prefixes relative paths with base URL', () => {
    expect(resolveAssetUrl('images/photo.jpg')).toBe('https://cdn.example.com/images/photo.jpg');
    expect(resolveAssetUrl('/images/photo.jpg')).toBe('https://cdn.example.com/images/photo.jpg');
  });

  test('resolves from asset objects', () => {
    const asset = {
      thumbnailUrl: 'thumb.jpg',
      url: 'image.jpg'
    };
    expect(resolveAssetUrl(asset)).toBe('https://cdn.example.com/thumb.jpg');
  });

  test('allows overriding base URL and keys', () => {
    const asset = { path: 'custom/path.png' };
    const result = resolveAssetUrl(asset, { baseUrl: 'https://static.example.org', keys: ['previewUrl', 'path'] });
    expect(result).toBe('https://static.example.org/custom/path.png');
  });
});
