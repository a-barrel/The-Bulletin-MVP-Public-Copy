const mongoose = require('mongoose');

jest.mock('../../models/User', () => ({
  updateOne: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../../services/updateFanoutService', () => ({
  broadcastBadgeEarned: jest.fn()
}));

const User = require('../../models/User');
const { broadcastBadgeEarned } = require('../../services/updateFanoutService');
const {
  listBadges,
  resolveBadge,
  grantBadge,
  revokeBadge,
  resetBadges,
  getBadgeStatusForUser
} = require('../../services/badgeService');

describe('badgeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists known badges immutably', () => {
    const badges = listBadges();
    expect(badges).toHaveLength(6);
    badges[0].label = 'mutated';

    const next = listBadges();
    expect(next[0].label).not.toBe('mutated');
  });

  it('resolves badge definitions and throws when missing', () => {
    expect(resolveBadge('enter-debug-console')).toMatchObject({ label: 'Debugger' });
    expect(() => resolveBadge('unknown-badge')).toThrow('Unknown badge');
  });

  it('grants a badge and broadcasts an update when modified', async () => {
    const userId = new mongoose.Types.ObjectId();
    User.updateOne.mockResolvedValue({ modifiedCount: 1 });
    User.findById.mockResolvedValue({ badges: ['enter-debug-console'] });

    const result = await grantBadge({ userId: userId.toHexString(), badgeId: 'enter-debug-console' });

    expect(result).toMatchObject({ granted: true, badges: ['enter-debug-console'] });
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: userId, badges: { $ne: 'enter-debug-console' } },
      { $addToSet: { badges: 'enter-debug-console' } }
    );
    expect(broadcastBadgeEarned).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        badge: expect.objectContaining({ id: 'enter-debug-console' })
      })
    );
  });

  it('does not broadcast when badge already owned', async () => {
    const userId = new mongoose.Types.ObjectId();
    User.updateOne.mockResolvedValue({ modifiedCount: 0 });
    User.findById.mockResolvedValue({ badges: ['enter-debug-console'] });

    const result = await grantBadge({ userId: userId.toHexString(), badgeId: 'enter-debug-console' });

    expect(result.granted).toBe(false);
    expect(broadcastBadgeEarned).not.toHaveBeenCalled();
  });

  it('revokes a badge and returns the updated list', async () => {
    const userId = new mongoose.Types.ObjectId();
    User.updateOne.mockResolvedValue({ modifiedCount: 1 });
    User.findById.mockResolvedValue({ badges: [] });

    const result = await revokeBadge({ userId: userId.toHexString(), badgeId: 'enter-debug-console' });

    expect(result).toMatchObject({ revoked: true, badges: [] });
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(mongoose.Types.ObjectId) },
      { $pull: { badges: 'enter-debug-console' } }
    );
  });

  it('resets badges for a user', async () => {
    const userId = new mongoose.Types.ObjectId();
    User.updateOne.mockResolvedValue({});

    const result = await resetBadges(userId.toHexString());

    expect(result).toEqual({ badges: [], reset: true });
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(mongoose.Types.ObjectId) },
      { $set: { badges: [] } }
    );
  });

  it('returns badge status snapshot for a user', async () => {
    const userDoc = {
      _id: new mongoose.Types.ObjectId(),
      username: 'alex',
      displayName: 'Alex',
      badges: ['bookmark-first-pin']
    };
    User.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(userDoc)
    });

    const snapshot = await getBadgeStatusForUser(userDoc._id.toHexString());

    expect(snapshot.user).toMatchObject({ username: 'alex', displayName: 'Alex' });
    const earnedBadge = snapshot.badges.find((badge) => badge.id === 'bookmark-first-pin');
    expect(earnedBadge.earned).toBe(true);
    const unearned = snapshot.badges.find((badge) => badge.id === 'chat-first-message');
    expect(unearned.earned).toBe(false);
  });
});
