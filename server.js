const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5000',
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Import models
const Media = require('./models/Media');
const User = require('./models/User');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cineverse')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============================================
// API Routes
// ============================================

// GET /api/media
// Query params:
//   category — "Movies", "TV Shows", or "all" (default: all)
//   search   — text search on title and genre (case-insensitive regex)
//   sort     — "match" (default), "year", or "title"
app.get('/api/media', async (req, res) => {
  try {
    const { category, search, sort } = req.query;

    // Build MongoDB query
    let query = {};

    // Category filter: only apply if a specific category is requested
    if (category && category !== 'all') {
      query.category = category;
    }

    // Text search: regex match on title or genre
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } }
      ];
    }

    // Determine sort direction for MongoDB
    let sortObj = { match: -1 }; // default: match descending
    if (sort) {
      switch (sort) {
        case 'match':
          sortObj = { match: -1 };
          break;
        case 'year':
          sortObj = { year: -1 };
          break;
        case 'title':
          sortObj = { title: 1 };
          break;
      }
    }

    // Execute query with MongoDB-native sorting
    const results = await Media.find(query).sort(sortObj);

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({ email, password });
    await user.save();

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    // Set cookie
    res.cookie('token', token, { httpOnly: true, secure: false });
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    // Set cookie
    res.cookie('token', token, { httpOnly: true, secure: false });
    res.json({ message: 'Login successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/user/list (add to watchlist)
app.post('/api/user/list', authenticateToken, async (req, res) => {
  try {
    const { mediaId } = req.body;
    if (!mediaId) {
      return res.status(400).json({ message: 'Media ID is required' });
    }

    // Check if media exists
    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    // Add to user's list
    const user = await User.findById(req.user.userId);
    if (!user.myList.includes(mediaId)) {
      user.myList.push(mediaId);
      await user.save();
    }

    res.json({ message: 'Added to watchlist' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/user/list (remove from watchlist)
app.delete('/api/user/list', authenticateToken, async (req, res) => {
  try {
    const { mediaId } = req.body;
    if (!mediaId) {
      return res.status(400).json({ message: 'Media ID is required' });
    }

    // Remove from user's list
    const user = await User.findById(req.user.userId);
    user.myList = user.myList.filter(id => id.toString() !== mediaId);
    await user.save();

    res.json({ message: 'Removed from watchlist' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/user/history (track play clicks)
app.post('/api/user/history', authenticateToken, async (req, res) => {
  try {
    const { mediaId } = req.body;
    if (!mediaId) {
      return res.status(400).json({ message: 'Media ID is required' });
    }

    // In a real app, you would save this to a history collection
    // For this example, we'll just log it
    console.log(`User ${req.user.userId} played media ${mediaId}`);

    res.json({ message: 'Play event recorded' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/user/recommendations
app.get('/api/user/recommendations', authenticateToken, async (req, res) => {
  try {
    // Get user's watchlist
    const user = await User.findById(req.user.userId).populate('myList');
    if (!user.myList.length) {
      return res.json([]); // Return empty array if no watchlist
    }

    // Get genres from user's watchlist
    const genres = user.myList.map(item => item.genre).join(',').split(/,\s*/);
    const uniqueGenres = [...new Set(genres)];

    // Find media with matching genres
    const recommendations = await Media.find({
      genre: { $in: uniqueGenres },
      _id: { $nin: user.myList.map(item => item._id) }
    }).limit(10);

    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));