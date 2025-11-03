const {
  normalizeMediaUrl,
  mapMediaAsset,
  mapUserAvatar,
  normalizeProfileImagePath
} = require('../../utils/media');

describe('server/utils/media', () => {
  test('normalizeMediaUrl handles absolute and relative paths', () => {
    expect(normalizeMediaUrl(' https://example.com/img.png ')).toBe('https://example.com/img.png');
    expect(normalizeMediaUrl('path/to.png')).toBe('http://localhost:5000/path/to.png');
    expect(normalizeMediaUrl('')).toBeUndefined();
  });

  test('normalizeProfileImagePath promotes legacy png profile paths to jpg', () => {
    expect(normalizeProfileImagePath('/images/profile/profile-01.png')).toBe('/images/profile/profile-01.jpg');
    expect(normalizeProfileImagePath('images/profile/profile-02.png')).toBe('images/profile/profile-02.jpg');
    expect(normalizeProfileImagePath('https://example.com/asset.png')).toBe('https://example.com/asset.png');
  });

  test('mapMediaAsset maps core fields', () => {
    const asset = {
      url: 'image.png',
      thumbnailUrl: 'thumb.png',
      width: 400,
      height: 300,
      mimeType: 'image/png',
      description: 'demo',
      uploadedAt: '2024-01-01T00:00:00Z',
      uploadedBy: '507f1f77bcf86cd799439011'
    };

    const mapped = mapMediaAsset(asset);
    expect(mapped).toEqual({
      url: 'http://localhost:5000/image.png',
      thumbnailUrl: 'http://localhost:5000/thumb.png',
      width: 400,
      height: 300,
      mimeType: 'image/png',
      description: 'demo',
      uploadedAt: '2024-01-01T00:00:00.000Z',
      uploadedBy: '507f1f77bcf86cd799439011'
    });
  });

  test('mapUserAvatar returns existing avatar when available', () => {
    const user = {
      username: 'someone',
      avatar: {
        url: 'https://example.com/real.png',
        width: 128,
        height: 128
      }
    };

    expect(mapUserAvatar(user)).toEqual({
      url: 'https://example.com/real.png',
      thumbnailUrl: undefined,
      width: 128,
      height: 128,
      mimeType: undefined,
      description: undefined,
      uploadedAt: undefined,
      uploadedBy: undefined
    });
  });

  test('mapUserAvatar falls back to TF2 avatar when appropriate', () => {
    const user = {
      username: 'TF2_SCOUT',
      avatar: null
    };

    expect(mapUserAvatar(user)).toEqual({
      url: 'http://localhost:5000/images/emulation/avatars/Scoutava.jpg',
      thumbnailUrl: 'http://localhost:5000/images/emulation/avatars/Scoutava.jpg',
      width: 184,
      height: 184,
      mimeType: 'image/jpeg'
    });
  });
});
