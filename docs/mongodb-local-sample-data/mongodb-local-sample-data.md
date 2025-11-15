# MongoDB Sample Dataset (Local Development)

Use these JSON files to seed a local MongoDB instance with realistic data that matches the Pinpoint schemas. All files live alongside this guide inside the `docs/` folder.

## Quick Start (Automated Loader)

From the repo root the following command will replace the relevant MongoDB collections with the sample fixtures:

```bash
npm run seed:samples
```

The script resolves `server/.env`, connects to `MONGODB_URI` (defaulting to `mongodb://localhost:27017/pinpoint`), clears the targeted collections, and bulk inserts the JSON fixtures from this directory.  

Advanced usage:

```bash
# Load only users and pins without dropping existing records
npm run seed:samples -- --collections users,pins --keep

# Preview what would happen without writing to MongoDB
npm run seed:samples -- --dry-run

# Point at a different directory of fixtures
npm run seed:samples -- --data-dir ./extra-fixtures
```

## Manual Import (mongoimport)

If you prefer to seed collections manually, you can still use `mongoimport` directly:

```bash
mongosh "mongodb://localhost:27017/pinpoint"

mongoimport --db pinpoint --collection users --file docs/mongodb-local-sample-data/mongodb-sample-users.json --jsonArray
mongoimport --db pinpoint --collection pins --file docs/mongodb-local-sample-data/mongodb-sample-pins.json --jsonArray
mongoimport --db pinpoint --collection bookmarkcollections --file docs/mongodb-local-sample-data/mongodb-sample-bookmarkCollections.json --jsonArray
mongoimport --db pinpoint --collection bookmarks --file docs/mongodb-local-sample-data/mongodb-sample-bookmarks.json --jsonArray
mongoimport --db pinpoint --collection replies --file docs/mongodb-local-sample-data/mongodb-sample-replies.json --jsonArray
mongoimport --db pinpoint --collection locations --file docs/mongodb-local-sample-data/mongodb-sample-locations.json --jsonArray
mongoimport --db pinpoint --collection proximitychatrooms --file docs/mongodb-local-sample-data/mongodb-sample-proximityChatRooms.json --jsonArray
mongoimport --db pinpoint --collection proximitychatmessages --file docs/mongodb-local-sample-data/mongodb-sample-proximityChatMessages.json --jsonArray
mongoimport --db pinpoint --collection proximitychatpresences --file docs/mongodb-local-sample-data/mongodb-sample-proximityChatPresence.json --jsonArray
mongoimport --db pinpoint --collection updates --file docs/mongodb-local-sample-data/mongodb-sample-updates.json --jsonArray
mongoimport --db pinpoint --collection friendrequests --file docs/mongodb-local-sample-data/mongodb-sample-friendRequests.json --jsonArray
mongoimport --db pinpoint --collection moderationactions --file docs/mongodb-local-sample-data/mongodb-sample-moderationActions.json --jsonArray
mongoimport --db pinpoint --collection directmessagethreads --file docs/mongodb-local-sample-data/mongodb-sample-directMessageThreads.json --jsonArray
mongoimport --db pinpoint --collection contentreports --file docs/mongodb-local-sample-data/mongodb-sample-contentReports.json --jsonArray
```

> The files use MongoDB Extended JSON (`$oid`, `$date`) so they retain object IDs and timestamps.

## What's Included

- **Users**: five active accounts (Alex, Priya, Marcus, Sofia, Jamal) with stats, preferences, and relationships.
- **Pins**: nine total pins spanning events and discussions, including new sustainability, arts, and sports meetups for distance testing.
- **Bookmarks**: three collections and bookmarks aligned to the expanded pin set.
- **Replies**: threaded comments across cleanup, expo, and photo walk pins with varied reactions.
- **Locations**: recent location pings for all five users tied back to their pins.
- **Proximity Chat**: seven rooms (global lounges + the four-piece CSULB overlap grid), four chat messages, and presence records linked to discussion, planning, and debug scenarios.
- **Updates**: four notification payloads covering new pin launches and reminders.
- **Moderation tooling data**: expanded `moderationActions` history plus ten `contentReports` showcasing pending, resolved, and dismissed cases (pins, replies, chats, and DMs) so the admin dashboard has realistic queues during demos.

Feel free to tweak values or add additional documents - the IDs in this dataset match the examples referenced throughout `frontend-api-cheatsheet.md`, so the UI and API playground will line up with the docs out of the box.

### CSULB Proximity Grid
- The `mongodb-sample-proximityChatRooms.json` fixture now includes a 2‑mile overlapping grid around CSULB (Northwest, Northeast, Southwest, Southeast hubs). This keeps proximity chats populated even when you walk away from the Pyramid during demos.
- Each hub uses an existing sample user as the owner/moderator and references one of the base pins so bookmarks + notifications stay linked.
- To regenerate or adjust the grid when refreshing fixtures, drop the following helper into a shell and tweak the `CENTER`/`DELTA` constants as needed. The script prints JSON blocks you can paste back into the proximity chat rooms file:

```bash
node scripts/generate-proximity-grid.js > docs/mongodb-local-sample-data/mongodb-sample-proximityChatRooms.json
```

The generator emits a 5×5 overlap grid (approx 2 mile spacing with 2.6 km radius) centered on CSULB. Tweak the script constants if you ever need a different center, spacing, or radius.
