const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled', 'blocked'],
      default: 'pending'
    },
    message: { type: String, default: '' },
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed },
    respondedAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

friendRequestSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });
friendRequestSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
friendRequestSchema.index({ requesterId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
