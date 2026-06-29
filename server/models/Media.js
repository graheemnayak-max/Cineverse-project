const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  genre: { type: String, required: true },
  year: { type: Number, required: true },
  rating: { type: String, required: true },
  match: { type: Number, required: true },
  size: { type: String, required: true },
  image: { type: String, required: true },
  description: { type: String, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Media', mediaSchema);