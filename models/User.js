const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    trim: true,
    index: true
  },
  password: {
    type: String
  },
  room: {
    type: String,
    trim: true
  },
  socketId: {
    type: String
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Ensure unique username index
userSchema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
