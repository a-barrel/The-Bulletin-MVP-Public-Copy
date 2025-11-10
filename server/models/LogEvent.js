const mongoose = require('mongoose');

const severityEnum = ['debug', 'info', 'warn', 'error', 'fatal'];

const parseTtlDays = () => {
  const raw = Number.parseInt(process.env.PINPOINT_LOG_TTL_DAYS, 10);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return 14;
};

const ttlSeconds = parseTtlDays() * 24 * 60 * 60;

const LogEventSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true },
    severity: { type: String, enum: severityEnum, default: 'info' },
    message: { type: String, required: true },
    stack: { type: String },
    context: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: () => new Date(), index: true },
    meta: { type: mongoose.Schema.Types.Mixed }
  },
  { minimize: false }
);

LogEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: ttlSeconds });
LogEventSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('LogEvent', LogEventSchema);
