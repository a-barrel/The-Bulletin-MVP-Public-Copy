const AnalyticsEvent = require('../models/AnalyticsEvent');

async function trackEvent({ eventName, actorId, targetId, payload = {} }) {
  try {
    await AnalyticsEvent.create({
      eventName,
      actorId,
      targetId,
      payload
    });
  } catch (error) {
    console.error(`Failed to track analytics event ${eventName}`, error);
  }
}

async function trackModerationEvent({ moderatorId, targetId, type, metadata = {} }) {
  return trackEvent({
    eventName: 'moderation-action',
    actorId: moderatorId,
    targetId,
    payload: {
      type,
      ...metadata
    }
  });
}

module.exports = {
  trackEvent,
  trackModerationEvent
};
