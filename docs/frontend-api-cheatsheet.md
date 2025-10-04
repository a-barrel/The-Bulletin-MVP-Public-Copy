# Pinpoint API Reference (Frontend Cheatsheet)

All endpoints require `Authorization: Bearer <token>` (use `demo-test-token` in development). Base URL:

- Local: `http://localhost:5000`
- Render: `https://bulletin-app.onrender.com`

---
## Users

### `GET /api/users`
List public user profiles.

Query params: `search`, `limit`

```json
[
  {
    "_id": "68e061721329566a22d474a7",
    "username": "alexrivera",
    "displayName": "Alex Rivera",
    "avatar": { "url": "https://..." },
    "stats": { "eventsHosted": 2, "followers": 23, ... },
    "badges": [],
    "accountStatus": "active"
  }
]
```

### `GET /api/users/:userId`
Returns full profile (preferences, relationships, pinned pin IDs, timestamps).

### `GET /api/users/:userId/pins`
Pins created by the user. Response matches pin list items below.

---
## Pins

### `GET /api/pins`
Query params: `type`, `creatorId`, `limit`

```json
[
  {
    "_id": "68e061721329566a22d474aa",
    "type": "event",
    "creatorId": "68e061721329566a22d474a7",
    "creator": { "_id": "68e061..." },
    "title": "Campus Cleanup & Coffee",
    "coordinates": { "type": "Point", "coordinates": [-118.115, 33.784], "accuracy": 20 },
    "proximityRadiusMeters": 1200,
    "startDate": "2025-10-04T23:51:14.276Z",
    "endDate": "2025-10-05T02:51:14.276Z",
    "replyCount": 4,
    "stats": { "bookmarkCount": 12, "replyCount": 4, ... }
  }
]
```

### `GET /api/pins/:pinId`
Full pin payload with address/participants (events) or expiration (discussions).

### `GET /api/pins/:pinId/replies`
```json
[
  {
    "_id": "68e061721329566a22d474b0",
    "pinId": "68e061721329566a22d474aa",
    "author": { "_id": "68e061...", "displayName": "Priya Desai" },
    "message": "Count me in!",
    "reactions": [{ "userId": "68e061...", "type": "like", "reactedAt": "2025-10-03T23:51:14.276Z" }],
    "createdAt": "2025-10-03T23:51:14.276Z"
  }
]
```

---
## Bookmarks

### `GET /api/bookmarks?userId=<id>`
```json
[
  {
    "_id": "68e061721329566a22d474af",
    "pinId": "68e061721329566a22d474ac",
    "notes": "Invite the design club folks.",
    "createdAt": "2025-10-03T23:51:16.195Z",
    "pin": { "_id": "68e061...", "title": "Night Market Pop-up" }
  }
]
```

### `GET /api/bookmarks/collections?userId=<id>`
Returns collections including nested bookmarks.

---
## Chats / Proximity Rooms

### `GET /api/chats/rooms`
```json
[
  {
    "_id": "68e061721329566a22d474b3",
    "name": "CSULB Campus Lounge",
    "coordinates": { "type": "Point", "coordinates": [-118.112, 33.782] },
    "radiusMeters": 600,
    "participantIds": ["68e061..."],
    "moderatorIds": ["68e061..."],
    "pinId": "68e061721329566a22d474ab"
  }
]
```

### `GET /api/chats/rooms/:roomId/messages`
```json
[
  {
    "_id": "68e061721329566a22d474b4",
    "author": { "displayName": "Priya Desai" },
    "message": "Welcome to the lounge!",
    "createdAt": "2025-10-03T23:51:14.276Z"
  }
]
```

### `GET /api/chats/rooms/:roomId/presence`
Presence entries with session IDs and last-active timestamps.

---
## Updates

### `GET /api/updates?userId=<id>`
```json
[
  {
    "_id": "68e061721329566a22d474b8",
    "payload": {
      "type": "new-pin",
      "title": "Priya started a new study circle",
      "pin": { "_id": "68e061721329566a22d474ab", "title": "Latte Lounge Study Circle" }
    },
    "createdAt": "2025-10-03T23:51:16.544Z",
    "deliveredAt": "2025-10-03T23:51:14.276Z"
  }
]
```

---
## Locations

### `POST /api/locations`
Upsert current location (matching `LocationWriteSchema`).

```json
{
  "userId": "68e061721329566a22d474a7",
  "coordinates": { "type": "Point", "coordinates": [-118.1151, 33.7845] },
  "source": "ios",
  "linkedPinIds": ["68e061721329566a22d474aa"]
}
```

### `GET /api/locations/nearby`
Query params: `longitude`, `latitude`, `maxDistance`

```json
[
  {
    "userId": "68e061721329566a22d474a7",
    "coordinates": { "type": "Point", "coordinates": [-118.1151, 33.7845], "accuracy": 12 },
    "distanceMeters": 56.4,
    "linkedPinIds": ["68e061721329566a22d474aa"]
  }
]
```

### `GET /api/locations/history/:userId`
Most recent 50 locations for that user.

---
## Sample IDs (from seed data)

- Users: Alex `68e061721329566a22d474a7`, Priya `68e061721329566a22d474a8`, Marcus `68e061721329566a22d474a9`
- Pins: Cleanup `68e061721329566a22d474aa`, Latte Lounge `68e061721329566a22d474ab`, Night Market `68e061721329566a22d474ac`
- Chat room: `68e061721329566a22d474b3`
- Bookmark collections: Alex `68e061721329566a22d474ad`

---
## Quick curl examples
```bash
curl -H "Authorization: Bearer demo-test-token" \
  "https://bulletin-app.onrender.com/api/pins"

curl -H "Authorization: Bearer demo-test-token" \
  "https://bulletin-app.onrender.com/api/bookmarks?userId=68e061721329566a22d474a7"
```
