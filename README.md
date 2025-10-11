# 📌 The Bulletin - Location-Based Social Media MVP 📌 
📌darrel

A cost-effective social media platform that incorporates GPS features, allowing users to share their locations and connect with others nearby.

## Tech Stack

- **Frontend**: React.js with Vite
- **Backend**: Node.js with Express
- **Database**: MongoDB Atlas
- **Authentication**: Firebase Auth
- **Maps**: OpenStreetMap with Leaflet (free and open-source)
- **Hosting**: 
  - Frontend: Vercel
  - Backend: Render

## Project Structure

```
social-gps/
├── client/             # React frontend
├── server/             # Node.js backend
├── .gitignore         # Git ignore file
└── README.md          # Project documentation
```

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm
- MongoDB Atlas account
- Firebase account

### Environment Variables
Create `.env` files in both client and server directories:

#### Server (.env)
```
# Optional: force a mode override (defaults to offline locally, online in production)
PINPOINT_RUNTIME_MODE=offline

# MongoDB connection URIs
MONGODB_URI=
MONGODB_URI_OFFLINE=mongodb://127.0.0.1:27017/pinpoint

# Firebase service account credentials (JSON format)
# Required for Render/production deployments
FIREBASE_SERVICE_ACCOUNT_JSON=

<<<<<<< HEAD
# Demo bearer token accepted while in offline mode
PINPOINT_OFFLINE_DEMO_TOKEN=demo-token

# Firebase Auth emulator host
# Comment the following line to disable the Firebase Auth emulator (e.g. for production deployments)
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099

# MongoDB connection URI
# Update this value to point at your local or hosted MongoDB deployment
MONGODB_URI=mongodb://localhost:27017/social-gps

# Server port
PORT=5000

# Firebase emulator defaults (used automatically in offline mode)
USE_FIREBASE_EMULATOR=true
FIREBASE_PROJECT_ID=pinpoint-local
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

#### Client (.env)
```
# Optional: override runtime mode (defaults to offline in dev)
VITE_RUNTIME_MODE=offline

# Backend API base URLs
# (leave blank for relative /api calls when working offline)
VITE_API_BASE_URL=
VITE_API_BASE_URL_OFFLINE=http://localhost:5000

# Your web app's Firebase configuration
# (This config is public and can be exposed in the client-side code and thus safe to include here on the git repo)
VITE_FIREBASE_CONFIG={"apiKey": "AIzaSyAkVlj0uQu2Xdc1Y99lAd1bPbFlawEM6pA","authDomain": "bulletin app-6548a.firebaseapp.com","projectId": "bulletin-app-6548a","storageBucket": "bulletin-app-6548a.firebasestorage.app","messagingSenderId": "772158261487","appId": "1:772158261487:web:a9eef2f733426ded44331a","measurementId": "G-H3PW6CFB6L"}
# Optional offline Firebase config (falls back to VITE_FIREBASE_CONFIG if omitted)
# VITE_FIREBASE_CONFIG_OFFLINE={"projectId": "pinpoint-offline"}
# Optional auth emulator URL (default http://localhost:9099)
# VITE_FIREBASE_AUTH_EMULATOR_URL=http://localhost:9099
```

### Runtime modes

- `npm run dev` (or any non-production start) defaults to **offline** mode:
  - API calls target the local Express server via relative `/api` URLs.
  - MongoDB connects to `mongodb://127.0.0.1:27017/pinpoint`.
  - Firebase Auth automatically connects to the local emulator (http://localhost:9099).
  - Requests include the configurable `PINPOINT_OFFLINE_DEMO_TOKEN` bearer when no user is signed in.
- Render/Vercel builds automatically run in **online** mode (`NODE_ENV=production`), using the hosted MongoDB URI and Firebase credentials.
- Override the behavior at any time by setting `PINPOINT_RUNTIME_MODE` / `VITE_RUNTIME_MODE` to `online` or `offline`.

### Installation

1. Clone the repository
2. Install all dependencies (root, server, and client):

   You can do so by running theses commands on the root folder:

   ```bash
   npm run install:all
   ```
   ```bash
   npm install -g firebase-tools
   ```

3. Ensure .env exsists within the server and client folders. (see above for template)

4. Start both development servers from the root directory:
   ```bash
   npm run dev
   ```

   This will start both the backend server (port 5000) and frontend development server (port 5173) concurrently.

### Alternative Commands

- **Development mode**: `npm run dev` - Starts both frontend and backend in development mode
- **Production mode**: `npm run start` - Starts backend in production mode and serves built frontend
- **Server only**: `npm run server` - Starts only the backend server
- **Client only**: `npm run client` - Starts only the frontend development server
- **Build frontend**: `npm run build` - Builds the frontend for production

## Features

- User authentication
- Location sharing
- Interactive map display using OpenStreetMap
- Real-time updates
- User profiles

## License

MIT 

