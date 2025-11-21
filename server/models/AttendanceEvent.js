const mongoose = require('mongoose');

const attendanceEventSchema = new mongoose.Schema(
  {
    pinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pin', index: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    action: { type: String, enum: ['join', 'leave'], required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

attendanceEventSchema.index({ pinId: 1, createdAt: 1 });
attendanceEventSchema.index({ pinId: 1, userId: 1, createdAt: 1 });

module.exports = mongoose.model('AttendanceEvent', attendanceEventSchema);
