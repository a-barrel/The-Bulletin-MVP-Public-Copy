const Pin = require('../models/Pin');
const { broadcastEventStartingSoon, broadcastDiscussionExpiringSoon } = require('./updateFanoutService');
const { logIntegration } = require('../utils/devLogger');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DISCUSSION_LEAD_MS = 24 * 60 * 60 * 1000;
const EVENT_REMINDER_WINDOWS = [
  { windowHours: 24, offsetMs: 24 * 60 * 60 * 1000 },
  { windowHours: 2, offsetMs: 2 * 60 * 60 * 1000 },
  { windowHours: 0.25, offsetMs: 15 * 60 * 1000 }
];

let intervalHandle = null;
let isRunning = false;

async function sweepEvents(now) {
  for (const windowConfig of EVENT_REMINDER_WINDOWS) {
    const windowStart = new Date(now + windowConfig.offsetMs);
    const windowEnd = new Date(windowStart.getTime() + INTERVAL_MS);

    const events = await Pin.find(
      {
        type: 'event',
        startDate: { $gte: windowStart, $lt: windowEnd },
        isActive: { $ne: false }
      },
      {
        type: 1,
        title: 1,
        startDate: 1,
        endDate: 1,
        attendingUserIds: 1,
        bookmarkCount: 1,
        proximityRadiusMeters: 1,
        creatorId: 1,
        coordinates: 1,
        coverPhoto: 1,
        photos: 1,
        description: 1
      }
    ).lean();

    for (const event of events) {
      await broadcastEventStartingSoon({ pin: event, windowHours: windowConfig.windowHours });
    }
  }
}

async function sweepDiscussions(now) {
  const windowStart = new Date(now + DISCUSSION_LEAD_MS);
  const windowEnd = new Date(windowStart.getTime() + INTERVAL_MS);

  const discussions = await Pin.find(
    {
      type: 'discussion',
      expiresAt: { $gte: windowStart, $lt: windowEnd },
      isActive: { $ne: false }
    },
    {
      type: 1,
      title: 1,
      expiresAt: 1,
      creatorId: 1,
      coordinates: 1,
      coverPhoto: 1,
      photos: 1,
      description: 1
    }
  ).lean();

  for (const discussion of discussions) {
    await broadcastDiscussionExpiringSoon({ pin: discussion });
  }
}

async function runSweep() {
  if (isRunning) {
    return;
  }
  isRunning = true;
  try {
    const now = Date.now();
    await sweepEvents(now);
    await sweepDiscussions(now);
  } catch (error) {
    console.error('Update scheduler run failed', error);
    logIntegration('update-scheduler', error);
  } finally {
    isRunning = false;
  }
}

function startUpdateScheduler() {
  if (intervalHandle) {
    return;
  }

  intervalHandle = setInterval(runSweep, INTERVAL_MS);
  // Kick off an initial sweep shortly after startup.
  setTimeout(runSweep, 15_000);
}

function stopUpdateScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startUpdateScheduler,
  stopUpdateScheduler
};
