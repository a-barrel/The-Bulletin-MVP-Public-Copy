const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');
const Update = require('../models/Update');
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

router.get('/', verifyToken, async (req, res) => {
  try {
    const query = UpdatesQuerySchema.parse(req.query);
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

module.exports = router;
