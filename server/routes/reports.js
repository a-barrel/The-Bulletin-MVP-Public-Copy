const express = require('express');
const mongoose = require('mongoose');
const { z, ZodError } = require('zod');

const verifyToken = require('../middleware/verifyToken');
const User = require('../models/User');
const Pin = require('../models/Pin');
const Reply = require('../models/Reply');
const { ProximityChatMessage } = require('../models/ProximityChat');
const DirectMessageThread = require('../models/DirectMessageThread');
const ContentReport = require('../models/ContentReport');
const { toIdString, mapIdList } = require('../utils/ids');
const { REPORT_OFFENSE_OPTIONS } = require('../constants/reportOffenseOptions');

const router = express.Router();

const ReportOffenseEnum = z.enum(REPORT_OFFENSE_OPTIONS);

const ReportContentSchema = z.object({
  contentType: z.enum(['pin', 'reply', 'chat-message', 'direct-message', 'user']),
  contentId: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
  context: z.string().trim().max(1000).optional(),
  offenses: z.array(ReportOffenseEnum).max(10).optional()
});

const toObjectId = (value) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);

const toObjectIdList = (values = []) => values.filter(Boolean).map((value) => toObjectId(value));

const resolveViewerUser = async (req) => {
  if (!req?.user?.uid) {
    return null;
  }

  try {
    const viewer = await User.findOne({ firebaseUid: req.user.uid });
    return viewer;
  } catch (error) {
    console.error('Failed to resolve viewer for report submission:', error);
    return null;
  }
};

const mapUserSummary = (userDoc) => {
  if (!userDoc) {
    return null;
  }
  return {
    id: toIdString(userDoc._id),
    displayName: userDoc.displayName || null,
    username: userDoc.username || null,
    roles: Array.isArray(userDoc.roles)
      ? userDoc.roles.map((role) => (typeof role === 'string' ? role.toLowerCase() : '')).filter(Boolean)
      : []
  };
};

