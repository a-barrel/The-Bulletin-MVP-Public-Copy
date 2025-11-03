const AuditLog = require('../models/AuditLog');

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
  }
}

module.exports = {
  recordAuditEntry
};
