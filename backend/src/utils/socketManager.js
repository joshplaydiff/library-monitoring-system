const { Server } = require('socket.io');
const { getAnalyticsData } = require('./analytics');
const { promisePool } = require('../config/database');

let io = null;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('subscribe-dashboard', async () => {
      try {
        const analytics = await getAnalyticsData('week');
        
        socket.emit('analytics-update', {
          currentlyInside: analytics.currentlyInside || 0,
          todayVisits: analytics.totalVisits || 0,
          hourlyDistribution: analytics.hourlyDistribution || {},
          dailyBreakdown: analytics.dailyBreakdown || [],
          engagementMetrics: analytics.engagementMetrics || {}
        });

        console.log('Client subscribed to dashboard updates:', socket.id);
      } catch (error) {
        console.error('Error sending initial analytics:', error);
      }
    });

    socket.on('unsubscribe-dashboard', () => {
      console.log('Client unsubscribed from dashboard updates:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

const broadcastNewLog = async (logData) => {
  if (!io) return;

  try {
    const analytics = await getAnalyticsData('week');
    
    io.emit('new-log', {
      activeUsersCount: analytics.currentlyInside || 0,
      todayVisits: analytics.totalVisits || 0,
      log: logData,
      timestamp: new Date()
    });

    io.emit('analytics-update', {
      currentlyInside: analytics.currentlyInside || 0,
      todayVisits: analytics.totalVisits || 0,
      hourlyDistribution: analytics.hourlyDistribution || {},
      dailyBreakdown: analytics.dailyBreakdown || [],
      engagementMetrics: analytics.engagementMetrics || {}
    });
  } catch (error) {
    console.error('Error broadcasting new log:', error);
  }
};

const broadcastAnalyticsUpdate = async () => {
  if (!io) return;

  try {
    const analytics = await getAnalyticsData('week');
    
    io.emit('analytics-update', {
      currentlyInside: analytics.currentlyInside || 0,
      todayVisits: analytics.totalVisits || 0,
      hourlyDistribution: analytics.hourlyDistribution || {},
      dailyBreakdown: analytics.dailyBreakdown || [],
      engagementMetrics: analytics.engagementMetrics || {}
    });
  } catch (error) {
    console.error('Error broadcasting analytics update:', error);
  }
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  broadcastNewLog,
  broadcastAnalyticsUpdate,
  getIO
};