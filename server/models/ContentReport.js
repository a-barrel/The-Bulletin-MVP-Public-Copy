const mongoose = require('mongoose');

const contentReportSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ['pin', 'reply', 'chat-message', 'direct-message'],
      required: true
    },
    contentId: {
      type: String,
      required: true
    },
    contentAuthorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending'
    },
    reason: {
      type: String,
      default: ''
    },
    context: {
      type: String,
      default: ''
    },
    offenseTags: {
      type: [String],
      default: []
    },
    latestSnapshot: {
      message: String,
      metadata: mongoose.Schema.Types.Mixed
    },
    resolvedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolutionNotes: String
  },
  { timestamps: true }
);

contentReportSchema.index({ contentType: 1, contentId: 1, reporterId: 1 }, { unique: false });
contentReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ContentReport', contentReportSchema);
