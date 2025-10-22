const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Pin = require('../models/Pin');
const { Bookmark, BookmarkCollection } = require('../models/Bookmark');
const Reply = require('../models/Reply');
const { ProximityChatRoom, ProximityChatMessage, ProximityChatPresence } = require('../models/ProximityChat');
const Update = require('../models/Update');
const Location = require('../models/Location');

const DATA_DIR = path.join(__dirname, '..', '..', 'docs', 'mongodb-local-sample-data');
const { ObjectId } = mongoose.Types;

const COLLECTIONS = [
  { key: 'users', model: User, filename: 'mongodb-sample-users.json' },
  { key: 'pins', model: Pin, filename: 'mongodb-sample-pins.json' },
  { key: 'bookmarkCollections', model: BookmarkCollection, filename: 'mongodb-sample-bookmarkCollections.json' },
  { key: 'bookmarks', model: Bookmark, filename: 'mongodb-sample-bookmarks.json' },
  { key: 'replies', model: Reply, filename: 'mongodb-sample-replies.json' },
  { key: 'proximityChatRooms', model: ProximityChatRoom, filename: 'mongodb-sample-proximityChatRooms.json' },
  { key: 'proximityChatMessages', model: ProximityChatMessage, filename: 'mongodb-sample-proximityChatMessages.json' },
  { key: 'proximityChatPresence', model: ProximityChatPresence, filename: 'mongodb-sample-proximityChatPresence.json' },
  { key: 'updates', model: Update, filename: 'mongodb-sample-updates.json' },
  { key: 'locations', model: Location, filename: 'mongodb-sample-locations.json' }
];

// Converts MongoDB extended JSON structures into native JavaScript types.
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

async function loadCollection(filename) {
  const filePath = path.join(DATA_DIR, filename);
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected an array in ${filename}, but received ${typeof parsed}.`);
  }

  return convertExtendedJSON(parsed);
}

async function seed() {
  const datasets = {};

  for (const { key, filename } of COLLECTIONS) {
    datasets[key] = await loadCollection(filename);
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pinpoint');

  await Promise.all(COLLECTIONS.map(({ model }) => model.deleteMany({})));

  for (const { key, model } of COLLECTIONS) {
    const documents = datasets[key] || [];
    if (!documents.length) {
      continue;
    }

    await model.insertMany(documents);
    console.log(`Inserted ${documents.length} documents into ${model.collection.collectionName}.`);
  }

  console.log('Seed data inserted successfully.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed script failed:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
