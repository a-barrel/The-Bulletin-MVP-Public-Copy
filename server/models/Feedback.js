const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    category: {
      type: String,
      default: ''
    },
    contact: {
      type: String,
      default: ''
    },
    submittedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
