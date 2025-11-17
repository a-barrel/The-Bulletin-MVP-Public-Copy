const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { ProximityChatRoom, ProximityChatMessage } = require('../models/ProximityChat');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MESSAGE_BANK = [
  'Zlorp glimbus narfty!',
  'Frindle pop quazar dooble.',
  'Nebula snax vibra tune.',
  'Jibber flux manta ray.',
  'Kip kip hoor cronx.',
  'Flombo jitter sprylox.',
  'Gloopity gloop zap!',
  'Zoop zoop zip zap.',
  'Wibber wobber woo!',
  'Plonk dribble snazzle.'
];

function pickRandomMessage(index) {
  return MESSAGE_BANK[index % MESSAGE_BANK.length];
}

function pickUser(users, offset) {
  if (!users.length) {
    throw new Error('No users available to seed proximity messages.');
  }
  return users[offset % users.length];
}

async function ensureMessages() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pinpoint';
  await mongoose.connect(mongoUri);

  const rooms = await ProximityChatRoom.find({}).lean();
  const users = await User.find({}, { _id: 1 }).limit(50).lean();

  if (!rooms.length) {
    console.log('No proximity chat rooms found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  if (users.length < 5) {
    throw new Error('Need at least 5 users to seed proximity chats.');
  }

  let totalCreated = 0;

  for (const room of rooms) {
    const existingCount = await ProximityChatMessage.countDocuments({ roomId: room._id });
    if (existingCount >= 5) {
      continue;
    }

    const messagesToCreate = 5 - existingCount;
    const batch = [];

    for (let i = 0; i < messagesToCreate; i += 1) {
      const author = pickUser(users, totalCreated + i);
      batch.push({
        roomId: room._id,
        authorId: author._id,
        message: pickRandomMessage(totalCreated + i),
        createdAt: new Date(Date.now() - (messagesToCreate - i) * 60000),
        updatedAt: new Date()
      });
    }

    if (batch.length) {
      await ProximityChatMessage.insertMany(batch);
      totalCreated += batch.length;
      console.log(`Room ${room._id} seeded with ${batch.length} messages (had ${existingCount}).`);
    }
  }

  console.log(`Seeded ${totalCreated} proximity chat messages.`);
  await mongoose.disconnect();
}

ensureMessages().catch((error) => {
  console.error('Failed to seed proximity chat messages:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
