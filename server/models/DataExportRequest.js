const mongoose = require('mongoose');

const dataExportRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'error'],
      default: 'queued',
      index: true
    },
    requestedAt: { type: Date, default: Date.now },
    completedAt: Date,
    expiresAt: Date,
    downloadUrl: String,
    failureReason: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

module.exports = mongoose.model('DataExportRequest', dataExportRequestSchema);
