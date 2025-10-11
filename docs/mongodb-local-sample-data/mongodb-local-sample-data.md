# MongoDB Sample Dataset (Local Development)

Use these JSON files to seed a local MongoDB instance with realistic data that matches the Pinpoint schemas. All files live alongside this guide inside the `docs/` folder.

## Quick Start

```bash
# Adjust the connection string or database name as needed
mongosh "mongodb://localhost:27017/pinpoint"

mongoimport --db pinpoint --collection users --file docs/mongodb-sample-users.json --jsonArray
mongoimport --db pinpoint --collection pins --file docs/mongodb-sample-pins.json --jsonArray
mongoimport --db pinpoint --collection bookmarkcollections --file docs/mongodb-sample-bookmarkCollections.json --jsonArray
mongoimport --db pinpoint --collection bookmarks --file docs/mongodb-sample-bookmarks.json --jsonArray
mongoimport --db pinpoint --collection replies --file docs/mongodb-sample-replies.json --jsonArray
mongoimport --db pinpoint --collection locations --file docs/mongodb-sample-locations.json --jsonArray
mongoimport --db pinpoint --collection proximitychatrooms --file docs/mongodb-sample-proximityChatRooms.json --jsonArray
mongoimport --db pinpoint --collection proximitychatmessages --file docs/mongodb-sample-proximityChatMessages.json --jsonArray
mongoimport --db pinpoint --collection proximitychatpresences --file docs/mongodb-sample-proximityChatPresence.json --jsonArray
mongoimport --db pinpoint --collection updates --file docs/mongodb-sample-updates.json --jsonArray
```

> The files use MongoDB Extended JSON (`$oid`, `$date`) so they retain object IDs and timestamps.

## What's Included

- **Users**: three active accounts (Alex, Priya, Marcus) with stats, preferences, and relationships.
- **Pins**: six total pins (event + discussion) including new examples ~5, ~10, and ~20 miles from the campus coordinates for distance testing.
- **Bookmarks**: one collection and bookmark wired to the sample pins.
- **Replies**: threaded comments tied to the event pin with reactions.
- **Locations**: recent location pings for each user.
- **Proximity Chat**: a room, a message, and presence records linked to a discussion pin.
- **Updates**: notification payloads referencing the pins and users.

Feel free to tweak values or add additional documents—the IDs in this dataset match the examples referenced throughout `frontend-api-cheatsheet.md`, so the UI and API playground will line up with the docs out of the box.
