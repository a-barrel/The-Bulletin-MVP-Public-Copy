const mongoose = require('mongoose');
const User = require('../models/User');
const { broadcastBadgeEarned } = require('./updateFanoutService');
const { logIntegration } = require('../utils/devLogger');

const BADGE_DEFINITIONS = [
  {
    id: 'enter-debug-console',
    label: 'Debugger',
    description: 'Entered the debug console for the first time.',
    image: '/images/badges/enter_debug_console_first_time_badge.jpg'
  },
  {
    id: 'chat-first-message',
    label: 'Conversation Starter',
    description: 'Sent your first chat message.',
    image: '/images/badges/chat_first_time_badge.jpg'
  },
  {
    id: 'create-first-pin',
    label: 'Trailblazer',
    description: 'Created your first pin.',
    image: '/images/badges/create_pin_first_time_badge.jpg'
  },
  {
    id: 'bookmark-first-pin',
    label: 'Curator',
    description: 'Bookmarked your first pin.',
    image: '/images/badges/bookmark_first_time_badge.jpg'
  },
  {
    id: 'attend-first-event',
    label: 'Participant',
    description: 'Joined an event for the first time.',
    image: '/images/badges/attend_event_first_time_badge.jpg'
  },
  {
    id: 'how-badge',
    label: 'HOW?!',
    description: 'Discovered the hidden Kirby',
    image: '/images/badges/how_badge.jpg'
  }
];

const BADGE_MAP = new Map(BADGE_DEFINITIONS.map((badge) => [badge.id, badge]));

const resolveBadge = (badgeId) => {
  const badge = BADGE_MAP.get(badgeId);
  if (!badge) {
    throw new Error(`Unknown badge "${badgeId}"`);
  }
  return badge;
};

const toObjectId = (value) => {
  if (!value) {
    return undefined;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return new mongoose.Types.ObjectId(value);
};

async function grantBadge({ userId, badgeId, sourceUserId } = {}) {
  if (!userId) {
    throw new Error('userId is required to grant a badge');
  }

  const badge = resolveBadge(badgeId);
  const targetId = toObjectId(userId);

  const result = await User.updateOne(
    { _id: targetId, badges: { $ne: badge.id } },
    { $addToSet: { badges: badge.id } }
  );

  const granted = (result.modifiedCount ?? result.nModified ?? 0) > 0;

  if (granted) {
    try {
      await broadcastBadgeEarned({
        userId: targetId,
        badge,
        sourceUserId: sourceUserId ? toObjectId(sourceUserId) : targetId
      });
    } catch (error) {
      console.error('Failed to broadcast badge earned update:', error);
      logIntegration('badge:fanout', error);
    }
  }

  const user = await User.findById(targetId, { badges: 1 });
  return {
    granted,
    badge,
    badges: Array.isArray(user?.badges) ? user.badges.slice() : []
  };
}

async function revokeBadge({ userId, badgeId } = {}) {
  if (!userId) {
    throw new Error('userId is required to revoke a badge');
  }
  const badge = resolveBadge(badgeId);
  const targetId = toObjectId(userId);

  const result = await User.updateOne(
    { _id: targetId },
    { $pull: { badges: badge.id } }
  );

  const revoked = (result.modifiedCount ?? result.nModified ?? 0) > 0;
  const user = await User.findById(targetId, { badges: 1 });

  return {
    revoked,
    badge,
    badges: Array.isArray(user?.badges) ? user.badges.slice() : []
  };
}

async function resetBadges(userId) {
  if (!userId) {
    throw new Error('userId is required to reset badges');
  }
  const targetId = toObjectId(userId);
  await User.updateOne({ _id: targetId }, { $set: { badges: [] } });
  return {
    badges: [],
    reset: true
  };
}

async function getBadgeStatusForUser(userId) {
  const targetId = toObjectId(userId);
  const user = await User.findById(targetId, { badges: 1, username: 1, displayName: 1 }).lean();
  if (!user) {
    throw new Error('User not found');
  }
  const owned = new Set(Array.isArray(user.badges) ? user.badges : []);
  return {
    user: {
      _id: user._id.toString(),
      username: user.username,
      displayName: user.displayName
    },
    badges: BADGE_DEFINITIONS.map((badge) => ({
      ...badge,
      earned: owned.has(badge.id)
    }))
  };
}

function listBadges() {
  return BADGE_DEFINITIONS.map((badge) => ({ ...badge }));
}

module.exports = {
  BADGE_DEFINITIONS,
  listBadges,
  resolveBadge,
  grantBadge,
  revokeBadge,
  resetBadges,
  getBadgeStatusForUser
};
