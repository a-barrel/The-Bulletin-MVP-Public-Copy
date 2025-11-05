const fs = require('fs');
const path = require('path');
const runtime = require('../config/runtime');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const LOG_ROOT = path.join(PROJECT_ROOT, 'DEV_LOGS');

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
  if (!runtime.isOffline) {
    return null;
  }
  try {
    fs.mkdirSync(LOG_ROOT, { recursive: true });
    if (!cleaned) {
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

const writeLogLine = (category, message) => {
  if (!runtime.isOffline) {
    return;
  }
  const dir = ensureLogDir();
  if (!dir) {
    return;
  }
  const filePath = path.join(dir, `${category}.log`);
  const line = `${new Date().toISOString()} ${message}\n`;
  fs.appendFile(filePath, line, (error) => {
    if (error) {
      console.warn(`Failed to append dev log (${category}):`, error);
    }
  });
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
    console.log(message);
    writeLogLine(category, `${label} ${durationMs.toFixed(2)}ms${metaSuffix}`);
  }
}

module.exports = {
  timeAsync,
  logLine: writeLogLine,
  logIntegration: (label, error) => {
    if (!runtime.isOffline) {
      return;
    }
    const detail =
      error instanceof Error ? error.stack || error.message : error ? String(error) : '';
    const suffix = detail ? ` ${detail}` : '';
    writeLogLine('integrations', `${label}${suffix}`);
  }
};
