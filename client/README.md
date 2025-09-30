# Pinpoint Client

This React + Vite workspace now ships with a schema layer that mirrors the MongoDB collections used by the backend. Runtime validation is handled with [Zod](https://zod.dev), giving components a single source of truth for data shape while keeping form builders and API helpers consistent.

## Available Schemas

All schemas live in `src/schemas` and are re-exported through `src/schemas/index.js`.

- Common primitives: object ids, ISO dates, GeoJSON points, media assets, pagination helpers.
- Users: public profile, preferences, stats, roles, and blocking information.
- Pins: shared fields plus event and discussion specialisations.
- Bookmarks: saved pins and optional collections/groupings.
- Replies: threaded chat entries that sit under event and discussion detail pages.
- Proximity chat: rooms, presences, and live messages for the dedicated proximity chat surface.
- Updates: feed entries for the Updates page (bookmarked activity, popular pins, system notices).
- Location updates: payloads returned by `/api/locations` and nearby user lookups.

## Example Usage

```js
import { PinSchema } from './schemas';

async function fetchPin(pinId) {
  const res = await fetch(`/api/pins/${pinId}`);
  const json = await res.json();
  return PinSchema.parse(json);
}
```

To add new collections or extend existing ones, create a new file inside `src/schemas`, define the Zod objects, then update `src/schemas/index.js` so everything stays discoverable.
## Direct MongoDB Access (Data API)

For lightweight testing without the Node server, the client can talk to MongoDB Atlas through the Data API.

1. Duplicate `.env.example` to `.env` and fill in your Atlas Data API URL, API key, data source, database, and collection name.
2. Ensure your `locations` collection has a `2dsphere` index on `coordinates` so `$geoNear` queries succeed.
3. Run `npm run dev` and toggle the "Share Location" switch in the map view. The app will call the Data API to insert the device location and fetch nearby users, validating every response with the Zod schemas in `src/schemas`.

**Heads up:** Data API keys act like passwords. Only use this setup for prototyping. For production you should move the Data API calls back behind the server so secrets stay private.
