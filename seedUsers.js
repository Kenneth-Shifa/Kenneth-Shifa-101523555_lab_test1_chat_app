const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kennethshifa_db_user:May!2004@cluster0.frydzpb.mongodb.net/chat_app?retryWrites=true&w=majority&appName=Cluster0';

async function seedUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Test users to create
    const testUsers = [
      { username: 'Alice', password: 'password123' },
      { username: 'Bob', password: 'password123' },
      { username: 'Charlie', password: 'password123' },
      { username: 'Diana', password: 'password123' },
      { username: 'Eve', password: 'password123' },
      { username: 'Frank', password: 'password123' },
      { username: 'Grace', password: 'password123' },
      { username: 'Henry', password: 'password123' }
    ];

    console.log('Creating test users...');

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ username: userData.username });
      
      if (existingUser) {
        console.log(`User "${userData.username}" already exists, skipping...`);
      } else {
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        // Create user
        const user = new User({
          username: userData.username,
          password: hashedPassword
        });
        
        await user.save();
        console.log(`Created user: ${userData.username}`);
      }
    }

    console.log('\nTest users created successfully!');
    console.log('You can now login with any of these usernames and password: password123');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();
