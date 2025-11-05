describe('resolveAssetUrl offline host handling', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('rewrites localhost:5000 assets to relative paths when no API base is set', async () => {
    jest.doMock('../../config/runtime', () => ({
      __esModule: true,
      default: {
        apiBaseUrl: '',
        isOffline: true
      }
    }));

    const { default: resolveAssetUrl } = await import('../media.js');
    const result = resolveAssetUrl('http://localhost:5000/images/profile/profile-01.jpg');
    expect(result).toBe('/images/profile/profile-01.jpg');
  });

  test('uses the configured API base URL when not running offline', async () => {
    jest.doMock('../../config/runtime', () => ({
      __esModule: true,
      default: {
        apiBaseUrl: 'http://localhost:8000',
        isOffline: false
      }
    }));

    const { default: resolveAssetUrl } = await import('../media.js');
    const result = resolveAssetUrl('images/background/background-01.jpg');
    expect(result).toBe('http://localhost:8000/images/background/background-01.jpg');
  });

  test('leaves external or data URLs untouched', async () => {
    jest.doMock('../../config/runtime', () => ({
      __esModule: true,
      default: {
        apiBaseUrl: '',
        isOffline: false
      }
    }));

    const { default: resolveAssetUrl } = await import('../media.js');
    expect(resolveAssetUrl('https://cdn.example.com/photo.png')).toBe('https://cdn.example.com/photo.png');
    const dataUrl = 'data:image/png;base64,AAA';
    expect(resolveAssetUrl(dataUrl)).toBe(dataUrl);
  });
});
