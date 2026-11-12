require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { promisePool } = require('./config/database');
const { initializeSocket, broadcastNewLog } = require('./utils/socketManager');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { initializeScheduler } = require('./utils/reportScheduler');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/api/logs', require('./routes/logs'));
app.use('/api/registered-users', require('./routes/registeredUsers'));
app.use('/api/books', require('./routes/books'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/export', require('./routes/export'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/room-reservations', require('./routes/roomReservations'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/cataloging', require('./routes/cataloging'));

app.get('/api/health/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Socket.IO available at http://localhost:${PORT}`);
  initializeScheduler();
});

initializeSocket(server);

app.on('error', (error) => {
  console.error('Server error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

module.exports = { app, server };