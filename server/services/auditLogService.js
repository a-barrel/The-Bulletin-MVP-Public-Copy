const AuditLog = require('../models/AuditLog');
const { logIntegration } = require('../utils/devLogger');

async function recordAuditEntry({ actorId, targetId, action, metadata = {}, context = 'moderation' }) {
  try {
    await AuditLog.create({
      actorId,
      targetId,
      action,
      metadata,
      context
    });
  } catch (error) {
    console.error('Failed to record audit entry', { action, error });
    logIntegration(`audit:${action}`, error);
  }
}

module.exports = {
  recordAuditEntry
};
