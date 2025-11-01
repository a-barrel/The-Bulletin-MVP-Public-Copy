const { applyModerationAction } = require('../../services/moderationActionService');

jest.mock('../../models/User', () => ({
  findByIdAndUpdate: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../../models/ModerationAction', () => ({
  create: jest.fn()
}));

const User = require('../../models/User');
const ModerationAction = require('../../models/ModerationAction');

describe('applyModerationAction', () => {
  const viewer = { _id: '64a6b5df0000000000000001' };
  const target = { _id: '64a6b5df0000000000000002' };

  beforeEach(() => {
    jest.clearAllMocks();

    User.findByIdAndUpdate.mockResolvedValue(null);

    const selectMock = jest.fn().mockReturnThis();
    const leanMock = jest.fn().mockResolvedValue({
      _id: target._id,
      displayName: 'Target User'
    });
    User.findById.mockReturnValue({
      select: selectMock,
      lean: leanMock
    });

    ModerationAction.create.mockResolvedValue({
      toObject: () => ({
        _id: 'action-123',
        type: 'mute'
      })
    });
  });

  it('applies mute actions with duration and records moderation entry', async () => {
    await applyModerationAction({
      viewer,
      target,
      type: 'mute',
      reason: 'Take a break',
      durationMinutes: 5
    });

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(expect.anything(), {
      $addToSet: { 'relationships.mutedUserIds': expect.anything() }
    });

    expect(ModerationAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.anything(),
        moderatorId: expect.anything(),
        type: 'mute',
        reason: 'Take a break',
        expiresAt: expect.any(Date)
      })
    );

    expect(User.findById).toHaveBeenCalledWith(expect.anything());
  });

  it('updates relationship graphs when blocking a user', async () => {
    await applyModerationAction({
      viewer,
      target,
      type: 'block'
    });

    expect(User.findByIdAndUpdate).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        $addToSet: { 'relationships.blockedUserIds': expect.anything() },
        $pull: expect.objectContaining({
          'relationships.friendIds': expect.anything()
        })
      }),
      expect.any(Object)
    );

    expect(User.findByIdAndUpdate).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        $pull: expect.objectContaining({
          'relationships.friendIds': expect.anything()
        })
      })
    );
  });

  it('throws for unsupported moderation types', async () => {
    await expect(
      applyModerationAction({
        viewer,
        target,
        type: 'invalid'
      })
    ).rejects.toThrow(/Unsupported moderation action/);
  });
});
