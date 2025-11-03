import {
  getParticipantId,
  getParticipantDisplayName,
  resolveAvatarSrc,
  resolveThreadParticipants
} from '../../src/utils/chatParticipants';

jest.mock('../../src/assets/AvatarIcon.svg', () => 'avatar-icon.svg');

describe('chatParticipants utilities', () => {
  it('derives participant identifiers from different inputs', () => {
    expect(getParticipantId('abc123')).toBe('abc123');
    expect(getParticipantId({ id: 'user-1' })).toBe('user-1');
    expect(getParticipantId({ _id: { $oid: 'mongo-id' } })).toBe('mongo-id');
    expect(getParticipantId(null)).toBeNull();
  });

  it('resolves display names with sensible fallbacks', () => {
    expect(getParticipantDisplayName('Direct Thread')).toBe('Direct Thread');
    expect(getParticipantDisplayName({ displayName: 'Alex' })).toBe('Alex');
    expect(getParticipantDisplayName({ username: 'alex123' })).toBe('alex123');
    expect(getParticipantDisplayName({})).toBe('');
  });

  it('normalizes avatar sources', () => {
    expect(resolveAvatarSrc(null)).toBe('avatar-icon.svg');
    expect(resolveAvatarSrc({ avatar: { url: 'https://cdn/app.png' } })).toBe('https://cdn/app.png');
    expect(resolveAvatarSrc({ avatarUrl: 'images/user.png' })).toBe('/images/user.png');
    expect(resolveAvatarSrc({ photoURL: 'data:image/png;base64,abc' })).toBe('data:image/png;base64,abc');
    expect(resolveAvatarSrc({ avatar: {} })).toBe('avatar-icon.svg');
  });

  it('filters out the viewer when resolving thread participants', () => {
    const participants = [
      { id: 'user-1', displayName: 'Alex' },
      { id: 'user-2', displayName: 'Sam' },
      { id: 'viewer', displayName: 'Viewer' }
    ];

    expect(resolveThreadParticipants({ participants }, 'viewer')).toEqual(['Alex', 'Sam']);
    expect(resolveThreadParticipants({ participants }, null)).toEqual(['Alex', 'Sam', 'Viewer']);
    expect(resolveThreadParticipants(null, 'viewer')).toEqual([]);
  });
});
