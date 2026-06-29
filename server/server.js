const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Dynamic CORS configuration to support both local development and production
const allowedOrigins = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  // Add your deployed Render frontend URL below if it differs from the backend domain
  'https://cineverse.onrender.com' 
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if the origin is allowed or if it's a Render subdomain
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.onrender.com')) {
      return callback(null, true);
    } else {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
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
app.get('/api/media', async (req, res) => {
  try {
    const { category, search, sort } = req.query;

    let query = {};

    if (category && category !== 'all') {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } }
      ];
    }

    let sortObj = { match: -1 }; 
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

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ email, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    // Production-ready secure cookies
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    
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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    // Production-ready secure cookies
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    
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

    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

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

    const user = await User.findById(req.user.userId);
    user.myList = user.myList.filter(id => id.toString() !== mediaId);
    await user.save();

    res.json({ message: 'Removed from watchlist' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/user/history
app.post('/api/user/history', authenticateToken, async (req, res) => {
  try {
    const { mediaId } = req.body;
    if (!mediaId) {
      return res.status(400).json({ message: 'Media ID is required' });
    }

    console.log(`User ${req.user.userId} played media ${mediaId}`);
    res.json({ message: 'Play event recorded' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/user/recommendations
app.get('/api/user/recommendations', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('myList');
    if (!user.myList.length) {
      return res.json([]); 
    }

    const genres = user.myList.map(item => item.genre).join(',').split(/,\s*/);
    const uniqueGenres = [...new Set(genres)];

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