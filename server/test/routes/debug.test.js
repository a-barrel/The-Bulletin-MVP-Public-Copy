const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../../middleware/verifyToken', () =>
  jest.fn((req, _res, next) => {
    req.user = { uid: 'test-viewer' };
    next();
  })
);

jest.mock('../../models/Update', () => ({
  create: jest.fn()
}));

const debugRouter = require('../../routes/debug');
const Update = require('../../models/Update');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/debug', debugRouter);
  return app;
};

describe('debug routes - updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates chat message updates with related entities', async () => {
    const userId = new mongoose.Types.ObjectId();
    const threadId = new mongoose.Types.ObjectId();
    const viewerId = new mongoose.Types.ObjectId();

    const updateDoc = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      sourceUserId: viewerId,
      targetUserIds: [],
      payload: {
        type: 'chat-message',
        title: 'New direct message',
        body: 'You received a new message.',
        metadata: { threadId: threadId.toHexString() },
        relatedEntities: [
          { id: threadId.toHexString(), type: 'chat-room', label: 'Direct thread' },
          { id: userId.toHexString(), type: 'user', label: 'Recipient' }
        ]
      },
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      deliveredAt: null,
      readAt: null,
      toObject() {
        return {
          _id: this._id,
          userId: this.userId,
          sourceUserId: this.sourceUserId,
          targetUserIds: this.targetUserIds,
          payload: this.payload,
          deliveredAt: this.deliveredAt,
          readAt: this.readAt
        };
      }
    };

    Update.create.mockResolvedValue(updateDoc);

    const res = await request(createApp()).post('/api/debug/updates').send({
      userId: userId.toHexString(),
      sourceUserId: viewerId.toHexString(),
      payload: {
        type: 'chat-message',
        title: 'New direct message',
        body: 'You received a new message.',
        metadata: { threadId: threadId.toHexString() },
        relatedEntities: [
          { id: threadId.toHexString(), type: 'chat-room', label: 'Direct thread' },
          { id: userId.toHexString(), type: 'user', label: 'Recipient' }
        ]
      }
    });

    expect(res.status).toBe(201);
    expect(Update.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(mongoose.Types.ObjectId),
        payload: expect.objectContaining({
          type: 'chat-message',
          title: 'New direct message',
          relatedEntities: expect.arrayContaining([
            expect.objectContaining({ type: 'chat-room' }),
            expect.objectContaining({ type: 'user' })
          ])
        })
      })
    );
    expect(res.body).toMatchObject({
      payload: expect.objectContaining({
        type: 'chat-message',
        relatedEntities: [
          expect.objectContaining({ type: 'chat-room', label: 'Direct thread' }),
          expect.objectContaining({ type: 'user', label: 'Recipient' })
        ]
      })
    });
  });
});
