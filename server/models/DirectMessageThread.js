const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    attachments: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, default: Date.now },
    reactionCounts: { type: Map, of: Number, default: () => ({}) },
    reactionsByUser: { type: Map, of: [String], default: () => ({}) }
  },
  { _id: true }
);

const directMessageThreadSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2 && value.length <= 10,
        message: 'Direct message threads require between 2 and 10 participants.'
      }
    },
    topic: { type: String },
    lastMessageAt: { type: Date },
    messages: { type: [directMessageSchema], default: [] }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

directMessageThreadSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.model('DirectMessageThread', directMessageThreadSchema);
