#!/usr/bin/env node
/**
 * Quick helper to inspect the hosted logevents collection without opening Compass.
 *
 * Examples:
 *   node scripts/fetch-logevents.js --category=client-api-errors --limit=5
 *   node scripts/fetch-logevents.js --since-minutes=120 --severity=error
 *   node scripts/fetch-logevents.js --uri="mongodb+srv://..." --json
 *
 * Defaults to MONGODB_URI_ONLINE (falls back to MONGODB_URI / MONGODB_URI_OFFLINE).
 */
const path = require('path');
const mongoose = require('mongoose');
const LogEvent = require('../models/LogEvent');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const argv = process.argv.slice(2);

const options = {
  limit: 20,
  category: null,
  severity: null,
  sinceMinutes: null,
  uri: process.env.MONGODB_URI_ONLINE || process.env.MONGODB_URI || process.env.MONGODB_URI_OFFLINE,
  json: false,
  help: false
};

const booleanFlags = new Set(['json', 'help']);

for (let i = 0; i < argv.length; i += 1) {
  const token = argv[i];
  if (!token.startsWith('--')) {
    continue;
  }
  const [rawFlag, inlineValue] = token.split('=');
  const flag = rawFlag.replace(/^--/, '');

  if (booleanFlags.has(flag) && inlineValue === undefined) {
    options[flag] = true;
    continue;
  }

  let value = inlineValue;
  if (value === undefined) {
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      value = next;
      i += 1;
    }
  }

  switch (flag) {
    case 'limit':
      options.limit = Number.parseInt(value, 10);
      break;
    case 'category':
      options.category = value;
      break;
    case 'severity':
      options.severity = value;
      break;
    case 'since-minutes':
      options.sinceMinutes = Number.parseInt(value, 10);
      break;
    case 'uri':
      options.uri = value;
      break;
    case 'json':
      options.json = value === undefined ? true : value === 'true';
      break;
    case 'help':
      options.help = true;
      break;
    default:
      console.warn(`Unknown flag: --${flag}`);
  }
}

const printUsage = () => {
  console.log(`Usage: node scripts/fetch-logevents.js [options]

Options:
  --category=<name>        Filter by category (client-errors, http-errors, etc)
  --severity=<level>       Filter by severity (debug|info|warn|error|fatal)
  --since-minutes=<n>      Only show entries newer than N minutes ago
  --limit=<n>              Number of entries to return (default: 20, max: 200)
  --uri=<mongodb uri>      Override the Mongo connection string
  --json                   Output raw JSON instead of human-readable lines
  --help                   Show this message
`);
};

if (options.help) {
  printUsage();
  process.exit(0);
}

if (!options.uri) {
  console.error('Missing MongoDB connection string. Set MONGODB_URI_ONLINE or pass --uri.');
  process.exit(1);
}

const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(200, options.limit)) : 20;
const query = {};

if (options.category) {
  query.category = options.category;
}
if (options.severity) {
  query.severity = options.severity;
}
if (Number.isFinite(options.sinceMinutes) && options.sinceMinutes > 0) {
  const cutoff = new Date(Date.now() - options.sinceMinutes * 60 * 1000);
  query.createdAt = { $gte: cutoff };
}

const logEventToText = (doc) => {
  const timestamp = doc.createdAt ? new Date(doc.createdAt).toISOString() : 'unknown-time';
  const category = doc.category || 'uncategorized';
  const severity = doc.severity || 'info';
  const message = doc.message || '<no message>';
  const context = doc.context ? ` | context=${JSON.stringify(doc.context)}` : '';
  return `${timestamp} [${category}] (${severity}) ${message}${context}`;
};

async function main() {
  try {
    await mongoose.connect(options.uri, { serverSelectionTimeoutMS: 8000 });
    const docs = await LogEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    if (options.json) {
      console.log(JSON.stringify(docs, null, 2));
    } else if (docs.length === 0) {
      console.log('No logevents matched your query.');
    } else {
      docs.forEach((doc) => {
        console.log(logEventToText(doc));
      });
    }
  } catch (error) {
    console.error('Failed to fetch log events:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main();
