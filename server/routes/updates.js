const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const Update = require('../models/Update');
const User = require('../models/User');
const { UpdateSchema } = require('../schemas/update');
const { PinPreviewSchema } = require('../schemas/pin');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const UpdatesQuerySchema = z.object({
  userId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid user id'
  }),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

const UpdateIdSchema = z.object({
  updateId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid update id'
  })
});

const mapPinPreview = (preview) => {
  if (!preview) return undefined;
  return PinPreviewSchema.parse({
    _id: preview._id.toString(),
    type: preview.type,
    creatorId: preview.creatorId.toString(),
    creator: preview.creator,
    title: preview.title,
    coordinates: preview.coordinates,
    proximityRadiusMeters: preview.proximityRadiusMeters,
    linkedLocationId: preview.linkedLocationId ? preview.linkedLocationId.toString() : undefined,
    linkedChatRoomId: preview.linkedChatRoomId ? preview.linkedChatRoomId.toString() : undefined,
    startDate: preview.startDate ? new Date(preview.startDate).toISOString() : undefined,
    endDate: preview.endDate ? new Date(preview.endDate).toISOString() : undefined,
    expiresAt: preview.expiresAt ? new Date(preview.expiresAt).toISOString() : undefined
  });
};

const mapUpdate = (update) => {
  const doc = update.toObject();
  return UpdateSchema.parse({
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    sourceUserId: doc.sourceUserId ? doc.sourceUserId.toString() : undefined,
    targetUserIds: (doc.targetUserIds || []).map((id) => id.toString()),
    payload: {
      type: doc.payload.type,
      pin: doc.payload.pin ? mapPinPreview(doc.payload.pin) : undefined,
      title: doc.payload.title,
      body: doc.payload.body || undefined,
      metadata: doc.payload.metadata || undefined,
      relatedEntities: (doc.payload.relatedEntities || []).map((entity) => ({
        id: entity.id.toString(),
        type: entity.type,
        label: entity.label || undefined,
        summary: entity.summary || undefined
      }))
    },
    createdAt: doc.createdAt.toISOString(),
    deliveredAt: doc.deliveredAt ? doc.deliveredAt.toISOString() : undefined,
    readAt: doc.readAt ? doc.readAt.toISOString() : undefined
  });
};

const resolveViewerUser = async (req) => {
  if (!req?.user?.uid) {
    return null;
  }

  try {
    const viewer = await User.findOne({ firebaseUid: req.user.uid });
    return viewer;
  } catch (error) {
    console.error('Failed to resolve viewer user for updates route:', error);
    return null;
  }
};

router.get('/', verifyToken, async (req, res) => {
  try {
    const query = UpdatesQuerySchema.parse(req.query);
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (viewer._id.toString() !== query.userId) {
      return res.status(403).json({ message: 'You do not have access to these updates' });
    }

    const updates = await Update.find({ userId: query.userId })
      .sort({ createdAt: -1 })
      .limit(query.limit);

    const payload = updates.map(mapUpdate);
    res.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid updates query', issues: error.errors });
    }
    res.status(500).json({ message: 'Failed to load updates' });
  }
});

router.patch('/mark-all-read', verifyToken, async (req, res) => {
  try {
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const result = await Update.updateMany(
      { userId: viewer._id, readAt: { $exists: false } },
      { $set: { readAt: now } }
    );

    res.json({
      updatedCount: result.modifiedCount ?? result.nModified ?? 0,
      readAt: now.toISOString()
    });
  } catch (error) {
    console.error('Failed to mark all updates read:', error);
    res.status(500).json({ message: 'Failed to mark updates as read' });
  }
});

router.patch('/:updateId/read', verifyToken, async (req, res) => {
  try {
    const { updateId } = UpdateIdSchema.parse(req.params);
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    const update = await Update.findOneAndUpdate(
      { _id: updateId, userId: viewer._id },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    if (!update) {
      return res.status(404).json({ message: 'Update not found' });
    }

    res.json(mapUpdate(update));
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid update identifier', issues: error.errors });
    }
    console.error('Failed to mark update read:', error);
    res.status(500).json({ message: 'Failed to mark update as read' });
  }
});

module.exports = router;
