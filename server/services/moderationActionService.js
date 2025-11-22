const mongoose = require('mongoose');
const admin = require('firebase-admin');

const ModerationAction = require('../models/ModerationAction');
const User = require('../models/User');
const { recordAuditEntry } = require('./auditLogService');
const { trackModerationEvent } = require('./analyticsService');
const { logIntegration } = require('../utils/devLogger');

const VIEWER_UPDATE_PROJECTION = {
  username: 1,
  displayName: 1,
  roles: 1,
  accountStatus: 1,
  avatar: 1,
  stats: 1
};

const toObjectId = (value) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);

async function updateFirebaseAccountDisabledState(firebaseUid, disabled) {
  if (!firebaseUid) {
    return;
  }

  try {
    await admin.auth().updateUser(firebaseUid, { disabled });
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      logIntegration('firebase:update-user-status', error);
      return;
    }
    logIntegration('firebase:update-user-status', error);
  }
}

async function applyModerationAction({ viewer, target, type, reason = '', durationMinutes }) {
  if (!viewer?._id) {
    throw new Error('Viewer context is required.');
  }
  if (!target?._id) {
    throw new Error('Target user is required.');
  }

  const viewerId = toObjectId(viewer._id);
  const targetId = toObjectId(target._id);

  let expiresAt;

  switch (type) {
    case 'mute':
      await User.findByIdAndUpdate(viewerId, {
        $addToSet: { 'relationships.mutedUserIds': targetId }
      });
      if (durationMinutes) {
        expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
      }
      break;
    case 'unmute':
      await User.findByIdAndUpdate(viewerId, {
        $pull: { 'relationships.mutedUserIds': targetId }
      });
      break;
    case 'block': {
      await User.findByIdAndUpdate(
        viewerId,
        {
          $addToSet: { 'relationships.blockedUserIds': targetId },
          $pull: {
            'relationships.followingIds': targetId,
            'relationships.followerIds': targetId,
            'relationships.friendIds': targetId
          }
        },
        { new: true }
      );
      await User.findByIdAndUpdate(targetId, {
        $pull: {
          'relationships.friendIds': viewerId,
          'relationships.followingIds': viewerId,
          'relationships.followerIds': viewerId
        }
      });
      break;
    }
    case 'unblock':
      await User.findByIdAndUpdate(viewerId, {
        $pull: { 'relationships.blockedUserIds': targetId }
      });
      break;
    case 'ban':
      await User.findByIdAndUpdate(targetId, { $set: { accountStatus: 'suspended' } });
      await updateFirebaseAccountDisabledState(target.firebaseUid, true);
      break;
    case 'unban':
      await User.findByIdAndUpdate(targetId, { $set: { accountStatus: 'active' } });
      await updateFirebaseAccountDisabledState(target.firebaseUid, false);
      break;
    case 'warn':
    case 'report':
      break;
    default:
      throw new Error(`Unsupported moderation action "${type}".`);
  }

  const actionDoc = await ModerationAction.create({
    userId: targetId,
    moderatorId: viewerId,
    type,
    reason: reason || '',
    expiresAt
  });

  const refreshedTarget = await User.findById(targetId).select(VIEWER_UPDATE_PROJECTION).lean();

  const actionMetadata = {
    type,
    reason: reason || '',
    expiresAt: expiresAt ? expiresAt.toISOString() : undefined
  };

  await Promise.all([
    recordAuditEntry({
      actorId: viewerId,
      targetId,
      action: `moderation:${type}`,
      metadata: actionMetadata
    }),
    trackModerationEvent({
      moderatorId: viewerId,
      targetId,
      type,
      metadata: actionMetadata
    })
  ]);

  return {
    action: actionDoc,
    target: refreshedTarget,
    expiresAt
  };
}

module.exports = {
  applyModerationAction
};
