# COMP3133 Lab Test 1 - Chat Application

A real-time chat application built with Node.js, Express, Socket.io, and MongoDB.

## Features

- User signup and login
- Room-based group chat
- Real-time messaging with Socket.io
- Message history stored in MongoDB
- User list display
- Typing indicators

## Technologies

- **Backend:** Node.js, Express.js, Socket.io, Mongoose
- **Frontend:** HTML5, CSS3, Bootstrap 5, jQuery, Fetch API
- **Database:** MongoDB Atlas

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up MongoDB connection:
   - Update the MongoDB URI in `server.js` or set `MONGODB_URI` environment variable

3. (Optional) Seed test users:
```bash
node seedUsers.js
```

4. Start the server:
```bash
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Create an account on the signup page
2. Login with your credentials
3. Select a room to join
4. Start chatting!

## Rooms

- DevOps
- Cloud Computing
- Data Science
- Hackathons
- NodeJS

## Author

COMP3133 Lab Test 1
