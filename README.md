# 📌 The Bulletin - Location-Based Social Media MVP 📌 

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
# Firebase service account credentials (JSON format)
# Required for production, but can be left blank if using Firebase emulators
FIREBASE_SERVICE_ACCOUNT_JSON=

# Firebase Auth emulator host
# Comment the following line to not use the Firebase Auth emulator (e.g. comment it out for Real Depoloyment)
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099

# MongoDB connection URI
# This one you may need to edit depending on how you created your database!
MONGODB_URI=mongodb://localhost:27017/social-gps

# Server port
PORT=5000
```

#### Client (.env)
```
# The URL of the backend server
VITE_API_URL=http://localhost:5000

# Your web app's Firebase configuration
# (This config is public and can be exposed in the client-side code and thus safe to include here on the git repo)
VITE_FIREBASE_CONFIG={"apiKey": "AIzaSyAkVlj0uQu2Xdc1Y99lAd1bPbFlawEM6pA","authDomain": "bulletin app-6548a.firebaseapp.com","projectId": "bulletin-app-6548a","storageBucket": "bulletin-app-6548a.firebasestorage.app","messagingSenderId": "772158261487","appId": "1:772158261487:web:a9eef2f733426ded44331a","measurementId": "G-H3PW6CFB6L"}
```

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

