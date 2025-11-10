# Frontend Cheatsheet - Full Pin Payload

Fetch a pin with `GET /api/pins/:pinId`, run it through `DebugPin.fromApi(payload)` for typed access, and refer to the shapes below when you need every field (including the embedded `creator`). The backend normalises everything before sending JSON, so anything missing from the response is truly unset.

## Pin Base Properties

| Property | Type | Details |
|----------|------|---------|
| `_id` | `string` | MongoDB ObjectId for the pin. |
| `type` | `'event' \| 'discussion'` | Determines which extra fields appear. |
| `creatorId` | `string` | Owner id; mirrors `creator._id`. |
| `creator` | `PublicUser` \| `undefined` | See [Creator Object](#creator-object-payloadcreator). Present when the caller is authorised. |
| `title` | `string` | Display name. |
| `description` | `string` | Up to 4000 characters of rich text. |
| `coordinates` | `{ type: 'Point', coordinates: [longitude, latitude], accuracy?: number }` | Long/lat in decimal degrees; `accuracy` is meters. |
| `proximityRadiusMeters` | `number` | Cluster radius around the pin (default 1609 m / 1 mile). |
| `photos` | `MediaAsset[]` | Up to 10 uploaded assets (see [Media Asset](#media-asset-shape)). |
| `coverPhoto` | `MediaAsset` \| `undefined` | Hero image; defaults to first photo if unset. |
| `tagIds` | `string[]` | ObjectId references to tag records (if any). |
| `tags` | `string[]` | Denormalised tag labels. |
| `relatedPinIds` | `string[]` | Other pins linked to this one. |
| `options` | `PinOptions` | Config toggles for reminders, feed placement, and moderation (see [Pin Options](#pin-options-payloadoptions)). |
| `linkedLocationId` | `string` \| `undefined` | Attached `Location` entity. |
| `linkedChatRoomId` | `string` \| `undefined` | Associated proximity chat room. |
| `visibility` | `'public' \| 'friends' \| 'private'` | Sharing scope. |
| `isActive` | `boolean` | Whether the pin should appear in feeds. |
| `stats` | `PinStats` \| `undefined` | See [Pin Stats](#pin-stats-payloadstats). |
| `bookmarkCount` | `number` | Quick access to `stats.bookmarkCount`. |
| `replyCount` | `number` | Quick access to `stats.replyCount`. |
| `createdAt` | `string` | ISO-8601 timestamp. |
| `updatedAt` | `string` | ISO-8601 timestamp. |
| `audit` | `{ createdAt: string, updatedAt: string, createdBy?: string, updatedBy?: string }` \| `undefined` | Reserved for moderation trails (not currently populated). |

## Event-Only Fields (`type === 'event'`)

| Property | Type | Details |
|----------|------|---------|
| `startDate` | `string` | ISO-8601 start. |
| `endDate` | `string` | ISO-8601 end. |
| `address` | `{ precise: string, components?: { line1?, line2?, city?, state?, postalCode?, country? } }` \| `undefined` | Full venue information. |
| `participantCount` | `number` | Current attendance tally. |
| `participantLimit` | `number` \| `undefined` | Capacity cap. |
| `attendingUserIds` | `string[]` \| `undefined` | Users confirmed for the event. |
| `attendeeWaitlistIds` | `string[]` | Users waiting for a spot. |
| `attendable` | `boolean` | Whether RSVPs are open. |

## Discussion-Only Fields (`type === 'discussion'`)

| Property | Type | Details |
|----------|------|---------|
| `approximateAddress` | `{ city?, state?, country?, formatted? }` \| `undefined` | High-level location hints. |
| `expiresAt` | `string` | ISO-8601 auto-expiry timestamp. |
| `autoDelete` | `boolean` | If `true`, pin is removed when `expiresAt` passes. |

## Creator Object (`payload.creator`)

| Property | Type | Details |
|----------|------|---------|
| `_id` | `string` | Creator id (MongoDB ObjectId). |
| `username` | `string` | Handle used in mentions/@lookups. |
| `displayName` | `string` | Friendly name for UI. |
| `avatar` | `MediaAsset` \| `undefined` | Square profile image. |
| `stats` | `UserStats` \| `undefined` | See below. |
| `badges` | `string[]` | Awarded badge slugs. |
| `primaryLocationId` | `string` \| `undefined` | Home `Location`. |
| `accountStatus` | `'active' \| 'inactive' \| 'suspended' \| 'deleted'` | Current account state. |

### User Stats (`payload.creator.stats`)

| Field | Type | Meaning |
|-------|------|---------|
| `eventsHosted` | `number` | Total events published. |
| `eventsAttended` | `number` | Events joined. |
| `posts` | `number` | Discussion posts authored. |
| `bookmarks` | `number` | Pins bookmarked. |
| `followers` | `number` | Followers count. |
| `following` | `number` | Following count. |

## Pin Stats (`payload.stats`)

| Field | Type | Meaning |
|-------|------|---------|
| `bookmarkCount` | `number` | Saved by how many users. |
| `replyCount` | `number` | Replies (including threads). |
| `shareCount` | `number` | Shares recorded. |
| `viewCount` | `number` | Unique view counter. |

## Pin Options (`payload.options`)

| Field | Type | Meaning |
|-------|------|---------|
| `allowBookmarks` | `boolean` | Toggles whether viewers can bookmark the pin. Defaults to `true`. |
| `allowShares` | `boolean` | Enables `/share` tracking + share buttons. Defaults to `true`. |
| `allowReplies` | `boolean` | Hides reply UI when `false`. Defaults to `true`. |
| `showAttendeeList` | `boolean` | Controls attendee visibility (events default to `true`). |
| `featured` | `boolean` | Marks the pin for elevated placement/styling. |
| `visibilityMode` | `'map-only' \| 'list-only' \| 'map-and-list'` | Signals which surfaces should render the pin. |
| `reminderMinutesBefore` | `number` \| `undefined` | Optional reminder lead time (0–10,080 minutes). |
| `contentAdvisory` | `string` \| `undefined` | Short warning/caution string the UI can display inline. |
| `highlightColor` | `string` \| `undefined` | Hex color for accent badges or borders. |

When the backend omits `options`, assume the defaults above (bookmarks/shares/replies enabled, attendee lists visible for events, `visibilityMode = 'map-and-list'`).

## Media Asset Shape

Applies to `photos[]`, `coverPhoto`, and `creator.avatar`.

| Field | Type | Notes |
|-------|------|-------|
| `url` | `string` | Full-size asset location (required). |
| `thumbnailUrl` | `string` \| `undefined` | Smaller preview when available. |
| `width` | `number` \| `undefined` | Pixels. |
| `height` | `number` \| `undefined` | Pixels. |
| `mimeType` | `string` \| `undefined` | Usually `image/jpeg`. |
| `description` | `string` \| `undefined` | Alt text / caption. |
| `uploadedAt` | `string` \| `undefined` | ISO timestamp for the upload. |
| `uploadedBy` | `string` \| `undefined` | User id who uploaded. |

## Console Logging Example

```js
import { DebugPin } from '@/models';
import { fetchPinById } from '@/api/mongoDataApi';

const payload = await fetchPinById(pinId);
logPinPayload(payload);

const pin = DebugPin.fromApi(payload);
console.log('Typed pin title:', pin.title);

function logPinPayload(payload) {
  if (!payload) {
    console.log('No pin payload returned.');
    return;
  }

  console.log('--- Pin Base ---');
  console.log('Pin ID:', payload._id ?? 'n/a');
  console.log('Type:', payload.type ?? 'n/a');
  console.log('Title:', payload.title ?? 'n/a');
  console.log('Description:', payload.description ?? 'n/a');
  console.log('Creator ID:', payload.creatorId ?? 'n/a');
  console.log('Coordinates:', payload.coordinates ?? 'n/a');
  console.log('Proximity radius:', payload.proximityRadiusMeters ?? 'n/a');
  console.log('Photos (urls):', (payload.photos ?? []).map((photo) => photo.url));
  console.log('Cover photo:', payload.coverPhoto ?? 'n/a');
  console.log('Tag IDs:', payload.tagIds ?? []);
  console.log('Tags:', payload.tags ?? []);
  console.log('Related pin IDs:', payload.relatedPinIds ?? []);
  console.log('Linked location ID:', payload.linkedLocationId ?? 'n/a');
  console.log('Linked chat room ID:', payload.linkedChatRoomId ?? 'n/a');
  console.log('Visibility:', payload.visibility ?? 'n/a');
  console.log('Is active:', payload.isActive ?? 'n/a');
  console.log('Stats object:', payload.stats ?? 'n/a');
  console.log('Bookmark count:', payload.bookmarkCount ?? 0);
  console.log('Reply count:', payload.replyCount ?? 0);
  console.log('Created at:', payload.createdAt ?? 'n/a');
  console.log('Updated at:', payload.updatedAt ?? 'n/a');
  console.log('Audit:', payload.audit ?? 'n/a');

  if (payload.type === 'event') {
    console.log('--- Event Fields ---');
    console.log('Start date:', payload.startDate ?? 'n/a');
    console.log('End date:', payload.endDate ?? 'n/a');
    console.log('Address:', payload.address ?? 'n/a');
    console.log('Participant count:', payload.participantCount ?? 0);
    console.log('Participant limit:', payload.participantLimit ?? 'n/a');
    console.log('Attending user IDs:', payload.attendingUserIds ?? []);
    console.log('Waitlist IDs:', payload.attendeeWaitlistIds ?? []);
    console.log('Attendable:', payload.attendable ?? true);
  }

  if (payload.type === 'discussion') {
    console.log('--- Discussion Fields ---');
    console.log('Approximate address:', payload.approximateAddress ?? 'n/a');
    console.log('Expires at:', payload.expiresAt ?? 'n/a');
    console.log('Auto delete:', payload.autoDelete ?? true);
  }

  if (payload.stats) {
    console.log('--- Pin Stats ---');
    console.log('bookmarkCount:', payload.stats.bookmarkCount ?? 0);
    console.log('replyCount:', payload.stats.replyCount ?? 0);
    console.log('shareCount:', payload.stats.shareCount ?? 0);
    console.log('viewCount:', payload.stats.viewCount ?? 0);
  }

  if (payload.creator) {
    console.log('--- Creator ---');
    console.log('Creator ID:', payload.creator._id ?? 'n/a');
    console.log('Creator username:', payload.creator.username ?? 'n/a');
    console.log('Creator display name:', payload.creator.displayName ?? 'Unknown host');
    console.log('Creator avatar:', payload.creator.avatar ?? 'n/a');
    console.log('Creator badges:', payload.creator.badges ?? []);
    console.log('Creator primary location ID:', payload.creator.primaryLocationId ?? 'n/a');
    console.log('Creator account status:', payload.creator.accountStatus ?? 'n/a');

    const stats = payload.creator.stats ?? {};
    console.log('Creator events hosted:', stats.eventsHosted ?? 0);
    console.log('Creator events attended:', stats.eventsAttended ?? 0);
    console.log('Creator posts:', stats.posts ?? 0);
    console.log('Creator bookmarks:', stats.bookmarks ?? 0);
    console.log('Creator followers:', stats.followers ?? 0);
    console.log('Creator following:', stats.following ?? 0);
  } else {
    console.log('Creator: unavailable (missing or unauthorised).');
  }
}
```

**API reminder:** all calls require `Authorization: Bearer <token>` (`demo-test-token` works offline). Base URLs - local: `http://localhost:8000`, production: `https://bulletin-app.onrender.com`. Primary endpoint: `GET /api/pins/:pinId`.
