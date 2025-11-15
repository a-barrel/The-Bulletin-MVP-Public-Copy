# The Bulletin – Location-Based Social Media MVP :O

The Bulletin is a cost-effective social platform that uses GPS features so people can share their locations and connect with others nearby.

## Tech Stack
- React (Vite) frontend
- Node.js / Express backend
- MongoDB Atlas
- Firebase Auth
- Leaflet (OpenStreetMap)
- Hosting: Vercel (frontend) + Render (backend)

## Project Structure
- `client/` – React frontend
- `server/` – Node.js backend
- `.gitignore`
- `README.md`

## Setup Instructions

### Prerequisites
- Node.js v16 or higher
- npm
- MongoDB Atlas (or a local MongoDB instance)
- Firebase project

### Environment Variables
Create `.env` files in both `server` and `client` directories.

#### Server (`server/.env`)
```
# Optional: override runtime mode (defaults to offline locally, online in production)
PINPOINT_RUNTIME_MODE=offline

# MongoDB connection URIs
MONGODB_URI=
MONGODB_URI_OFFLINE=mongodb://127.0.0.1:27017/pinpoint

# Firebase service account JSON (required for Render/production deployments)
FIREBASE_SERVICE_ACCOUNT_JSON=

# Demo bearer token accepted while running offline
PINPOINT_OFFLINE_DEMO_TOKEN=demo-token

# Firebase emulator defaults (used automatically in offline mode)
USE_FIREBASE_EMULATOR=true
#FIREBASE_PROJECT_ID=bulletin-offline
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080

FIREBASE_PROJECT_ID=bulletin-app-6548a

# Server port (8000 should work with mac)
PORT=8000
```

#### Client (`client/.env`)
```
# Optional: override runtime mode (defaults to offline in dev)
VITE_RUNTIME_MODE=offline

# Backend API base URLs
VITE_API_BASE_URL=
VITE_API_BASE_URL_OFFLINE=http://localhost:8000

# Optional API access tokens (used when running offline without Firebase auth)
# VITE_API_ACCESS_TOKEN=
# VITE_API_ACCESS_TOKEN_OFFLINE=demo-token

# Firebase configuration (public)
VITE_FIREBASE_CONFIG={"apiKey":"AIzaSyAkVlj0uQu2Xdc1Y99lAd1bPbFlawEM6pA","authDomain":"bulletin app-6548a.firebaseapp.com","projectId":"bulletin-app-6548a","storageBucket":"bulletin-app-6548a.firebasestorage.app","messagingSenderId":"772158261487","appId":"1:772158261487:web:a9eef2f733426ded44331a","measurementId":"G-H3PW6CFB6L"}

# Optional offline Firebase overrides
# VITE_FIREBASE_CONFIG_OFFLINE={"projectId":"pinpoint-offline"}
VITE_FIREBASE_AUTH_EMULATOR_URL=http://localhost:9099
```

### Installation
1. Install dependencies at the repo root:
   ```bash
   npm run install:all
   ```
2. (Optional) Install Firebase CLI tools:
   ```bash
   npm install -g firebase-tools
   ```
3. Ensure `.env` files exist in both `server/` and `client/`.

### Running Locally
Start both servers from the project root:
```bash
npm run dev
```
This launches the Express backend on port 8000 and the Vite dev server on 5173. Offline mode proxies API calls to `/api`, connects MongoDB to `mongodb://127.0.0.1:27017/pinpoint`, and uses the Firebase Auth emulator automatically.

### Debugging & Telemetry
- The backend prints `chat:*` and `pins:*` timing labels (via `console.time`) so you can spot slow Mongo queries quickly. Keep an eye on the server console while exercising the UI.
- Vite proxies `/api`, `/images`, and `/sounds` to `http://localhost:8000`, so browser network tabs only show `http://localhost:5173/...` while you develop.
- Static icons now ship locally (Material UI icons or files under `client/src/assets`), eliminating noisy external SVG fetches in the logs.
- When running in offline mode, those timing entries are also mirrored into `DEV_LOGS/` (git ignored) so you can capture and share traces without copy/paste.
- Offline runs also record any HTTP responses with status ≥ 400 to `DEV_LOGS/http-errors.log`, alongside the console warning.
- Fatal crashes (`uncaughtException`, `unhandledRejection`) log to `DEV_LOGS/runtime-errors.log` before the process exits, so you keep the stack trace even if the terminal scrolls.
- External integration failures (Firebase syncs, Tenor, analytics, etc.) append to `DEV_LOGS/integrations.log` in offline mode for easier debugging. When the Firebase emulator produces `firebase-debug.log`, it is automatically moved into `DEV_LOGS/` with a symlink left behind.

### Additional Commands
- `npm run server` - backend only (development)
- `npm run client` - frontend only (development)
- `npm run build` - builds the frontend
- `npm run start` - runs backend + frontend preview in production mode
- `cd server && npm run sync:firebase-users` - one-off sync to mirror Firebase Auth accounts into MongoDB

See `docs/firebase-auth-sync.md` for a deeper explanation of how Firebase accounts are provisioned locally and in production.
## Features
- Firebase authentication (email/password + Google)
- Location sharing via MongoDB geospatial queries
- Interactive map powered by Leaflet
- Real-time style updates and user profiles

## License
MIT