const mapReportResponse = (reportDoc, usersById = new Map()) => ({
  id: toIdString(reportDoc._id),
  contentType: reportDoc.contentType,
  contentId: reportDoc.contentId,
  status: reportDoc.status,
  reason: reportDoc.reason || '',
  context: reportDoc.context || '',
  offenseTags: Array.isArray(reportDoc.offenseTags) ? reportDoc.offenseTags : [],
  latestSnapshot: reportDoc.latestSnapshot || null,
  reporter: usersById.get(toIdString(reportDoc.reporterId)) || null,
  contentAuthor: usersById.get(toIdString(reportDoc.contentAuthorId)) || null,
  resolution: reportDoc.resolvedAt
    ? {
        resolvedAt: reportDoc.resolvedAt.toISOString(),
        resolvedBy: usersById.get(toIdString(reportDoc.resolvedById)) || null,
        notes: reportDoc.resolutionNotes || ''
      }
    : null,
  createdAt: reportDoc.createdAt.toISOString(),
  updatedAt: reportDoc.updatedAt ? reportDoc.updatedAt.toISOString() : reportDoc.createdAt.toISOString()
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const input = ReportContentSchema.parse(req.body);
    const offenseTags = Array.isArray(input.offenses) ? Array.from(new Set(input.offenses)) : [];
    const viewer = await resolveViewerUser(req);
    if (!viewer) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    const viewerIdString = toIdString(viewer._id);

    const viewerBlockedSet = new Set(mapIdList(viewer.relationships?.blockedUserIds));
    if (viewerBlockedSet.size > 500) {
      // Avoid pathological cases if block lists grow unexpectedly.
      console.warn(`Viewer ${viewerIdString} has unusually large blocked list:`, viewerBlockedSet.size);
    }

    const rateLimitKey = `report:${viewerIdString}:${input.contentType}:${input.contentId}`;
    const now = Date.now();
    const cooldownMs = 3 * 1000; // reduced cooldown for demo
    if (!router._rateLimitCache) {
      router._rateLimitCache = new Map();
    }
    const lastReportedAt = router._rateLimitCache.get(rateLimitKey) || 0;
    if (now - lastReportedAt < cooldownMs) {
      const retryAfter = Math.ceil((cooldownMs - (now - lastReportedAt)) / 1000);
      return res.status(429).json({
        message: 'You recently reported this content. Please wait a moment before trying again.',
        retryAfter
      });
    }
    router._rateLimitCache.set(rateLimitKey, now);

    let authorId = null;
    let snapshot = {};
    let metadata = {};

    if (input.contentType === 'pin') {
      if (!mongoose.Types.ObjectId.isValid(input.contentId)) {
        return res.status(400).json({ message: 'Invalid pin identifier.' });
      }
      const pin = await Pin.findById(input.contentId).populate({
        path: 'creatorId',
        select: 'displayName username roles relationships blockedUserIds'
      });
      if (!pin) {
        return res.status(404).json({ message: 'Pin not found.' });
      }
      authorId = pin.creatorId?._id;
      metadata = {
        pinId: toIdString(pin._id),
        title: pin.title || null
      };
      snapshot = {
        message: pin.description || '',
        metadata
      };
    } else if (input.contentType === 'reply') {
      if (!mongoose.Types.ObjectId.isValid(input.contentId)) {
        return res.status(400).json({ message: 'Invalid reply identifier.' });
      }
      const reply = await Reply.findById(input.contentId).populate({
        path: 'authorId',
        select: 'displayName username roles relationships blockedUserIds'
      });
      if (!reply) {
        return res.status(404).json({ message: 'Reply not found.' });
      }
      authorId = reply.authorId?._id;
      metadata = {
        pinId: toIdString(reply.pinId),
        replyId: toIdString(reply._id)
      };
      snapshot = {
        message: reply.message || '',
        metadata
      };
    } else if (input.contentType === 'chat-message') {
      if (!mongoose.Types.ObjectId.isValid(input.contentId)) {
        return res.status(400).json({ message: 'Invalid message identifier.' });
      }
      const message = await ProximityChatMessage.findById(input.contentId).populate({
        path: 'authorId',
        select: 'displayName username roles relationships blockedUserIds'
      });
      if (!message) {
        return res.status(404).json({ message: 'Chat message not found.' });
      }
      authorId = message.authorId?._id;
      metadata = {
        roomId: toIdString(message.roomId),
        pinId: message.pinId ? toIdString(message.pinId) : null
      };
      snapshot = {
        message: message.message || '',
        metadata
      };
    } else if (input.contentType === 'direct-message') {
      if (!mongoose.Types.ObjectId.isValid(input.contentId)) {
        return res.status(400).json({ message: 'Invalid message identifier.' });
      }
      const thread = await DirectMessageThread.findOne({
        'messages._id': input.contentId,
        participants: viewer._id
      })
        .select({ participants: 1, messages: { $elemMatch: { _id: input.contentId } } })
        .lean();

      if (!thread || !Array.isArray(thread.messages) || thread.messages.length === 0) {
        return res.status(404).json({ message: 'Message not found or unavailable.' });
      }
      const message = thread.messages[0];
      authorId = message.senderId;
      metadata = {
        threadId: toIdString(thread._id),
        messageId: toIdString(message._id)
      };
      snapshot = {
        message: message.body || '',
        metadata
      };
    } else if (input.contentType === 'user') {
      let reportedUser = null;
      if (mongoose.Types.ObjectId.isValid(input.contentId)) {
        reportedUser = await User.findById(input.contentId);
      }

      if (reportedUser) {
        authorId = reportedUser._id;
        metadata = {
          userId: toIdString(reportedUser._id),
          displayName: reportedUser.displayName || null,
          username: reportedUser.username || null
        };
        snapshot = {
          message:
            reportedUser.bio ||
            `Reported user: ${reportedUser.displayName || reportedUser.username || 'User'}`,
          metadata
        };
      } else {
        // Allow reporting non-ObjectId user ids (demo accounts, external ids).
        authorId = viewer._id;
        metadata = {
          userId: input.contentId,
          displayName: input.context || null
        };
        snapshot = {
          message: input.reason || `Reported user: ${input.contentId}`,
          metadata
        };
      }
    } else {
      return res.status(400).json({ message: 'Unsupported content type.' });
    }

    if (!authorId) {
      return res.status(404).json({ message: 'Author not found for this content.' });
    }

    const authorIdString = toIdString(authorId);
    if (viewerBlockedSet.has(authorIdString)) {
      return res.status(403).json({ message: 'You have blocked this user. Unblock them to submit a report.' });
    }

    const existing = await ContentReport.findOne({
      contentType: input.contentType,
      contentId: input.contentId,
      reporterId: viewer._id,
      status: 'pending'
    });

    if (existing) {
      existing.reason = input.reason?.trim() || existing.reason;
      existing.context = input.context?.trim() || existing.context;
      existing.offenseTags = offenseTags;
      existing.latestSnapshot = snapshot;
      await existing.save();

      const referencedUsers = await User.find({
        _id: { $in: toObjectIdList([existing.reporterId, existing.contentAuthorId]) }
      }).select({ displayName: 1, username: 1, roles: 1 });

      const userLookup = new Map(referencedUsers.map((doc) => [toIdString(doc._id), mapUserSummary(doc)]));
      return res.status(200).json({
        report: mapReportResponse(existing, userLookup),
        message: 'Thanks! We already received your report and updated it with the latest details.'
      });
    }

    const report = await ContentReport.create({
      contentType: input.contentType,
      contentId: input.contentId,
      contentAuthorId: authorId,
      reporterId: viewer._id,
      status: 'pending',
      reason: input.reason?.trim() || '',
      context: input.context?.trim() || '',
      latestSnapshot: snapshot,
      offenseTags
    });

    const referencedUsers = await User.find({
      _id: { $in: toObjectIdList([report.reporterId, report.contentAuthorId]) }
    }).select({ displayName: 1, username: 1, roles: 1 });
    const userLookup = new Map(referencedUsers.map((doc) => [toIdString(doc._id), mapUserSummary(doc)]));

    res.status(201).json({
      report: mapReportResponse(report, userLookup),
      message: 'Report submitted. Our moderators will review it shortly.'
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid report payload.', issues: error.errors });
    }
    console.error('Failed to submit content report:', error);
    res.status(500).json({ message: 'Failed to submit report. Please try again later.' });
  }
});

module.exports = router;
