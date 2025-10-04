# 📌 The Bulletin - Location-Based Social Media MVP 📌 
-# (Barrel branch test[if this txt is still here, i forgor 2 del :( )])

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
MONGODB_URI=your_mongodb_uri
PORT=5000
FIREBASE_ADMIN_CONFIG=your_firebase_admin_config
```

#### Client (.env)
```
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_CONFIG=your_firebase_config
```

### Installation

1. Clone the repository
2. Install all dependencies (root, server, and client):
   ```bash
   npm run install:all
   ```

3. Start both development servers from the root directory:
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

