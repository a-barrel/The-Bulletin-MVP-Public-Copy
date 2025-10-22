#!/usr/bin/env node
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { loadSampleData, COLLECTIONS, DEFAULT_DATA_DIR } = require('./utils/sampleDataLoader');

const COLLECTION_NAMES = COLLECTIONS.map((collection) => collection.name);

function printHelp() {
  console.log(`
Usage: node scripts/load-sample-data.js [options]

Options:
  -c, --collections <list>   Comma-separated list of collections to load (default: all)
  -d, --data-dir <path>      Override the sample data directory (default: ${DEFAULT_DATA_DIR})
      --keep                 Keep existing documents (skip collection drop)
      --drop                 Explicitly drop existing documents before inserting (default)
      --dry-run              Show what would happen without writing to MongoDB
  -h, --help                 Show this message

Available collections:
  ${COLLECTION_NAMES.join(', ')}
`.trim());
}

function parseArgs(argv) {
  const options = {
    drop: true,
    dryRun: false,
    collections: null,
    dataDir: DEFAULT_DATA_DIR,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--collections':
      case '-c': {
        const value = argv[index + 1];
        if (!value) {
          throw new Error('Missing value for --collections.');
        }
        options.collections = value
          .split(',')
          .map((token) => token.trim())
          .filter(Boolean);
        index += 1;
        break;
      }
      case '--data-dir':
      case '-d': {
        const value = argv[index + 1];
        if (!value) {
          throw new Error('Missing value for --data-dir.');
        }
        options.dataDir = path.resolve(process.cwd(), value);
        index += 1;
        break;
      }
      case '--keep':
      case '--keep-existing':
      case '--no-drop':
        options.drop = false;
        break;
      case '--drop':
        options.drop = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument "${arg}". Use --help to see available options.`);
    }
  }

  if (options.collections && options.collections.includes('all')) {
    options.collections = null;
  }

  return options;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const collections = args.collections
    ? args.collections.map((key) => {
        const match = COLLECTIONS.find((entry) => entry.name.toLowerCase() === key.toLowerCase());
        if (!match) {
          throw new Error(`Unknown collection "${key}". Available options: ${COLLECTION_NAMES.join(', ')}`);
        }
        return match.name;
      })
    : null;

  if (args.dryRun) {
    console.log('[dry-run] No changes will be written to MongoDB.');
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pinpoint');

  try {
    await loadSampleData({
      collections,
      dropExisting: args.drop,
      dryRun: args.dryRun,
      dataDir: args.dataDir,
      logger: console
    });

    if (args.dryRun) {
      console.log('[dry-run] Completed without modifying the database.');
    } else {
      console.log('Sample data load completed successfully.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Sample data load failed:', error.message || error);
  mongoose.disconnect().finally(() => process.exit(1));
});
