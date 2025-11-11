const mongoose = require('mongoose');

const apiTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, default: 'Personal access token', maxlength: 120 },
    hash: { type: String, required: true, unique: true },
    preview: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: Date,
    revokedAt: Date
  },
  { timestamps: false }
);

module.exports = mongoose.model('ApiToken', apiTokenSchema);
