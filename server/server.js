const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const Location = require('./models/Location');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social-gps')
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      await Location.syncIndexes();
      console.log('Location indexes synced');
    } catch (error) {
      console.error('Failed to sync location indexes:', error);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Social GPS API' });
});

// Location routes
const locationRoutes = require('./routes/locations');
app.use('/api/locations', locationRoutes);

// User routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
