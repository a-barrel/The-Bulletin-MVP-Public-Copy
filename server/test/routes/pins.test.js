const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../../middleware/verifyToken', () =>
  jest.fn((req, _res, next) => {
    req.user = { uid: 'viewer-uid' };
    next();
  })
);

jest.mock('../../models/Pin', () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
  findById: jest.fn(),
  populate: jest.fn(),
  hydrate: jest.fn()
}));

jest.mock('../../models/User', () => ({
  findOne: jest.fn()
}));

jest.mock('../../services/analyticsService', () => ({
  trackEvent: jest.fn()
}));

const pinsRouter = require('../../routes/pins');
const Pin = require('../../models/Pin');
const User = require('../../models/User');
const { trackEvent } = require('../../services/analyticsService');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/pins', pinsRouter);
  return app;
};

describe('pins routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    User.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      relationships: { blockedUserIds: [] }
    });
  });

  it('returns aggregated categories', async () => {
    Pin.aggregate.mockResolvedValue([
      { _id: 'music', count: 5 },
      { _id: 'sports', count: 2 }
    ]);

    const res = await request(createApp()).get('/api/pins/categories');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { name: 'music', count: 5 },
      { name: 'sports', count: 2 }
    ]);
  });

  it('increments share counts and records analytics events', async () => {
    const pinId = new mongoose.Types.ObjectId();
    const creatorId = new mongoose.Types.ObjectId();

    const creatorDoc = {
      _id: creatorId,
      displayName: 'Creator',
      username: 'creator',
      relationships: { blockedUserIds: [] },
      toObject() {
        return {
          _id: creatorId,
          displayName: 'Creator',
          username: 'creator',
          avatar: null,
          stats: {},
          relationships: { blockedUserIds: [] }
        };
      }
    };

    const pinDoc = {
      _id: pinId,
      type: 'event',
      creatorId: creatorDoc,
      title: 'Community Meetup',
      description: 'Meet your neighbours',
      coordinates: { coordinates: [-118.1937, 33.7701], accuracy: 5 },
      proximityRadiusMeters: 100,
      photos: [],
      coverPhoto: null,
      tagIds: [],
      tags: [],
      relatedPinIds: [],
      linkedLocationId: null,
      linkedChatRoomId: null,
      visibility: 'public',
      isActive: true,
      bookmarkCount: 0,
      replyCount: 0,
      stats: { bookmarkCount: 0, replyCount: 0, shareCount: 0, viewCount: 0 },
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return {
          _id: pinId,
          type: 'event',
          creatorId,
          title: this.title,
          description: this.description,
          coordinates: { coordinates: this.coordinates.coordinates, accuracy: this.coordinates.accuracy },
          proximityRadiusMeters: this.proximityRadiusMeters,
          photos: [],
          coverPhoto: null,
          tagIds: [],
          tags: [],
          relatedPinIds: [],
          linkedLocationId: null,
          linkedChatRoomId: null,
          visibility: 'public',
          isActive: true,
          stats: this.stats,
          bookmarkCount: this.bookmarkCount,
          replyCount: this.replyCount
        };
      }
    };

    Pin.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(pinDoc)
    });

    const res = await request(createApp())
      .post(`/api/pins/${pinId}/share`)
      .send({ platform: 'web', method: 'share-button' });

    expect(res.status).toBe(201);
    expect(pinDoc.shareCount).toBe(1);
    expect(pinDoc.stats.shareCount).toBe(1);
    expect(pinDoc.markModified).toHaveBeenCalledWith('stats');
    expect(pinDoc.save).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'pin-share',
        payload: expect.objectContaining({ platform: 'web', method: 'share-button' })
      })
    );
  });

  it('applies filters when listing pins', async () => {
    const queryChain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue([
        {
          creatorId: {
            _id: new mongoose.Types.ObjectId(),
            displayName: 'Creator',
            username: 'creator',
            relationships: { blockedUserIds: [] },
            toObject() {
              return {
                _id: this._id,
                displayName: 'Creator',
                username: 'creator',
                avatar: null,
                stats: {},
                relationships: { blockedUserIds: [] }
              };
            }
          },
          type: 'event',
          title: 'Filtered pin',
          description: 'Details',
          coordinates: { coordinates: [-118, 34], accuracy: 4 },
          proximityRadiusMeters: 100,
          photos: [],
          coverPhoto: null,
          tagIds: [],
          tags: ['music'],
          relatedPinIds: [],
          linkedLocationId: null,
          linkedChatRoomId: null,
          visibility: 'public',
          isActive: true,
          bookmarkCount: 0,
          replyCount: 0,
          stats: { bookmarkCount: 0, replyCount: 0, shareCount: 0, viewCount: 0 },
          toObject() {
            return {
              _id: new mongoose.Types.ObjectId(),
              type: 'event',
              creatorId: this.creatorId._id,
              title: this.title,
              description: this.description,
              coordinates: { coordinates: this.coordinates.coordinates, accuracy: this.coordinates.accuracy },
              proximityRadiusMeters: this.proximityRadiusMeters,
              photos: [],
              coverPhoto: null,
              tagIds: [],
              tags: this.tags,
              relatedPinIds: [],
              linkedLocationId: null,
              linkedChatRoomId: null,
              visibility: 'public',
              isActive: true,
              stats: this.stats,
              bookmarkCount: this.bookmarkCount,
              replyCount: this.replyCount
            };
          }
        }
      ])
    };

    Pin.find.mockReturnValue(queryChain);

    const res = await request(createApp()).get(
      '/api/pins?limit=5&status=expired&types=event,discussion&categories=music&startDate=2024-01-01&endDate=2024-01-31&search=party'
    );

    expect(res.status).toBe(200);
    expect(Pin.find).toHaveBeenCalled();

    const matchQuery = Pin.find.mock.calls[0][0];
    expect(matchQuery.$and).toEqual(expect.arrayContaining([expect.any(Object)]));
    expect(queryChain.sort).toHaveBeenCalledWith({ updatedAt: -1, _id: -1 });
    expect(queryChain.limit).toHaveBeenCalledWith(5);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Filtered pin');
  });
});
