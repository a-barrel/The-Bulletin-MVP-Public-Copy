const mongoose = require('mongoose');

const mediaAssetSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    thumbnailUrl: String,
    width: Number,
    height: Number,
    mimeType: String,
    description: String,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'interested', 'going', 'curious', 'flag'], required: true },
    reactedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const replySchema = new mongoose.Schema(
  {
    pinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pin', required: true },
    parentReplyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reply' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    attachments: { type: [mediaAssetSchema], default: [] },
    reactions: { type: [reactionSchema], default: [] },
    mentionedUserIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    audit: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  },
  { timestamps: true }
);

replySchema.index({ pinId: 1, createdAt: 1 });

module.exports = mongoose.model('Reply', replySchema);
