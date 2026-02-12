const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true
  },
  room: {
    type: String,
    trim: true,
    required: function() {
      return this.messageType === 'group';
    }
  },
  text: {
    type: String,
    required: [true, 'Message text is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters'],
    minlength: [1, 'Message cannot be empty']
  },
  messageType: {
    type: String,
    enum: {
      values: ['group', 'private'],
      message: 'Message type must be either group or private'
    },
    default: 'group',
    required: true
  },
  recipient: {
    type: String,
    trim: true,
    required: function() {
      return this.messageType === 'private';
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: false
});

// Index for efficient queries
messageSchema.index({ room: 1, timestamp: -1 });
messageSchema.index({ username: 1, recipient: 1, timestamp: -1 });
messageSchema.index({ messageType: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
