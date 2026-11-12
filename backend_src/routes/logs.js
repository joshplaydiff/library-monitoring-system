const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { promisePool } = require('../config/database');
const { broadcastNewLog, broadcastAnalyticsUpdate } = require('../utils/socketManager');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const validateLog = [
  body('name').notEmpty().withMessage('Name is required'),
  body('purpose').notEmpty().withMessage('Purpose is required'),
  body('log_type').isIn(['entry', 'exit']).withMessage('Log type must be entry or exit'),
  body('user_type').optional().isIn(['student', 'faculty', 'staff', 'guest', 'visitor', 'walk-in']),
  body('user_id').optional().isInt(),
  body('student_id').optional().notEmpty(),
  body('section').optional().isIn(['Main Library', 'Learning Commons', 'Meeting Room']),
  body('room_id').optional().isInt()
];

router.post('/', optionalAuth, validateLog, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const { name, purpose, log_type, user_type, user_id, student_id, section, room_id } = req.body;

    let resolvedUserId = user_id ? Number(user_id) : null;

    if (!resolvedUserId && student_id) {
      const [users] = await promisePool.query(
        'SELECT id FROM users WHERE student_id = ?',
        [student_id]
      );

      if (users.length > 0) {
        resolvedUserId = users[0].id;
      }
    }

    const [result] = await promisePool.query(
      'INSERT INTO visit_logs (user_id, user_type, name, purpose, section, room_id, log_type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [resolvedUserId, user_type || 'visitor', name, purpose, section || null, room_id || null, log_type]
    );

    const [newLog] = await promisePool.query(
      'SELECT * FROM visit_logs WHERE id = ?',
      [result.insertId]
    );

    broadcastNewLog(newLog[0]);

    res.status(201).json({
      success: true,
      data: newLog[0]
    });
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create log',
      message: error.message
    });
  }
});

router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { logs } = req.body;

    if (!Array.isArray(logs)) {
      return res.status(400).json({
        success: false,
        error: 'Logs must be an array'
      });
    }

    const syncedLogs = [];
    for (const log of logs) {
      const [result] = await promisePool.query(
        'INSERT INTO visit_logs (user_id, user_type, name, purpose, log_type, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [log.user_id || null, log.user_type || 'visitor', log.name, log.purpose, log.log_type, log.timestamp || new Date()]
      );
      const [newLog] = await promisePool.query('SELECT * FROM visit_logs WHERE id = ?', [result.insertId]);
      syncedLogs.push(newLog[0]);
    }

    broadcastAnalyticsUpdate();

    res.json({
      success: true,
      data: syncedLogs,
      message: `Successfully synced ${syncedLogs.length} logs`
    });
  } catch (error) {
    console.error('Error syncing logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync logs',
      message: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { user_type, purpose, startDate, endDate, limit, page } = req.query;

    let query = 'SELECT * FROM visit_logs WHERE 1=1';
    const params = [];

    if (user_type) {
      query += ' AND user_type = ?';
      params.push(user_type);
    }

    if (purpose) {
      query += ' AND purpose LIKE ?';
      params.push(`%${purpose}%`);
    }

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    if (page) {
      const offset = (parseInt(page) - 1) * (parseInt(limit) || 10);
      query += ' OFFSET ?';
      params.push(offset);
    }

    const [logs] = await promisePool.query(query, params);

    let total = logs.length;
    if (limit && !page) {
      const [countResult] = await promisePool.query(
        'SELECT COUNT(*) as total FROM visit_logs WHERE 1=1' +
        (user_type ? ' AND user_type = ?' : '') +
        (purpose ? ' AND purpose LIKE ?' : '') +
        (startDate ? ' AND timestamp >= ?' : '') +
        (endDate ? ' AND timestamp <= ?' : ''),
        [user_type, purpose ? `%${purpose}%` : null, startDate, endDate].filter(Boolean)
      );
      total = countResult[0]?.total || 0;
    }

    res.json({
      success: true,
      data: logs,
      pagination: limit ? {
        total,
        page: parseInt(page) || 1,
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      } : undefined
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs',
      message: error.message
    });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const { period = 'week', section, room_id } = req.query;

    if (!['day', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period. Must be day, week, or month'
      });
    }

    const { getAnalyticsData } = require('../utils/analytics');
    const analytics = await getAnalyticsData(period, section, room_id);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
});

