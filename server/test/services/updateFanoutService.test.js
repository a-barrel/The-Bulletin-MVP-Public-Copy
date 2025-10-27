const mongoose = require('mongoose');

jest.mock('../../models/Update', () => ({
  insertMany: jest.fn()
}));

jest.mock('../../models/User', () => ({
  find: jest.fn()
}));

jest.mock('../../models/Pin', () => ({}));

jest.mock('../../schemas/pin', () => ({
  PinPreviewSchema: {
    parse: jest.fn((value) => value)
  }
}));

const Update = require('../../models/Update');
const User = require('../../models/User');
const { PinPreviewSchema } = require('../../schemas/pin');
const { broadcastPinCreated } = require('../../services/updateFanoutService');

describe('updateFanoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createObjectId = () => new mongoose.Types.ObjectId();

  it('creates update entries for followers and creator respecting preferences', async () => {
    const followerAllowed = createObjectId();
    const followerBlocked = createObjectId();
    const creatorId = createObjectId();

    const creatorDoc = {
      _id: creatorId,
      displayName: 'Alex Rivera',
      relationships: {
        followerIds: [followerAllowed, followerBlocked]
      }
    };

    const pinDoc = {
      _id: createObjectId(),
      title: 'Community Cleanup',
      type: 'event',
      description: 'Let’s clean the beach.',
      creatorId: creatorDoc,
      coordinates: { type: 'Point', coordinates: [-118.1, 33.8] },
      proximityRadiusMeters: 3218,
      toObject: () => pinDoc
    };

    User.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: followerAllowed, preferences: { notifications: { updates: true } } },
        { _id: followerBlocked, preferences: { notifications: { updates: false } } },
        { _id: creatorId, preferences: { notifications: { updates: true } } }
      ])
    });

    Update.insertMany.mockResolvedValue();

    await broadcastPinCreated(pinDoc);

    expect(PinPreviewSchema.parse).toHaveBeenCalled();
    expect(Update.insertMany).toHaveBeenCalledTimes(1);

    const [updates] = Update.insertMany.mock.calls[0];
    const userIds = updates.map((item) => item.userId.toString());

    expect(userIds).toHaveLength(2);
    expect(userIds).toContain(followerAllowed.toString());
    expect(userIds).toContain(creatorId.toString());

    updates.forEach((update) => {
      expect(update.payload.type).toBe('new-pin');
      expect(update.payload.title).toMatch(/posted/);
    });
  });
});
