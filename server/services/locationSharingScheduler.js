const User = require('../models/User');
const { logIntegration } = require('../utils/devLogger');

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let intervalHandle = null;
let isRunning = false;

const hoursToMs = (hours) => Math.max(0, Number(hours) || 0) * 60 * 60 * 1000;

async function sweepLocationSharing(now = Date.now()) {
  const candidates = await User.find(
    {
      locationSharingEnabled: true,
      'preferences.location.autoDisableAfterHours': { $gt: 0 },
      'preferences.location.lastEnabledAt': { $ne: null }
    },
    {
      'preferences.location.autoDisableAfterHours': 1,
      'preferences.location.lastEnabledAt': 1
    }
  ).lean();

  if (!candidates.length) {
    return;
  }

  const expiredIds = [];
  candidates.forEach((user) => {
    const hours = user?.preferences?.location?.autoDisableAfterHours;
    const lastEnabledAt = user?.preferences?.location?.lastEnabledAt;
    if (!hours || !lastEnabledAt) {
      return;
    }
    const expiresAt = new Date(lastEnabledAt).getTime() + hoursToMs(hours);
    if (Number.isFinite(expiresAt) && expiresAt <= now) {
      expiredIds.push(user._id);
    }
  });

  if (!expiredIds.length) {
    return;
  }

  await User.updateMany(
    { _id: { $in: expiredIds } },
    {
      $set: { locationSharingEnabled: false },
      $unset: { 'preferences.location.lastEnabledAt': '' }
    }
  );
}

async function runSweep() {
  if (isRunning) {
    return;
  }
  isRunning = true;
  try {
    await sweepLocationSharing(Date.now());
  } catch (error) {
    console.error('Location sharing sweep failed', error);
    logIntegration('location-sharing-scheduler', error);
  } finally {
    isRunning = false;
  }
}

function startLocationSharingScheduler() {
  if (intervalHandle) {
    return;
  }
  intervalHandle = setInterval(runSweep, SWEEP_INTERVAL_MS);
  setTimeout(runSweep, 10_000);
}

function stopLocationSharingScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startLocationSharingScheduler,
  stopLocationSharingScheduler
};