router.get('/active-users', async (req, res) => {
  try {
    const [activeUsers] = await promisePool.query(`
      SELECT vl.user_id, vl.name, vl.user_type, vl.purpose, vl.timestamp
      FROM visit_logs vl
      INNER JOIN (
        SELECT user_id, MAX(timestamp) as latest_entry
        FROM visit_logs
        WHERE log_type = 'entry'
        AND timestamp >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
        GROUP BY user_id
      ) latest ON vl.user_id = latest.user_id AND vl.timestamp = latest.latest_entry
      WHERE vl.log_type = 'entry'
      AND vl.user_id NOT IN (
        SELECT user_id FROM visit_logs 
        WHERE log_type = 'exit' 
        AND timestamp > (
          SELECT MAX(timestamp) FROM visit_logs 
          WHERE log_type = 'entry' AND user_id = vl.user_id
        )
      )
      ORDER BY vl.timestamp DESC
    `);

    res.json({
      success: true,
      data: activeUsers
    });
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active users',
      message: error.message
    });
  }
});

router.get('/active-session', async (req, res) => {
  try {
    const { visitorId } = req.query;

    if (!visitorId) {
      return res.status(400).json({
        success: false,
        error: 'Visitor ID is required'
      });
    }

    let resolvedUserId = Number(visitorId);

    if (isNaN(resolvedUserId)) {
      const [users] = await promisePool.query(
        'SELECT id FROM users WHERE student_id = ?',
        [visitorId]
      );

      if (users.length > 0) {
        resolvedUserId = users[0].id;
      }
    }

    const [activeSession] = await promisePool.query(`
      SELECT * FROM visit_logs
      WHERE user_id = ? AND log_type = 'entry'
      AND id = (
        SELECT MAX(id) FROM visit_logs WHERE user_id = ? AND log_type = 'entry'
      )
    `, [resolvedUserId, resolvedUserId]);

    if (activeSession.length === 0) {
      return res.json({
        success: true,
        active: false,
        data: null
      });
    }

    const [exitLog] = await promisePool.query(`
      SELECT * FROM visit_logs
      WHERE user_id = ? AND log_type = 'exit'
      AND timestamp > ?
      LIMIT 1
    `, [resolvedUserId, activeSession[0].timestamp]);

    if (exitLog.length > 0) {
      return res.json({
        success: true,
        active: false,
        data: null
      });
    }

    res.json({
      success: true,
      active: true,
      data: activeSession[0]
    });
  } catch (error) {
    console.error('Error checking active session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check active session',
      message: error.message
    });
  }
});

router.post('/logout/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const [activeEntry] = await promisePool.query(`
      SELECT * FROM visit_logs
      WHERE user_id = ? AND log_type = 'entry'
      AND id = (
        SELECT MAX(id) FROM visit_logs WHERE user_id = ? AND log_type = 'entry'
      )
    `, [userId, userId]);

    if (activeEntry.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active entry found for this user'
      });
    }

    await promisePool.query(
      'INSERT INTO visit_logs (user_id, user_type, name, purpose, log_type, timestamp) VALUES (?, ?, ?, ?, ?, NOW())',
      [userId, activeEntry[0].user_type, activeEntry[0].name, activeEntry[0].purpose, 'exit']
    );

    broadcastNewLog({
      user_id: userId,
      log_type: 'exit',
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    console.error('Error logging out user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout user',
      message: error.message
    });
  }
});

router.get('/analytics/historical', async (req, res) => {
  try {
    const { comparisonType, referenceDate } = req.query;

    if (!['week-over-week', 'month-over-month', 'year-over-year'].includes(comparisonType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid comparison type'
      });
    }

    const { getHistoricalAnalytics } = require('../utils/analytics');
    const data = await getHistoricalAnalytics(comparisonType, referenceDate);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching historical analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch historical analytics',
      message: error.message
    });
  }
});

router.get('/analytics/trends', async (req, res) => {
  try {
    const { period, count, referenceDate } = req.query;

    if (!['week', 'month', 'year'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period'
      });
    }

    const { getTrendAnalytics } = require('../utils/analytics');
    const data = await getTrendAnalytics(period, parseInt(count) || 12, referenceDate);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching trend analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trend analytics',
      message: error.message
    });
  }
});

router.get('/analytics/capacity', async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const { getCapacityAnalytics } = require('../utils/analytics');
    const data = await getCapacityAnalytics(period);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching capacity analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch capacity analytics',
      message: error.message
    });
  }
});

router.get('/analytics/engagement', async (req, res) => {
  try {
    const { minVisits = 2, daysBack = 30 } = req.query;

    const { getEngagementAnalytics } = require('../utils/analytics');
    const data = await getEngagementAnalytics(parseInt(minVisits), parseInt(daysBack));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch engagement analytics',
      message: error.message
    });
  }
});

module.exports = router;