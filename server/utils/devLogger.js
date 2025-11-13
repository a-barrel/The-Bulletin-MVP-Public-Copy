const fs = require('fs');
const path = require('path');
const runtime = require('../config/runtime');
const LogEvent = require('../models/LogEvent');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const LOG_ROOT = path.join(PROJECT_ROOT, 'DEV_LOGS');

const severityRank = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const shouldLogToFiles = runtime.isOffline || parseBoolean(process.env.PINPOINT_ENABLE_FILE_LOGS);
const shouldLogToMongo = parseBoolean(
  process.env.PINPOINT_LOG_TO_MONGO,
  runtime.isOnline || parseBoolean(process.env.PINPOINT_ENABLE_FILE_LOGS)
);
const minMongoSeverityEnv = (process.env.PINPOINT_LOG_MONGO_MIN_SEVERITY || '').trim().toLowerCase();
const minMongoSeverity =
  severityRank[minMongoSeverityEnv] !== undefined ? minMongoSeverityEnv : 'warn';

let cleaned = false;

const relocateFirebaseDebugLogs = (dir) => {
  const firebasePrefix = 'firebase-debug.log';
  const entries = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.name.startsWith(firebasePrefix)) {
      continue;
    }
    const sourcePath = path.join(PROJECT_ROOT, entry.name);
    const destPath = path.join(dir, entry.name);
    try {
      fs.renameSync(sourcePath, destPath);
      try {
        if (!fs.existsSync(sourcePath)) {
          fs.symlinkSync(destPath, sourcePath);
        }
      } catch (linkError) {
        console.warn('Failed to create symlink for firebase debug log:', linkError);
      }
    } catch (moveError) {
      console.warn('Failed to relocate firebase debug log:', moveError);
    }
  }
};

const ensureLogDir = () => {
  if (!shouldLogToFiles) {
    return null;
  }
  try {
    fs.mkdirSync(LOG_ROOT, { recursive: true });
    if (!cleaned && runtime.isOffline) {
      const entries = fs.readdirSync(LOG_ROOT, { withFileTypes: true });
      for (const entry of entries) {
        const target = path.join(LOG_ROOT, entry.name);
        fs.rmSync(target, { recursive: true, force: true });
      }
      cleaned = true;
    }
    relocateFirebaseDebugLogs(LOG_ROOT);
    return LOG_ROOT;
  } catch (error) {
    console.warn('Failed to create DEV_LOGS directory:', error);
    return null;
  }
};

const persistToMongo = (category, message, options) => {
  if (!shouldLogToMongo) {
    return;
  }
  const severity = options.severity || 'info';
  const timestamp =
    options.timestamp instanceof Date
      ? options.timestamp
      : options.timestamp
      ? new Date(options.timestamp)
      : new Date();

  const payload = {
    category,
    severity,
    message,
    stack: options.stack,
    context: options.context,
    createdAt: timestamp,
    meta: options.meta
  };

  LogEvent.create(payload).catch((error) => {
    console.warn('Failed to persist log event:', error);
  });
};

const shouldPersistToMongo = (severity, forceMongo) => {
  if (!shouldLogToMongo) {
    return false;
  }
  if (forceMongo) {
    return true;
  }
  return severityRank[severity] >= severityRank[minMongoSeverity];
};

const writeLogLine = (category, message, options = {}) => {
  const severity = options.severity && severityRank[options.severity] !== undefined ? options.severity : 'info';
  const timestamp =
    options.timestamp instanceof Date
      ? options.timestamp
      : options.timestamp
      ? new Date(options.timestamp)
      : new Date();

  if (shouldLogToFiles) {
    const dir = ensureLogDir();
    if (dir) {
      const filePath = path.join(dir, `${category}.log`);
      const line = `${timestamp.toISOString()} ${message}\n`;
      fs.appendFile(filePath, line, (error) => {
        if (error) {
          console.warn(`Failed to append dev log (${category}):`, error);
        }
      });
    }
  }

  if (shouldPersistToMongo(severity, options.forceMongo)) {
    persistToMongo(category, message, { ...options, severity, timestamp });
  }
};

async function timeAsync(category, label, handler, meta = {}) {
  const start = process.hrtime.bigint();
  try {
    return await handler();
  } finally {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const metaSuffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const message = `[${category}] ${label} ${durationMs.toFixed(2)}ms${metaSuffix}`;
    if (process.env.PINPOINT_PERF_LOGS !== 'silent') {
      console.log(message);
    }
    writeLogLine(category, `${label} ${durationMs.toFixed(2)}ms${metaSuffix}`, {
      severity: 'debug',
      context: meta
    });
  }
}

module.exports = {
  timeAsync,
  logLine: writeLogLine,
  logIntegration: (label, error) => {
    const detail =
      error instanceof Error ? error.stack || error.message : error ? String(error) : '';
    const suffix = detail ? ` ${detail}` : '';
    writeLogLine('integrations', `${label}${suffix}`, {
      severity: 'error',
      stack: error instanceof Error ? error.stack : undefined,
      context: { label }
    });
  }
};
