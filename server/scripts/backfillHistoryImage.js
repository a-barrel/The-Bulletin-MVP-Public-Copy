const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

const User = require('../models/User');
const Pin = require('../models/Pin');
const { resolvePinPrimaryImageUrl } = require('../utils/pinMedia');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BATCH_SIZE = 100;
const isDryRun = process.argv.includes('--dry-run');

async function backfillHistoryImages() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pinpoint';
  await mongoose.connect(mongoUri);
  console.log(`Connected to ${mongoUri}`);

  let processedUsers = 0;
  let updatedEntries = 0;

  let hasMore = true;
  while (hasMore) {
    const users = await User.find({
      viewHistory: { $exists: true, $ne: [] },
      $or: [{ 'viewHistory.imageUrl': { $exists: false } }, { 'viewHistory.imageUrl': null }]
    })
      .limit(BATCH_SIZE)
      .lean()
      .exec();

    if (!users.length) {
      hasMore = false;
      break;
    }

    const pinIdSet = new Set();
    users.forEach((user) => {
      (user.viewHistory || []).forEach((entry) => {
        if (!entry?.imageUrl && entry?.pinId) {
          pinIdSet.add(entry.pinId.toString());
        }
      });
    });

    const pinIdList = Array.from(pinIdSet).map((id) => new mongoose.Types.ObjectId(id));
    const pinMap = new Map();
    if (pinIdList.length) {
      const pins = await Pin.find({ _id: { $in: pinIdList } }).lean().exec();
      pins.forEach((pin) => {
        pinMap.set(pin._id.toString(), pin);
      });
    }

    const bulkOps = [];

    users.forEach((user) => {
      let changed = false;
      const nextHistory = (user.viewHistory || []).map((entry) => {
        if (entry?.imageUrl || !entry?.pinId) {
          return entry;
        }
        const pin = pinMap.get(entry.pinId.toString());
        const imageUrl = pin ? resolvePinPrimaryImageUrl(pin) : null;
        if (imageUrl) {
          changed = true;
          return { ...entry, imageUrl };
        }
        return entry;
      });

      if (changed) {
        updatedEntries += nextHistory.filter((entry) => entry?.imageUrl).length;
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: { viewHistory: nextHistory } }
          }
        });
      }
    });

    if (!bulkOps.length) {
      processedUsers += users.length;
      console.log(`Processed ${processedUsers} users (no updates in this batch)`);
      continue;
    }

    if (isDryRun) {
      processedUsers += users.length;
      console.log(`[dry-run] Would update ${bulkOps.length} users; total processed ${processedUsers}`);
    } else {
      await User.bulkWrite(bulkOps);
      processedUsers += users.length;
      console.log(
        `Updated ${bulkOps.length} users in batch; total processed ${processedUsers}, total entries updated ${updatedEntries}`
      );
    }
  }

  await mongoose.disconnect();
  console.log('Backfill complete.');
}

backfillHistoryImages().catch((error) => {
  console.error('Backfill failed:', error);
  mongoose.disconnect();
  process.exit(1);
});
