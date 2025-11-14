const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../../models/User');
const Pin = require('../../models/Pin');
const { Bookmark, BookmarkCollection } = require('../../models/Bookmark');
const Reply = require('../../models/Reply');
const {
  ProximityChatRoom,
  ProximityChatMessage,
  ProximityChatPresence
} = require('../../models/ProximityChat');
const Update = require('../../models/Update');
const Location = require('../../models/Location');
const FriendRequest = require('../../models/FriendRequest');
const ModerationAction = require('../../models/ModerationAction');
const ContentReport = require('../../models/ContentReport');
const DirectMessageThread = require('../../models/DirectMessageThread');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'mongodb-local-sample-data');

const COLLECTIONS = [
  { name: 'users', model: User, filename: 'mongodb-sample-users.json' },
  { name: 'pins', model: Pin, filename: 'mongodb-sample-pins.json' },
  { name: 'bookmarkCollections', model: BookmarkCollection, filename: 'mongodb-sample-bookmarkCollections.json' },
  { name: 'bookmarks', model: Bookmark, filename: 'mongodb-sample-bookmarks.json' },
  { name: 'replies', model: Reply, filename: 'mongodb-sample-replies.json' },
  { name: 'proximityChatRooms', model: ProximityChatRoom, filename: 'mongodb-sample-proximityChatRooms.json' },
  { name: 'proximityChatMessages', model: ProximityChatMessage, filename: 'mongodb-sample-proximityChatMessages.json' },
  { name: 'proximityChatPresence', model: ProximityChatPresence, filename: 'mongodb-sample-proximityChatPresence.json' },
  { name: 'updates', model: Update, filename: 'mongodb-sample-updates.json' },
  { name: 'locations', model: Location, filename: 'mongodb-sample-locations.json' },
  { name: 'friendRequests', model: FriendRequest, filename: 'mongodb-sample-friendRequests.json' },
  {
    name: 'moderationActions',
    model: ModerationAction,
    filename: 'mongodb-sample-moderationActions.json'
  },
  {
    name: 'contentReports',
    model: ContentReport,
    filename: 'mongodb-sample-contentReports.json'
  },
  {
    name: 'directMessageThreads',
    model: DirectMessageThread,
    filename: 'mongodb-sample-directMessageThreads.json'
  }
];

const collectionIndex = new Map();
for (const entry of COLLECTIONS) {
  collectionIndex.set(entry.name, entry);
  collectionIndex.set(entry.name.toLowerCase(), entry);
}

const { ObjectId } = mongoose.Types;

function convertExtendedJSON(value) {
  if (Array.isArray(value)) {
    return value.map(convertExtendedJSON);
  }

  if (value instanceof Date || value instanceof ObjectId) {
    return value;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);

    if (keys.length === 1 && typeof value.$oid === 'string') {
      return new ObjectId(value.$oid);
    }

    if (keys.length === 1 && value.$date) {
      return new Date(value.$date);
    }

    return Object.fromEntries(keys.map((key) => [key, convertExtendedJSON(value[key])]));
  }

  return value;
}

async function loadDataset(filename, dataDir, logger) {
  const filePath = path.join(dataDir, filename);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error(`Expected an array but received ${typeof parsed}`);
    }

    return convertExtendedJSON(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger?.warn?.(`Skipping ${filename} because the file does not exist (${filePath}).`);
      return [];
    }
    throw new Error(`Failed to load ${filename}: ${error.message}`);
  }
}

async function loadSampleData({
  collections,
  dropExisting = true,
  dryRun = false,
  dataDir = DEFAULT_DATA_DIR,
  logger = console
} = {}) {
  const targets = (collections && collections.length ? collections : COLLECTIONS.map((entry) => entry.name))
    .map((name) => {
      const entry = collectionIndex.get(name);
      if (!entry) {
        throw new Error(`Unknown collection "${name}". Available options: ${COLLECTIONS.map((c) => c.name).join(', ')}`);
      }
      return entry;
    });

  logger.info?.(
    `${dryRun ? '[dry-run] ' : ''}Loading sample data for ${targets.length} collection${targets.length === 1 ? '' : 's'} from ${dataDir}.`
  );

  for (const entry of targets) {
    const documents = await loadDataset(entry.filename, dataDir, logger);
    const collectionName = entry.model.collection.collectionName;

    if (!documents.length) {
      logger.info?.(`No documents found for ${entry.name}; skipping.`);
      continue;
    }

    if (dryRun) {
      logger.info?.(`[dry-run] Would ${(dropExisting ? 'replace' : 'insert into')} ${collectionName} with ${documents.length} documents.`);
      continue;
    }

    if (dropExisting) {
      await entry.model.deleteMany({});
    }

    await entry.model.insertMany(documents);
    logger.info?.(`Inserted ${documents.length} documents into ${collectionName}.`);
  }
}

module.exports = {
  loadSampleData,
  COLLECTIONS,
  DEFAULT_DATA_DIR
};
