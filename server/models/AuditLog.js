const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    context: { type: String, default: 'moderation' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ context: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
