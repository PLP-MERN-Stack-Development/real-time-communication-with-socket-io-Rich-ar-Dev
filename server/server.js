// server.js - Main server file for Socket.io chat application

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSocket } from './socket/index.js';
import { getMessages } from './models/messages.js';
import { getUsers } from './models/users.js';
import { connectDB } from './config/db.js';
import mongoose from './config/db.js';

// Load environment variables from server/.env (explicit path so .env inside server/ is used)
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize socket handlers from modular file
initSocket(io);

// API routes
app.get('/api/messages', async (req, res) => {
  // support simple pagination: ?page=1&limit=50
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '50', 10);
  try {
    const rows = await getMessages({ page, limit });
    res.json(rows);
  } catch (err) {
    console.error('Failed to load messages', err.message);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.get('/api/users', (req, res) => {
  res.json(getUsers());
});

// Root route
app.get('/', (req, res) => {
  res.send('Socket.io Chat Server is running');
});

// Start server only after DB connection
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB()
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server due to DB connection error')
    process.exit(1)
  }
})();

// Graceful shutdown
async function shutdown(signal) {
  try {
    console.log(`\nReceived ${signal} — closing server gracefully...`);
    // stop accepting new connections
    server.close((err) => {
      if (err) console.error('Error closing HTTP server:', err);
      else console.log('HTTP server closed');
    });

    // close socket.io
    try {
      io.close(() => console.log('Socket.io server closed'))
    } catch (e) {
      console.warn('Socket.io close error', e.message)
    }

    // disconnect mongoose
    try {
      await mongoose.disconnect()
      console.log('Disconnected from MongoDB')
    } catch (e) {
      console.warn('Error disconnecting mongoose', e.message)
    }

    // give things a moment to finish then exit
    setTimeout(() => process.exit(0), 500)
  } catch (err) {
    console.error('Error during shutdown', err)
    process.exit(1)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

export { app, server, io };