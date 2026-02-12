const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kennethshifa_db_user:May!2004@cluster0.frydzpb.mongodb.net/chat_app?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('Server will continue without MongoDB. Some features may not work.');
  });

// Models
const User = require('./models/User');
const Message = require('./models/Message');

// Store active users in memory
const activeUsers = new Map();

// Predefined rooms (all lowercase for consistency)
const PREDEFINED_ROOMS = ['devops', 'cloud computing', 'data science', 'hackathons', 'nodejs'];

// Helper function to handle database errors
function handleDbError(error, res) {
  console.error('Database error:', error);
  if (error.code === 11000) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  if (error.name === 'MongoServerError' || error.name === 'MongooseError' || error.name === 'MongoError') {
    return res.status(500).json({ error: 'Database error. Please try again.' });
  }
  return res.status(500).json({ error: error.message || 'An error occurred. Please try again.' });
}

// REST API Routes

// Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = (username || '').trim();
    
    // Check if username already exists
    if (normalizedUsername && mongoose.connection.readyState === 1) {
      const existingUser = await User.findOne({ username: normalizedUsername });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password || '', 10);
    
    // Create and save user
    const user = new User({
      username: normalizedUsername,
      password: hashedPassword
    });
    
    await user.save();
    res.json({ message: 'User created successfully', username: user.username });
  } catch (error) {
    handleDbError(error, res);
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    res.json({
      message: 'Login successful',
      username: user.username,
      userId: user._id.toString()
    });
  } catch (error) {
    handleDbError(error, res);
  }
});

// Get predefined rooms
app.get('/api/rooms', (req, res) => {
  res.json({ rooms: PREDEFINED_ROOMS });
});

