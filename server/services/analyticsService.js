const AnalyticsEvent = require('../models/AnalyticsEvent');
const { logIntegration } = require('../utils/devLogger');

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
    logIntegration(`analytics:${eventName}`, error);
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
