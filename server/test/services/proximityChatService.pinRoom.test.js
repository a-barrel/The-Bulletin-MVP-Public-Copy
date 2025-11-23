jest.mock('../../models/ProximityChat', () => {
  const roomDoc = {
    _id: '507f191e810c19729de860ea',
    ownerId: '507f1f77bcf86cd799439011',
    name: 'Pin 123',
    description: '',
    coordinates: { coordinates: [-118.1, 33.7] },
    radiusMeters: 500,
    participantCount: 0,
    participantIds: [],
    moderatorIds: [],
    pinId: '64b6f0b8f0f0f0f0f0f0f0f0',
    presetKey: 'pin-room',
    expiresAt: new Date('2025-01-01T00:00:00Z'),
    audit: {},
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    toObject() {
      return this;
    }
  };

  return {
    ProximityChatRoom: {
      findOneAndUpdate: jest.fn().mockResolvedValue(roomDoc),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 })
    },
    ProximityChatMessage: {},
    ProximityChatPresence: {}
  };
});

const { ProximityChatRoom } = require('../../models/ProximityChat');
const { upsertPinRoom, deletePinRoomByPinId } = require('../../services/proximityChatService');

describe('proximityChatService pin room helpers', () => {
  it('upserts a pin room with deterministic payload', async () => {
    const result = await upsertPinRoom({
      pinId: '64b6f0b8f0f0f0f0f0f0f0f0',
      pinType: 'event',
      pinTitle: 'Summer Concert',
      ownerId: '507f1f77bcf86cd799439011',
      latitude: 33.7,
      longitude: -118.1,
      expiresAt: '2025-01-01T00:00:00Z',
      radiusMeters: 500
    });

    expect(ProximityChatRoom.findOneAndUpdate).toHaveBeenCalledWith(
      { pinId: expect.anything() },
      expect.objectContaining({
        $set: expect.objectContaining({
          name: expect.stringContaining('Summer Concert'),
          presetKey: 'pin-room',
          radiusMeters: 500
        })
      }),
      expect.objectContaining({ upsert: true })
    );
    expect(result.pinId).toBe('64b6f0b8f0f0f0f0f0f0f0f0');
    expect(result.expiresAt).toBeTruthy();
  });

  it('deletes pin room by pin id', async () => {
    const result = await deletePinRoomByPinId('64b6f0b8f0f0f0f0f0f0f0f0');
    expect(ProximityChatRoom.deleteMany).toHaveBeenCalled();
    expect(result).toEqual({ deletedCount: 1 });
  });
});
