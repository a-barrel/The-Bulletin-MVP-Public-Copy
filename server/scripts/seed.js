const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: require('path').join(__dirname, '..', '.env') });

const User = require('../models/User');
const Pin = require('../models/Pin');
const { Bookmark, BookmarkCollection } = require('../models/Bookmark');
const Reply = require('../models/Reply');
const { ProximityChatRoom, ProximityChatMessage, ProximityChatPresence } = require('../models/ProximityChat');
const Update = require('../models/Update');
const Location = require('../models/Location');

async function seed() {
  const ObjectId = mongoose.Types.ObjectId;
  const ids = {
    users: {
      alex: new ObjectId(),
      priya: new ObjectId(),
      marcus: new ObjectId()
    },
    pins: {
      campusCleanup: new ObjectId(),
      latteLounge: new ObjectId(),
      nightMarket: new ObjectId(),
      shorelineCycle: new ObjectId(),
      artWalkDiscussion: new ObjectId(),
      foothillTrail: new ObjectId()
    },
    bookmarkCollections: {
      alexFavorites: new ObjectId(),
      priyaWeekend: new ObjectId()
    },
    bookmarks: {
      alexCleanup: new ObjectId(),
      priyaLatte: new ObjectId()
    },
    replies: {
      cleanupThanks: new ObjectId(),
      latteChat: new ObjectId()
    },
    chats: {
      campusLounge: new ObjectId()
    },
    chatMessages: {
      welcome: new ObjectId(),
      meetup: new ObjectId()
    },
    presences: {
      alex: new ObjectId(),
      priya: new ObjectId()
    },
    updates: {
      alexNewPin: new ObjectId(),
      priyaReminder: new ObjectId()
    },
    sessions: {
      alex: new ObjectId(),
      priya: new ObjectId(),
      marcus: new ObjectId()
    },
    devices: {
      alex: new ObjectId(),
      priya: new ObjectId(),
      marcus: new ObjectId()
    }
  };

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const users = [
    {
      _id: ids.users.alex,
      username: 'alexrivera',
      displayName: 'Alex Rivera',
      email: 'alex@example.com',
      bio: 'Outdoor enthusiast and community organizer.',
      avatar: {
        url: 'https://images.pinpoint.dev/avatars/alex.png',
        thumbnailUrl: 'https://images.pinpoint.dev/avatars/alex-thumb.png'
      },
      preferences: {
        theme: 'dark',
        notifications: {
          proximity: true,
          updates: true,
          marketing: false
        },
        radiusPreferenceMeters: 10000
      },
      stats: {
        eventsHosted: 2,
        eventsAttended: 8,
        posts: 14,
        bookmarks: 5,
        followers: 23,
        following: 18
      },
      relationships: {
        followerIds: [ids.users.marcus],
        followingIds: [ids.users.priya],
        friendIds: [ids.users.priya, ids.users.marcus],
        mutedUserIds: [],
        blockedUserIds: []
      },
      locationSharingEnabled: true,
      pinnedPinIds: [ids.pins.campusCleanup, ids.pins.shorelineCycle],
      ownedPinIds: [ids.pins.campusCleanup, ids.pins.shorelineCycle],
      bookmarkCollectionIds: [ids.bookmarkCollections.alexFavorites],
      proximityChatRoomIds: [ids.chats.campusLounge],
      recentLocationIds: [],
      accountStatus: 'active'
    },
    {
      _id: ids.users.priya,
      username: 'priyadesai',
      displayName: 'Priya Desai',
      email: 'priya@example.com',
      bio: 'Coffee aficionado. Sharing hidden gems around campus.',
      avatar: {
        url: 'https://images.pinpoint.dev/avatars/priya.png'
      },
      preferences: {
        theme: 'light',
        notifications: {
          proximity: true,
          updates: true,
          marketing: true
        },
        radiusPreferenceMeters: 5000
      },
      stats: {
        eventsHosted: 1,
        eventsAttended: 11,
        posts: 21,
        bookmarks: 12,
        followers: 41,
        following: 36
      },
      relationships: {
        followerIds: [ids.users.alex, ids.users.marcus],
        followingIds: [ids.users.alex],
        friendIds: [ids.users.alex],
        mutedUserIds: [],
        blockedUserIds: []
      },
      locationSharingEnabled: true,
      pinnedPinIds: [ids.pins.latteLounge, ids.pins.artWalkDiscussion],
      ownedPinIds: [ids.pins.latteLounge, ids.pins.artWalkDiscussion],
      bookmarkCollectionIds: [ids.bookmarkCollections.priyaWeekend],
      proximityChatRoomIds: [ids.chats.campusLounge],
      recentLocationIds: [],
      accountStatus: 'active'
    },
    {
      _id: ids.users.marcus,
      username: 'marcusch',
      displayName: 'Marcus Chen',
      email: 'marcus@example.com',
      bio: 'Graphic designer who loves night markets.',
      avatar: {
        url: 'https://images.pinpoint.dev/avatars/marcus.png'
      },
      preferences: {
        theme: 'system',
        notifications: {
          proximity: true,
          updates: true,
          marketing: false
        },
        radiusPreferenceMeters: 8000
      },
      stats: {
        eventsHosted: 0,
        eventsAttended: 5,
        posts: 9,
        bookmarks: 4,
        followers: 12,
        following: 15
      },
      relationships: {
        followerIds: [ids.users.alex],
        followingIds: [ids.users.alex, ids.users.priya],
        friendIds: [ids.users.alex],
        mutedUserIds: [],
        blockedUserIds: []
      },
      locationSharingEnabled: false,
      pinnedPinIds: [ids.pins.nightMarket, ids.pins.foothillTrail],
      ownedPinIds: [ids.pins.nightMarket, ids.pins.foothillTrail],
      bookmarkCollectionIds: [],
      proximityChatRoomIds: [],
      recentLocationIds: [],
      accountStatus: 'active'
    }
  ];

  const pins = [
    {
      _id: ids.pins.campusCleanup,
      type: 'event',
      creatorId: ids.users.alex,
      title: 'Campus Cleanup & Coffee',
      description: 'Join us Saturday morning to keep the quad spotless. Coffee and pastries provided.',
      coordinates: {
        type: 'Point',
        coordinates: [-118.115, 33.784],
        accuracy: 20
      },
      proximityRadiusMeters: 1200,
      photos: [
        {
          url: 'https://images.pinpoint.dev/pins/cleanup-hero.jpg',
          thumbnailUrl: 'https://images.pinpoint.dev/pins/cleanup-thumb.jpg'
        }
      ],
      tags: ['community', 'volunteer'],
      relatedPinIds: [ids.pins.latteLounge],
      visibility: 'public',
      stats: { bookmarkCount: 12, replyCount: 4, shareCount: 7, viewCount: 120 },
      bookmarkCount: 12,
      replyCount: 4,
      startDate: tomorrow,
      endDate: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000),
      address: {
        precise: 'University Quad, 1250 Bellflower Blvd',
        components: {
          line1: '1250 Bellflower Blvd',
          city: 'Long Beach',
          state: 'CA',
          postalCode: '90840',
          country: 'US'
        }
      },
      participantLimit: 40,
      participantCount: 18,
      attendingUserIds: [ids.users.alex, ids.users.priya],
      attendeeWaitlistIds: [],
      attendable: true
    },
    {
      _id: ids.pins.latteLounge,
      type: 'discussion',
      creatorId: ids.users.priya,
      title: 'Latte Lounge Study Circle',
      description: 'Drop in for a relaxed study group. Share tips, playlists, and latte art pics.',
      coordinates: {
        type: 'Point',
        coordinates: [-118.111, 33.781],
        accuracy: 15
      },
      proximityRadiusMeters: 800,
      photos: [],
      tags: ['coffee', 'study'],
      relatedPinIds: [ids.pins.campusCleanup],
      visibility: 'public',
      stats: { bookmarkCount: 8, replyCount: 6, shareCount: 2, viewCount: 90 },
      bookmarkCount: 8,
      replyCount: 6,
      approximateAddress: {
        city: 'Long Beach',
        state: 'CA',
        country: 'US',
        formatted: 'Latte Lounge, Bellflower Blvd'
      },
      expiresAt: inThreeDays,
      autoDelete: false
    },
    {
      _id: ids.pins.nightMarket,
      type: 'event',
      creatorId: ids.users.marcus,
      title: 'Night Market Pop-up',
      description: 'Local artists, limited prints, and food trucks. Friday night in the plaza.',
      coordinates: {
        type: 'Point',
        coordinates: [-118.118, 33.786]
      },
      proximityRadiusMeters: 1500,
      photos: [
        {
          url: 'https://images.pinpoint.dev/pins/nightmarket.jpg'
        }
      ],
      tags: ['art', 'food'],
      relatedPinIds: [],
      visibility: 'public',
      stats: { bookmarkCount: 20, replyCount: 3, shareCount: 10, viewCount: 200 },
      bookmarkCount: 20,
      replyCount: 3,
      startDate: inThreeDays,
      endDate: new Date(inThreeDays.getTime() + 4 * 60 * 60 * 1000),
      address: {
        precise: 'Design Plaza, 6011 E Seventh St',
        components: {
          line1: '6011 E Seventh St',
          city: 'Long Beach',
          state: 'CA',
          postalCode: '90840',
          country: 'US'
        }
      }
    },
    {
      _id: ids.pins.shorelineCycle,
      type: 'event',
      creatorId: ids.users.alex,
      title: 'Shoreline Cycle Loop',
      description: 'Five-mile coastal ride with a smoothie break before looping back.',
      coordinates: {
        type: 'Point',
        coordinates: [-118.0265, 33.7838],
        accuracy: 18
      },
      proximityRadiusMeters: 804,
      photos: [],
      tags: ['cycling', 'outdoors'],
      relatedPinIds: [ids.pins.campusCleanup],
      visibility: 'public',
      stats: { bookmarkCount: 4, replyCount: 1, shareCount: 1, viewCount: 64 },
      bookmarkCount: 4,
      replyCount: 1,
      startDate: new Date('2025-10-18T16:00:00.000Z'),
      endDate: new Date('2025-10-18T19:00:00.000Z'),
      address: {
        precise: 'Belmont Shore Bike Trail Meetup',
        components: {
          city: 'Long Beach',
          state: 'CA',
          country: 'US'
        }
      },
      participantLimit: 25,
      participantCount: 9,
      attendingUserIds: [ids.users.priya],
      attendeeWaitlistIds: [],
      attendable: true
    },
    {
      _id: ids.pins.artWalkDiscussion,
      type: 'discussion',
      creatorId: ids.users.priya,
      title: 'North Long Beach Art Walk',
      description: 'Share carpool spots and highlight installations roughly ten miles north of campus.',
      coordinates: {
        type: 'Point',
        coordinates: [-118.1136, 33.9287],
        accuracy: 25
      },
      proximityRadiusMeters: 1000,
      photos: [],
      tags: ['art', 'community'],
      relatedPinIds: [],
      visibility: 'public',
      stats: { bookmarkCount: 6, replyCount: 2, shareCount: 1, viewCount: 92 },
      bookmarkCount: 6,
      replyCount: 2,
      approximateAddress: {
        city: 'North Long Beach',
        state: 'CA',
        country: 'US',
        formatted: 'North Long Beach, CA'
      },
      expiresAt: new Date('2025-10-20T06:00:00.000Z'),
      autoDelete: true
    },
    {
      _id: ids.pins.foothillTrail,
      type: 'event',
      creatorId: ids.users.marcus,
      title: 'Foothill Trail Run',
      description: 'Twenty-mile inland trail run with moderate elevation and a post-run stretch session.',
      coordinates: {
        type: 'Point',
        coordinates: [-117.9396, 34.0736],
        accuracy: 30
      },
      proximityRadiusMeters: 1609,
      photos: [],
      tags: ['running', 'fitness'],
      relatedPinIds: [],
      visibility: 'public',
      stats: { bookmarkCount: 10, replyCount: 3, shareCount: 2, viewCount: 130 },
      bookmarkCount: 10,
      replyCount: 3,
      startDate: new Date('2025-10-25T14:00:00.000Z'),
      endDate: new Date('2025-10-25T17:30:00.000Z'),
      address: {
        precise: 'Puente Hills Trailhead',
        components: {
          city: 'Hacienda Heights',
          state: 'CA',
          postalCode: '91745',
          country: 'US'
        }
      },
      participantLimit: 80,
      participantCount: 32,
      attendingUserIds: [ids.users.alex, ids.users.priya],
      attendeeWaitlistIds: [],
      attendable: true
    }
  ];

  const bookmarkCollections = [
    {
      _id: ids.bookmarkCollections.alexFavorites,
      userId: ids.users.alex,
      name: 'Weekend Plans',
      description: 'Things to do around campus this month.',
      bookmarkIds: [ids.bookmarks.alexCleanup],
      followerIds: [ids.users.priya]
    },
    {
      _id: ids.bookmarkCollections.priyaWeekend,
      userId: ids.users.priya,
      name: 'Coffee Crawl',
      description: 'Study spots and coffee hangouts.',
      bookmarkIds: [ids.bookmarks.priyaLatte],
      followerIds: []
    }
  ];

  const bookmarks = [
    {
      _id: ids.bookmarks.alexCleanup,
      userId: ids.users.alex,
      pinId: ids.pins.nightMarket,
      collectionId: ids.bookmarkCollections.alexFavorites,
      notes: 'Invite the design club folks.',
      tagIds: [],
      audit: {
        createdBy: ids.users.alex
      }
    },
    {
      _id: ids.bookmarks.priyaLatte,
      userId: ids.users.priya,
      pinId: ids.pins.campusCleanup,
      collectionId: ids.bookmarkCollections.priyaWeekend,
      notes: 'Capture photos for socials.',
      tagIds: [],
      audit: {
        createdBy: ids.users.priya
      }
    }
  ];

  const replies = [
    {
      _id: ids.replies.cleanupThanks,
      pinId: ids.pins.campusCleanup,
      authorId: ids.users.priya,
      message: 'Count me in! I will bring reusable gloves.',
      reactions: [
        {
          userId: ids.users.alex,
          type: 'like',
          reactedAt: now
        }
      ],
      mentionedUserIds: [ids.users.alex]
    },
    {
      _id: ids.replies.latteChat,
      pinId: ids.pins.latteLounge,
      parentReplyId: ids.replies.cleanupThanks,
      authorId: ids.users.marcus,
      message: 'I can share my productivity playlist.',
      mentionedUserIds: [ids.users.priya]
    }
  ];

  const chatRooms = [
    {
      _id: ids.chats.campusLounge,
      ownerId: ids.users.priya,
      name: 'CSULB Campus Lounge',
      description: 'Quick check-ins around campus hotspots.',
      coordinates: {
        type: 'Point',
        coordinates: [-118.112, 33.782]
      },
      radiusMeters: 600,
      participantCount: 2,
      participantIds: [ids.users.alex, ids.users.priya],
      moderatorIds: [ids.users.priya],
      pinId: ids.pins.latteLounge,
      audit: {
        createdBy: ids.users.priya
      }
    }
  ];

  const chatMessages = [
    {
      _id: ids.chatMessages.welcome,
      roomId: ids.chats.campusLounge,
      pinId: ids.pins.latteLounge,
      authorId: ids.users.priya,
      message: 'Welcome to the lounge! Share study plans and meetups here.',
      createdAt: now,
      updatedAt: now
    },
    {
      _id: ids.chatMessages.meetup,
      roomId: ids.chats.campusLounge,
      pinId: ids.pins.campusCleanup,
      authorId: ids.users.alex,
      message: 'Cleanup squad meets 8am Saturday – see you all there!',
      replyToMessageId: ids.chatMessages.welcome,
      createdAt: new Date(now.getTime() + 5 * 60 * 1000),
      updatedAt: new Date(now.getTime() + 5 * 60 * 1000)
    }
  ];

  const chatPresences = [
    {
      _id: ids.presences.alex,
      roomId: ids.chats.campusLounge,
      userId: ids.users.alex,
      sessionId: ids.sessions.alex,
      joinedAt: now,
      lastActiveAt: new Date(now.getTime() + 2 * 60 * 1000)
    },
    {
      _id: ids.presences.priya,
      roomId: ids.chats.campusLounge,
      userId: ids.users.priya,
      sessionId: ids.sessions.priya,
      joinedAt: now,
      lastActiveAt: new Date(now.getTime() + 3 * 60 * 1000)
    }
  ];

  const updates = [
    {
      _id: ids.updates.alexNewPin,
      userId: ids.users.alex,
      sourceUserId: ids.users.priya,
      targetUserIds: [ids.users.alex, ids.users.priya],
      payload: {
        type: 'new-pin',
        pin: {
          _id: ids.pins.latteLounge,
          type: 'discussion',
          creatorId: ids.users.priya,
          title: 'Latte Lounge Study Circle',
          coordinates: {
            type: 'Point',
            coordinates: [-118.111, 33.781]
          },
          proximityRadiusMeters: 800,
          linkedLocationId: null,
          linkedChatRoomId: ids.chats.campusLounge,
          startDate: null,
          endDate: null,
          expiresAt: inThreeDays
        },
        title: 'Priya started a new study circle',
        body: 'Drop in between 6-9pm for quiet focus time and latte art demos.',
        metadata: { highlight: true },
        relatedEntities: [
          {
            id: ids.chats.campusLounge,
            type: 'chat-room',
            label: 'Campus Lounge'
          }
        ]
      },
      deliveredAt: now
    },
    {
      _id: ids.updates.priyaReminder,
      userId: ids.users.priya,
      sourceUserId: ids.users.alex,
      targetUserIds: [ids.users.priya],
      payload: {
        type: 'event-starting-soon',
        pin: {
          _id: ids.pins.campusCleanup,
          type: 'event',
          creatorId: ids.users.alex,
          title: 'Campus Cleanup & Coffee',
          coordinates: {
            type: 'Point',
            coordinates: [-118.115, 33.784]
          },
          proximityRadiusMeters: 1200,
          linkedLocationId: null,
          linkedChatRoomId: null,
          startDate: tomorrow,
          endDate: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000),
          expiresAt: null
        },
        title: 'Reminder: Cleanup kicks off soon',
        body: 'Arrive 10 minutes early to grab supplies and assign zones.',
        metadata: { urgency: 'medium' },
        relatedEntities: []
      },
      deliveredAt: now
    }
  ];

  const locations = [
    {
      userId: ids.users.alex.toString(),
      coordinates: {
        type: 'Point',
        coordinates: [-118.1151, 33.7845]
      },
      accuracy: 12,
      sessionId: ids.sessions.alex,
      deviceId: ids.devices.alex,
      source: 'ios',
      appVersion: '1.2.0',
      linkedPinIds: [ids.pins.campusCleanup]
    },
    {
      userId: ids.users.priya.toString(),
      coordinates: {
        type: 'Point',
        coordinates: [-118.1112, 33.7808]
      },
      accuracy: 8,
      sessionId: ids.sessions.priya,
      deviceId: ids.devices.priya,
      source: 'android',
      appVersion: '1.1.5',
      linkedPinIds: [ids.pins.latteLounge]
    },
    {
      userId: ids.users.marcus.toString(),
      coordinates: {
        type: 'Point',
        coordinates: [-118.1185, 33.7856]
      },
      accuracy: 18,
      sessionId: ids.sessions.marcus,
      deviceId: ids.devices.marcus,
      source: 'web',
      appVersion: '1.0.9',
      linkedPinIds: [ids.pins.nightMarket]
    }
  ];

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social-gps');

  await Promise.all([
    User.deleteMany({}),
    Pin.deleteMany({}),
    Bookmark.deleteMany({}),
    BookmarkCollection.deleteMany({}),
    Reply.deleteMany({}),
    ProximityChatRoom.deleteMany({}),
    ProximityChatMessage.deleteMany({}),
    ProximityChatPresence.deleteMany({}),
    Update.deleteMany({}),
    Location.deleteMany({})
  ]);

  await User.insertMany(users);
  await Pin.insertMany(pins);
  await BookmarkCollection.insertMany(bookmarkCollections);
  await Bookmark.insertMany(bookmarks);
  await Reply.insertMany(replies);
  await ProximityChatRoom.insertMany(chatRooms);
  await ProximityChatMessage.insertMany(chatMessages);
  await ProximityChatPresence.insertMany(chatPresences);
  await Update.insertMany(updates);
  await Location.insertMany(locations);

  console.log('Seed data inserted successfully.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed script failed:', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
