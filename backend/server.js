const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// MongoDB Connection
mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_system'
)
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/students', require('./routes/students'));
app.use('/api/officer', require('./routes/officer'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

// Socket handlers
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server running' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { io };
