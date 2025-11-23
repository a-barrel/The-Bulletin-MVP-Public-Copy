#!/usr/bin/env node

/**
 * Backfill pin chat room names to the new "[Type]: Title" format.
 * Usage: MONGO_URL=<mongo-connection> node backfillPinChatRoomNames.js [--dry-run]
 */

const mongoose = require('mongoose');
const { ProximityChatRoom } = require('../models/ProximityChat');
const Pin = require('../models/Pin');
const { buildPinRoomName } = require('../utils/chatRoomContract');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error('Missing MONGO_URL env');
    process.exit(1);
  }
  await mongoose.connect(mongoUrl);

  const rooms = await ProximityChatRoom.find({ pinId: { $ne: null } }, { _id: 1, pinId: 1, name: 1 }).lean();
  let updated = 0;
  for (const room of rooms) {
    const pin = await Pin.findById(room.pinId, { title: 1, type: 1 }).lean();
    if (!pin) {
      continue;
    }
    const nextName = buildPinRoomName(room.pinId.toString(), pin.type, pin.title);
    if (room.name === nextName) {
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would update room ${room._id} -> "${nextName}"`);
      continue;
    }
    await ProximityChatRoom.updateOne({ _id: room._id }, { $set: { name: nextName } });
    updated += 1;
  }
  console.log(`Backfill complete${dryRun ? ' (dry-run)' : ''}. Updated ${updated} room(s).`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
