# Frontend Cheatsheet – Pin Model Properties

To keep the UI simple, load a pin via `DebugPin.fromApi(payload)` and reference the typed properties below. The creation/update UI happens in the debug console; most frontend surfaces just read the values.

| Property | Type | Notes |
|----------|------|-------|
| `id` | `string | null` | Mongo ObjectId (string). |
| `type` | `'event' | 'discussion'` | Pin category. |
| `title` | `string` | Display name. |
| `description` | `string` | Up to 4000 chars. |
| `latitude` | `number | null` | Decimal degrees. |
| `longitude` | `number | null` | Decimal degrees. |
| `proximityRadiusMeters` | `number | null` | Cluster radius around the pin. |
| `startDate` | `string | null` | ISO datetime (events only). |
| `endDate` | `string | null` | ISO datetime (events only). |
| `expiresAt` | `string | null` | ISO datetime (discussions only). |
| `address` | `{ precise?: string, components?: { line1?, line2?, city?, state?, postalCode?, country? } } | null` | Full address for events. |
| `approximateAddress` | `{ city?, state?, country?, formatted? } | null` | High-level location for discussions. |
| `photos` | `Array<{ url: string, width?: number, height?: number, mimeType?: string, description?: string }>` | 512×512 JPGs stored under `/images`. |
| `coverPhoto` | Same shape as `photos` entry or `null`. | Defaults to first photo. |
| `autoDelete` | `boolean | null` | Discussions auto-delete flag. |
| `createdAt` | `string | null` | ISO datetime. |
| `updatedAt` | `string | null` | ISO datetime. |

### Usage Snippet
```js
import { DebugPin } from '@/models';
import { fetchPinById } from '@/api/mongoDataApi';

const payload = await fetchPinById(pinId);
const pin = DebugPin.fromApi(payload);

console.log(pin.title);
console.log(pin.photos[0]?.url ?? 'no photo');
```

**API reminder:** all calls require `Authorization: Bearer <token>` (use `demo-test-token` offline). Base URLs – local: `http://localhost:5000`, production: `https://bulletin-app.onrender.com`. Key endpoint for pins: `GET /api/pins/:pinId`.
