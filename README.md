# The Bulletin - Location-Based Social Media MVP

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
2. Install dependencies:
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. Start the development servers:
   ```bash
   # Start backend server
   cd server
   npm run dev

   # Start frontend server
   cd ../client
   npm run dev
   ```

## Features

- User authentication
- Location sharing
- Interactive map display using OpenStreetMap
- Real-time updates
- User profiles

## The Team

Darrel was here
```
{
	"firstName": "Max",
	"lastName": "Ju",
	"age": 74
}
```
Andy was here

AAAAA - Troy

Citlally was here <3

hi - Wai


## License

MIT 