// Get room messages
app.get('/api/rooms/:room/messages', async (req, res) => {
  try {
    const { room } = req.params;
    const { type, recipient, username } = req.query;
    const normalizedRoom = room.toLowerCase().trim();
    
    let query = { room: normalizedRoom };
    
    if (type === 'private' && recipient && username) {
      query.messageType = 'private';
      query.$or = [
        { username: username, recipient: recipient },
        { username: recipient, recipient: username }
      ];
    } else {
      query.messageType = 'group';
    }
    
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    
    res.json(messages.reverse());
  } catch (error) {
    if (error.name === 'MongoServerError' || error.name === 'MongooseError') {
      res.json([]);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get all users from database (limit to 4 other users)
app.get('/api/rooms/:room/users', async (req, res) => {
  try {
    // Get all users from database
    let allUsers = [];
    try {
      const dbUsers = await User.find({})
        .select('username')
        .limit(5)
        .lean();
      
      allUsers = dbUsers.map(u => ({ username: u.username }));
    } catch (dbError) {
      console.warn('Could not fetch users from database:', dbError.message);
      allUsers = [];
    }
    
    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('joinRoom', async ({ username, room }) => {
    try {
      if (!username || !room) {
        socket.emit('error', { message: 'Username and room are required' });
        return;
      }
      
      const normalizedRoom = room.toLowerCase().trim();
      
      if (!PREDEFINED_ROOMS.includes(normalizedRoom)) {
        socket.emit('error', { message: 'Invalid room' });
        return;
      }
      
      socket.join(normalizedRoom);
      
      // Update user in database
      try {
        await User.updateOne({ socketId: socket.id }, { $unset: { socketId: 1, room: 1 } });
        const user = await User.findOne({ username: username.trim() });
        if (user) {
          user.room = normalizedRoom;
          user.socketId = socket.id;
          user.lastLogin = new Date();
          await user.save();
        }
      } catch (dbError) {
        console.warn('Database update error:', dbError.message);
      }
      
      // Store in memory
      activeUsers.set(socket.id, {
        username: username.trim(),
        room: normalizedRoom,
        socketId: socket.id
      });
      
      // Get all users from database (limit to 4 other users)
      let allUsers = [];
      try {
        const dbUsers = await User.find({})
          .select('username')
          .limit(5)
          .lean();
        allUsers = dbUsers.map(u => ({ username: u.username }));
      } catch (dbError) {
        console.warn('Could not fetch users from database:', dbError.message);
        // Fallback to online users only
        allUsers = Array.from(activeUsers.values())
          .filter(u => u.room.toLowerCase() === normalizedRoom.toLowerCase())
          .map(u => ({ username: u.username }));
      }
      
      // Load recent messages
      let recentMessages = [];
      try {
        recentMessages = await Message.find({
          room: normalizedRoom,
          messageType: 'group'
        })
          .sort({ timestamp: -1 })
          .limit(50)
          .lean();
      } catch (dbError) {
        console.warn('Could not load messages:', dbError.message);
      }
      
      // Send welcome message
      socket.emit('message', {
        username: 'System',
        text: `Welcome to ${normalizedRoom} room, ${username}!`,
        timestamp: new Date().toISOString(),
        type: 'system'
      });
      
      // Send recent messages
      recentMessages.reverse().forEach(msg => {
        socket.emit('message', {
          username: msg.username,
          text: msg.text,
          timestamp: msg.timestamp,
          type: 'user'
        });
      });
      
      // Notify others
      socket.to(normalizedRoom).emit('message', {
        username: 'System',
        text: `${username} has joined the room`,
        timestamp: new Date().toISOString(),
        type: 'system'
      });
      
      io.to(normalizedRoom).emit('roomUsers', allUsers);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Send group message
  socket.on('sendMessage', async ({ username, room, text }) => {
    try {
      if (!username || !room || !text || !text.trim()) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }
      
      const normalizedRoom = room.toLowerCase().trim();
      
      // Validate room
      if (!PREDEFINED_ROOMS.includes(normalizedRoom)) {
        socket.emit('error', { message: 'Invalid room' });
        return;
      }
      
      // Save to database
      try {
        const message = new Message({
          username: username.trim(),
          room: normalizedRoom,
          text: text.trim(),
          messageType: 'group'
        });
        await message.save();
      } catch (dbError) {
        console.warn('Could not save message:', dbError.message);
      }
      
      // Broadcast to room
      io.to(normalizedRoom).emit('message', {
        username,
        text,
        timestamp: new Date().toISOString(),
        type: 'user'
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Send private message
  socket.on('sendPrivateMessage', async ({ username, recipient, text }) => {
    try {
      if (!username || !recipient || !text || !text.trim()) {
        socket.emit('error', { message: 'Invalid private message data' });
        return;
      }
      
      const recipientUser = Array.from(activeUsers.values())
        .find(u => u.username === recipient);
      
      if (!recipientUser) {
        socket.emit('error', { message: 'Recipient is not online' });
        return;
      }
      
      // Save to database
      try {
        const message = new Message({
          username: username.trim(),
          recipient: recipient.trim(),
          text: text.trim(),
          messageType: 'private'
        });
        await message.save();
      } catch (dbError) {
        console.warn('Could not save private message:', dbError.message);
      }
      
      // Send to recipient
      io.to(recipientUser.socketId).emit('privateMessage', {
        username,
        recipient,
        text,
        timestamp: new Date().toISOString(),
        type: 'private'
      });
      
      // Confirm to sender
      socket.emit('privateMessage', {
        username,
        recipient,
        text,
        timestamp: new Date().toISOString(),
        type: 'private',
        sent: true
      });
    } catch (error) {
      console.error('Error sending private message:', error);
      socket.emit('error', { message: 'Failed to send private message' });
    }
  });

  // Typing indicators
  socket.on('typing', ({ username, room }) => {
    socket.to(room).emit('typing', { username });
  });

  socket.on('stopTyping', ({ room }) => {
    socket.to(room).emit('stopTyping');
  });

  socket.on('privateTyping', ({ username, recipient }) => {
    const recipientUser = Array.from(activeUsers.values())
      .find(u => u.username === recipient);
    if (recipientUser) {
      io.to(recipientUser.socketId).emit('privateTyping', { username });
    }
  });

  socket.on('stopPrivateTyping', ({ recipient }) => {
    const recipientUser = Array.from(activeUsers.values())
      .find(u => u.username === recipient);
    if (recipientUser) {
      io.to(recipientUser.socketId).emit('stopPrivateTyping');
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    try {
      const user = activeUsers.get(socket.id);
      if (user) {
        const { username, room } = user;
        activeUsers.delete(socket.id);
        
        try {
          await User.updateOne({ socketId: socket.id }, { $unset: { socketId: 1, room: 1 } });
        } catch (dbError) {
          console.warn('Could not remove user:', dbError.message);
        }
        
        // Get all users from database (limit to 4 other users)
        let allUsers = [];
        try {
          const dbUsers = await User.find({})
            .select('username')
            .limit(5)
            .lean();
          allUsers = dbUsers.map(u => ({ username: u.username }));
        } catch (dbError) {
          console.warn('Could not fetch users from database:', dbError.message);
        }
        
        socket.to(room).emit('message', {
          username: 'System',
          text: `${username} has left the room`,
          timestamp: new Date().toISOString(),
          type: 'system'
        });
        
        io.to(room).emit('roomUsers', allUsers);
      }
    } catch (error) {
      console.error('Error on disconnect:', error);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
