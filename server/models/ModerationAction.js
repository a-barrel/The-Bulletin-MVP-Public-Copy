const mongoose = require('mongoose');

const moderationActionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['warn', 'mute', 'unmute', 'block', 'unblock', 'ban', 'unban', 'report'],
      required: true
    },
    reason: { type: String, default: '' },
    expiresAt: Date,
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

moderationActionSchema.index({ userId: 1, createdAt: -1 });
moderationActionSchema.index({ moderatorId: 1, createdAt: -1 });

module.exports = mongoose.model('ModerationAction', moderationActionSchema);
