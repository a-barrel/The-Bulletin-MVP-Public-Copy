const fs = require('fs');
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

const SAMPLE_DATA_PATH = path.join(
  __dirname,
  '..',
  '..',
  'docs',
  'mongodb-local-sample-data',
  'mongodb-sample-proximityChatMessages.json'
);

const SHOULD_UPDATE_SAMPLE_DATA = process.argv.includes('--update-sample-json');

const ATTACHMENT_POOL = [
  '/images/event/event-12',
  '/images/discussion/discussion-05',
  '/images/event/event-27',
  '/images/discussion/discussion-33'
];

const toObjectId = (value) => (value ? new mongoose.Types.ObjectId(value) : new mongoose.Types.ObjectId());

const toSampleDate = (date) => ({ $date: date.toISOString() });

const toSampleOid = (value) => ({ $oid: value.toString() });

const buildSampleRecord = ({ doc, author, room }) => {
  const coordinates = doc.coordinates
    ? {
        type: doc.coordinates.type,
        coordinates: [...doc.coordinates.coordinates],
        accuracy: doc.coordinates.accuracy ?? null
      }
    : null;

  const avatarPayload = author?.avatar
    ? {
        url: author.avatar.url,
        thumbnailUrl: author.avatar.thumbnailUrl || author.avatar.url,
        width: author.avatar.width || 128,
        height: author.avatar.height || 128,
        mimeType: author.avatar.mimeType || 'image/jpeg',
        uploadedAt: author.avatar.uploadedAt ? toSampleDate(new Date(author.avatar.uploadedAt)) : undefined
      }
    : null;

  return {
    _id: toSampleOid(doc._id),
    roomId: toSampleOid(room._id),
    pinId: doc.pinId ? toSampleOid(doc.pinId) : null,
    authorId: toSampleOid(doc.authorId),
    replyToMessageId: doc.replyToMessageId ? toSampleOid(doc.replyToMessageId) : null,
    message: doc.message,
    coordinates,
    attachments: doc.attachments,
    audit: {
      createdBy: toSampleOid(doc.authorId)
    },
    createdAt: toSampleDate(doc.createdAt),
    updatedAt: toSampleDate(doc.updatedAt),
    author: {
      _id: toSampleOid(doc.authorId),
      username: author?.username || null,
      displayName: author?.displayName || null,
      avatar: avatarPayload
    },
    authorAvatar: avatarPayload
  };
};

async function exportSampleMessages(rooms) {
  const roomIds = rooms.map((room) => room._id);
  if (!roomIds.length) {
    return [];
  }

  const sampleDocs = [];
  const authorIds = new Set();

  for (const room of rooms) {
    const docs = await ProximityChatMessage.find({ roomId: room._id })
      .sort({ createdAt: 1 })
      .limit(5)
      .lean();
    docs.forEach((doc) => {
      if (!doc) {
        return;
      }
      sampleDocs.push({ doc, room });
      if (doc.authorId) {
        authorIds.add(doc.authorId.toString());
      }
    });
  }

  if (!sampleDocs.length) {
    return [];
  }

  const authorList = await User.find(
    { _id: { $in: Array.from(authorIds).map((id) => new mongoose.Types.ObjectId(id)) } },
    { _id: 1, username: 1, displayName: 1, avatar: 1 }
  )
    .lean()
    .exec();
  const authorMap = new Map(authorList.map((author) => [author._id.toString(), author]));

  return sampleDocs.map(({ doc, room }) =>
    buildSampleRecord({
      doc,
      author: authorMap.get(doc.authorId?.toString()) || null,
      room
    })
  );
}

async function ensureMessages() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pinpoint';
  await mongoose.connect(mongoUri);

  const rooms = await ProximityChatRoom.find({}).lean();
  const users = await User.find({}, { _id: 1, username: 1, displayName: 1, avatar: 1 })
    .limit(50)
    .lean();

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
      const createdAt = new Date(Date.now() - (messagesToCreate - i) * 60000);
      const attachments =
        (totalCreated + i) % 3 === 0
          ? [
              {
                type: 'image',
                url: ATTACHMENT_POOL[(totalCreated + i) % ATTACHMENT_POOL.length],
                thumbnailUrl:
                  ATTACHMENT_POOL[(totalCreated + i) % ATTACHMENT_POOL.length],
                width: 512,
                height: 512,
                mimeType: 'image/jpeg'
              }
            ]
          : [];
      const coordinates = room.coordinates
        ? {
            type: 'Point',
            coordinates: [...room.coordinates.coordinates],
            accuracy: room.coordinates.accuracy ?? 12
          }
        : null;

    const doc = {
      _id: toObjectId(),
      roomId: room._id,
      authorId: author._id,
      message: pickRandomMessage(totalCreated + i),
      coordinates,
        attachments,
        audit: {
          createdBy: author._id
        },
        createdAt,
        updatedAt: new Date()
      };
    batch.push(doc);
  }

    if (batch.length) {
      await ProximityChatMessage.insertMany(batch);
      totalCreated += batch.length;
      console.log(`Room ${room._id} seeded with ${batch.length} messages (had ${existingCount}).`);
    }
  }

if (SHOULD_UPDATE_SAMPLE_DATA) {
  try {
    const exported = await exportSampleMessages(rooms);
    if (exported.length) {
      fs.writeFileSync(SAMPLE_DATA_PATH, JSON.stringify(exported, null, 2));
    }
    console.log(`Updated sample proximity chat JSON with ${exported.length} records.`);
  } catch (error) {
    console.error('Failed to update sample proximity chat JSON:', error);
  }
}

  console.log(`Seeded ${totalCreated} proximity chat messages.`);
  await mongoose.disconnect();
}

ensureMessages().catch((error) => {
  console.error('Failed to seed proximity chat messages:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
